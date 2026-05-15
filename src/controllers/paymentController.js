const Stripe = require('stripe');
const { PrismaClient } = require('@prisma/client');
const { calculateFees } = require('../utils/pricing');
const { sendPushNotification } = require('../utils/notifications');
const { saveNotification } = require('./notificationController');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const prisma = new PrismaClient();

const BACKEND_URL = process.env.BACKEND_URL || 'https://elmi-courier-backend-production.up.railway.app';

// POST /api/payments/create-checkout — create pending job + Stripe Checkout Session
async function createCheckout(req, res) {
  const {
    pickupAddress, pickupContact, dropoffAddress, dropoffContact,
    loadDescription, vanSize, notes, urgency, totalPrice, loadDocumentUrl,
  } = req.body;

  if (!pickupAddress || !dropoffAddress || !loadDescription || !totalPrice) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const { platformFee, driverEarnings } = calculateFees(Number(totalPrice));
  const pickup = pickupAddress.split(',')[0];
  const dropoff = dropoffAddress.split(',')[0];

  // Create job in PENDING_PAYMENT state — drivers won't see it yet
  const job = await prisma.job.create({
    data: {
      businessId: req.user.id,
      pickupAddress,
      pickupContact: pickupContact || '',
      dropoffAddress,
      dropoffContact: dropoffContact || '',
      loadDescription,
      vanSize: vanSize || 'Any Van',
      notes,
      urgency: urgency || 'ASAP',
      totalPrice: Number(totalPrice),
      platformFee,
      driverEarnings,
      loadDocumentUrl: loadDocumentUrl || null,
      status: 'PENDING_PAYMENT',
      isPaid: false,
    },
  });

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'gbp',
        product_data: {
          name: `Delivery: ${pickup} → ${dropoff}`,
          description: `${loadDescription} · ${vanSize || 'Any Van'}`,
        },
        unit_amount: Math.round(Number(totalPrice) * 100),
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${BACKEND_URL}/api/payments/checkout-success`,
    cancel_url: `${BACKEND_URL}/api/payments/checkout-cancel`,
    metadata: { jobId: job.id, businessId: req.user.id },
  });

  await prisma.job.update({
    where: { id: job.id },
    data: { stripeCheckoutSessionId: session.id },
  });

  return res.json({ jobId: job.id, sessionUrl: session.url });
}

// POST /api/payments/confirm/:jobId — called after browser closes to verify payment
async function confirmJob(req, res) {
  const job = await prisma.job.findUnique({ where: { id: req.params.jobId } });

  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.businessId !== req.user.id) return res.status(403).json({ error: 'Not your job' });

  // Already confirmed
  if (job.isPaid && job.status === 'POSTED') {
    return res.json({ success: true });
  }

  if (!job.stripeCheckoutSessionId) {
    return res.status(400).json({ error: 'No payment session found' });
  }

  const session = await stripe.checkout.sessions.retrieve(job.stripeCheckoutSessionId);

  if (session.payment_status === 'paid') {
    await prisma.job.update({
      where: { id: job.id },
      data: { isPaid: true, status: 'POSTED' },
    });

    await prisma.businessProfile.update({
      where: { userId: req.user.id },
      data: {
        totalJobs: { increment: 1 },
        totalSpend: { increment: job.totalPrice },
      },
    });

    const pickup = job.pickupAddress.split(',')[0];
    const dropoff = job.dropoffAddress.split(',')[0];

    const onlineDrivers = await prisma.user.findMany({
      where: { role: 'DRIVER', driverProfile: { isOnline: true } },
      select: { id: true, pushToken: true },
    });
    const tokens = onlineDrivers.map((d) => d.pushToken).filter(Boolean);
    sendPushNotification(tokens, 'New job available! 🚐', `${pickup} → ${dropoff} · £${job.driverEarnings.toFixed(0)}`, { jobId: job.id });
    for (const d of onlineDrivers) {
      saveNotification(d.id, 'New Job Available', `${pickup} → ${dropoff} · £${job.driverEarnings.toFixed(0)}`, 'JOB_POSTED', job.id);
    }
    saveNotification(req.user.id, 'Job Posted', `Your job from ${pickup} to ${dropoff} is now live`, 'JOB_POSTED', job.id);

    return res.json({ success: true });
  }

  // Session expired or cancelled — clean up
  if (session.status === 'expired' || session.payment_status !== 'unpaid') {
    await prisma.job.delete({ where: { id: job.id } });
  }

  return res.json({ success: false });
}

// POST /api/payments/driver/onboard — create Stripe Connect Express account + onboarding URL
async function driverOnboard(req, res) {
  const profile = await prisma.driverProfile.findUnique({ where: { userId: req.user.id } });
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { email: true } });

  let accountId = profile?.stripeAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'GB',
      email: user.email,
      capabilities: { transfers: { requested: true } },
    });
    accountId = account.id;
    await prisma.driverProfile.update({
      where: { userId: req.user.id },
      data: { stripeAccountId: accountId },
    });
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${BACKEND_URL}/api/payments/driver/onboard-refresh`,
    return_url: `${BACKEND_URL}/api/payments/driver/onboard-return`,
    type: 'account_onboarding',
  });

  return res.json({ url: accountLink.url });
}

// GET /api/payments/driver/onboard-status — check if driver has a connected account
async function driverOnboardStatus(req, res) {
  const profile = await prisma.driverProfile.findUnique({ where: { userId: req.user.id } });

  if (!profile?.stripeAccountId) return res.json({ connected: false });

  try {
    const account = await stripe.accounts.retrieve(profile.stripeAccountId);
    return res.json({
      connected: account.details_submitted,
      payoutsEnabled: account.payouts_enabled,
    });
  } catch {
    return res.json({ connected: false });
  }
}

// POST /api/payments/driver/withdraw — transfer available balance to driver's bank
async function driverWithdraw(req, res) {
  const profile = await prisma.driverProfile.findUnique({ where: { userId: req.user.id } });

  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  if (!profile.stripeAccountId) {
    return res.status(400).json({ error: 'No bank account connected. Set up your payout account first.' });
  }
  if (profile.availableBalance <= 0) {
    return res.status(400).json({ error: 'No balance available to withdraw.' });
  }

  const account = await stripe.accounts.retrieve(profile.stripeAccountId);
  if (!account.payouts_enabled) {
    return res.status(400).json({ error: 'Your bank account setup is incomplete. Please finish onboarding.' });
  }

  const amountInPence = Math.round(profile.availableBalance * 100);

  await stripe.transfers.create({
    amount: amountInPence,
    currency: 'gbp',
    destination: profile.stripeAccountId,
  });

  const withdrawn = profile.availableBalance;
  await prisma.driverProfile.update({
    where: { userId: req.user.id },
    data: { availableBalance: 0 },
  });

  return res.json({
    message: `£${withdrawn.toFixed(2)} is on its way to your bank. Funds arrive in 1–2 business days.`,
    withdrawn,
  });
}

module.exports = {
  createCheckout, confirmJob,
  driverOnboard, driverOnboardStatus, driverWithdraw,
};
