const { PrismaClient } = require('@prisma/client');
const { calculateFees } = require('../utils/pricing');
const { sendPushNotification } = require('../utils/notifications');

const prisma = new PrismaClient();

// GET /api/jobs — drivers see all POSTED jobs
async function listAvailableJobs(req, res) {
  const jobs = await prisma.job.findMany({
    where: { status: 'POSTED' },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          businessProfile: { select: { businessName: true, averageRating: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(jobs);
}

// GET /api/jobs/my — get jobs relevant to the logged-in user
async function myJobs(req, res) {
  const { id, role } = req.user;

  const where = role === 'BUSINESS' ? { businessId: id } : { driverId: id };

  const jobs = await prisma.job.findMany({
    where,
    include: {
      business: { select: { id: true, name: true, businessProfile: { select: { businessName: true } } } },
      driver: { select: { id: true, name: true, driverProfile: { select: { vanType: true, averageRating: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(jobs);
}

// GET /api/jobs/:id — get a single job
async function getJob(req, res) {
  const job = await prisma.job.findUnique({
    where: { id: req.params.id },
    include: {
      business: { select: { id: true, name: true, businessProfile: { select: { businessName: true, averageRating: true } } } },
      driver: { select: { id: true, name: true, driverProfile: { select: { vanType: true, averageRating: true, totalJobs: true } } } },
      ratings: { select: { raterId: true } },
    },
  });

  if (!job) return res.status(404).json({ error: 'Job not found' });

  return res.json(job);
}

// POST /api/jobs — business posts a new job
async function createJob(req, res) {
  const {
    pickupAddress,
    pickupContact,
    dropoffAddress,
    dropoffContact,
    loadDescription,
    vanSize,
    notes,
    urgency,
    totalPrice,
  } = req.body;

  if (!pickupAddress || !dropoffAddress || !loadDescription || !totalPrice) {
    return res.status(400).json({ error: 'pickupAddress, dropoffAddress, loadDescription and totalPrice are required' });
  }

  const { platformFee, driverEarnings } = calculateFees(Number(totalPrice));

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
    },
  });

  // Update business stats
  await prisma.businessProfile.update({
    where: { userId: req.user.id },
    data: {
      totalJobs: { increment: 1 },
      totalSpend: { increment: Number(totalPrice) },
    },
  });

  // Notify all online approved drivers
  const onlineDrivers = await prisma.user.findMany({
    where: {
      role: 'DRIVER',
      pushToken: { not: null },
      driverProfile: { isOnline: true },
    },
    select: { pushToken: true },
  });
  const driverTokens = onlineDrivers.map((d) => d.pushToken).filter(Boolean);
  const pickup = pickupAddress.split(',')[0];
  const dropoff = dropoffAddress.split(',')[0];
  sendPushNotification(
    driverTokens,
    'New job available! 🚐',
    `${pickup} → ${dropoff} · £${driverEarnings.toFixed(0)}`,
    { jobId: job.id }
  );

  return res.status(201).json(job);
}

// POST /api/jobs/:id/accept — driver accepts a job
async function acceptJob(req, res) {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });

  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status !== 'POSTED') return res.status(400).json({ error: 'This job is no longer available' });

  const updated = await prisma.job.update({
    where: { id: req.params.id },
    data: { driverId: req.user.id, status: 'ACCEPTED' },
  });

  // Notify the business
  const [business, driver] = await Promise.all([
    prisma.user.findUnique({ where: { id: job.businessId }, select: { pushToken: true } }),
    prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } }),
  ]);
  if (business?.pushToken) {
    sendPushNotification(
      business.pushToken,
      'Driver on the way! 🚐',
      `${driver.name} has accepted your job`,
      { jobId: req.params.id }
    );
  }

  return res.json(updated);
}

// POST /api/jobs/:id/collecting — driver has arrived at pickup
async function markCollecting(req, res) {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });

  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.driverId !== req.user.id) return res.status(403).json({ error: 'Not your job' });
  if (job.status !== 'ACCEPTED') return res.status(400).json({ error: 'Job must be ACCEPTED first' });

  const updated = await prisma.job.update({
    where: { id: req.params.id },
    data: { status: 'COLLECTING' },
  });

  // Notify business
  const business = await prisma.user.findUnique({ where: { id: job.businessId }, select: { pushToken: true } });
  const driver = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
  if (business?.pushToken) {
    sendPushNotification(
      business.pushToken,
      'Driver at pickup 📍',
      `${driver.name} has arrived and is collecting the items`,
      { jobId: req.params.id }
    );
  }

  return res.json(updated);
}

