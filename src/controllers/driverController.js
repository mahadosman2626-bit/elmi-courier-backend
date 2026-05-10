const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// PATCH /api/driver/status — toggle online/offline
async function toggleStatus(req, res) {
  const { isOnline } = req.body;

  if (typeof isOnline !== 'boolean') {
    return res.status(400).json({ error: 'isOnline must be true or false' });
  }

  const profile = await prisma.driverProfile.update({
    where: { userId: req.user.id },
    data: { isOnline },
  });

  return res.json({ isOnline: profile.isOnline });
}

// GET /api/driver/earnings — earnings summary
async function earnings(req, res) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId: req.user.id },
  });

  if (!profile) return res.status(404).json({ error: 'Driver profile not found' });

  // Jobs completed this week (Mon–Sun)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  // Jobs completed this month
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const weekJobs = await prisma.job.findMany({
    where: {
      driverId: req.user.id,
      status: 'DELIVERED',
      deliveredAt: { gte: monday },
    },
    select: { id: true, driverEarnings: true, pickupAddress: true, dropoffAddress: true, deliveredAt: true },
    orderBy: { deliveredAt: 'desc' },
  });

  const monthJobs = await prisma.job.findMany({
    where: {
      driverId: req.user.id,
      status: 'DELIVERED',
      deliveredAt: { gte: firstOfMonth },
    },
    select: { id: true, driverEarnings: true, deliveredAt: true },
  });

  const weekEarnings = weekJobs.reduce((sum, j) => sum + j.driverEarnings, 0);
  const monthEarnings = monthJobs.reduce((sum, j) => sum + j.driverEarnings, 0);

  return res.json({
    availableBalance: profile.availableBalance,
    totalEarnings: profile.totalEarnings,
    totalJobs: profile.totalJobs,
    weekEarnings: Math.round(weekEarnings * 100) / 100,
    weekJobs: weekJobs.length,
    monthEarnings: Math.round(monthEarnings * 100) / 100,
    monthJobs: monthJobs.length,
    recentJobs: weekJobs,
  });
}

// POST /api/driver/withdraw — request withdrawal (placeholder — Stripe in next phase)
async function withdraw(req, res) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId: req.user.id },
  });

  if (!profile) return res.status(404).json({ error: 'Driver profile not found' });

  if (profile.availableBalance <= 0) {
    return res.status(400).json({ error: 'No balance available to withdraw' });
  }

  // In production this would trigger a Stripe payout
  const withdrawn = profile.availableBalance;

  await prisma.driverProfile.update({
    where: { userId: req.user.id },
    data: { availableBalance: 0 },
  });

  return res.json({
    message: `Withdrawal of £${withdrawn.toFixed(2)} initiated. Funds will arrive in 1–2 business days.`,
    withdrawn,
  });
}

// PATCH /api/driver/profile — update van details
async function updateProfile(req, res) {
  const { vanType, vanRegistration, vanYear } = req.body;

  const profile = await prisma.driverProfile.update({
    where: { userId: req.user.id },
    data: {
      vanType: vanType || undefined,
      vanRegistration: vanRegistration || undefined,
      vanYear: vanYear || undefined,
    },
  });

  return res.json(profile);
}

module.exports = { toggleStatus, earnings, withdraw, updateProfile };