// POST /api/jobs/:id/transit — driver has collected and is en route
async function markInTransit(req, res) {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });

  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.driverId !== req.user.id) return res.status(403).json({ error: 'Not your job' });
  if (job.status !== 'COLLECTING') return res.status(400).json({ error: 'Job must be in COLLECTING status' });

  const updated = await prisma.job.update({
    where: { id: req.params.id },
    data: { status: 'IN_TRANSIT' },
  });

  // Notify business
  const business = await prisma.user.findUnique({ where: { id: job.businessId }, select: { pushToken: true } });
  if (business?.pushToken) {
    sendPushNotification(
      business.pushToken,
      'Out for delivery 🚚',
      `Your items have been collected and are on the way`,
      { jobId: req.params.id }
    );
  }

  return res.json(updated);
}

// POST /api/jobs/:id/deliver — driver marks as delivered with POD
async function deliverJob(req, res) {
  const { podPhotoUrl, podSignature } = req.body;

  const job = await prisma.job.findUnique({ where: { id: req.params.id } });

  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.driverId !== req.user.id) return res.status(403).json({ error: 'Not your job' });
  if (!['IN_TRANSIT', 'ACCEPTED', 'COLLECTING'].includes(job.status)) {
    return res.status(400).json({ error: 'Job must be active to mark as delivered' });
  }

  const updated = await prisma.job.update({
    where: { id: req.params.id },
    data: {
      status: 'DELIVERED',
      podPhotoUrl,
      podSignature,
      deliveredAt: new Date(),
    },
  });

  // Credit driver earnings and increment stats
  await prisma.driverProfile.update({
    where: { userId: req.user.id },
    data: {
      totalJobs: { increment: 1 },
      totalEarnings: { increment: job.driverEarnings },
      availableBalance: { increment: job.driverEarnings },
    },
  });

  // Notify business
  const business = await prisma.user.findUnique({ where: { id: job.businessId }, select: { pushToken: true } });
  if (business?.pushToken) {
    sendPushNotification(
      business.pushToken,
      'Delivered! 🎉',
      `Your job has been completed. Rate your driver in the app`,
      { jobId: req.params.id }
    );
  }

  return res.json(updated);
}

// POST /api/jobs/:id/cancel — business or driver cancels
async function cancelJob(req, res) {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });

  if (!job) return res.status(404).json({ error: 'Job not found' });

  const isOwner = job.businessId === req.user.id || job.driverId === req.user.id;
  if (!isOwner) return res.status(403).json({ error: 'Not authorised to cancel this job' });

  if (['DELIVERED', 'CANCELLED'].includes(job.status)) {
    return res.status(400).json({ error: 'Cannot cancel a completed or already cancelled job' });
  }

  const updated = await prisma.job.update({
    where: { id: req.params.id },
    data: { status: 'CANCELLED' },
  });

  return res.json(updated);
}

// POST /api/jobs/:id/rate — rate the other party after delivery
async function rateJob(req, res) {
  const { score, comment } = req.body;
  const { id: raterId, role } = req.user;

  if (!score || score < 1 || score > 5) {
    return res.status(400).json({ error: 'Score must be between 1 and 5' });
  }

  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });

    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'DELIVERED') return res.status(400).json({ error: 'Can only rate completed jobs' });

    // Driver rates the business, business rates the driver
    const ratedId = role === 'DRIVER' ? job.businessId : job.driverId;

    if (!ratedId) return res.status(400).json({ error: 'No one to rate' });

    const rating = await prisma.rating.create({
      data: { jobId: job.id, raterId, ratedId, score: Number(score), comment },
    });

    // Recalculate the rated user's average
    const allRatings = await prisma.rating.findMany({ where: { ratedId } });
    const avg = allRatings.reduce((sum, r) => sum + r.score, 0) / allRatings.length;

    if (role === 'DRIVER') {
      await prisma.businessProfile.update({
        where: { userId: ratedId },
        data: { averageRating: Math.round(avg * 10) / 10 },
      });
    } else {
      await prisma.driverProfile.update({
        where: { userId: ratedId },
        data: { averageRating: Math.round(avg * 10) / 10 },
      });
    }

    return res.status(201).json(rating);
  } catch (err) {
    console.error('rateJob error:', err);
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'You have already rated this job.' });
    }
    if (err.code === 'P2021') {
      return res.status(500).json({ error: 'Rating table not found. Run: npx prisma db push' });
    }
    return res.status(500).json({ error: err.message || 'Failed to submit rating.' });
  }
}

module.exports = {
  listAvailableJobs,
  myJobs,
  getJob,
  createJob,
  acceptJob,
  markCollecting,
  markInTransit,
  deliverJob,
  cancelJob,
  rateJob,
};
