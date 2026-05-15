const { PrismaClient } = require('@prisma/client');
const { sendPushNotification } = require('../utils/notifications');

const prisma = new PrismaClient();

// GET /api/admin/drivers — all drivers with their doc status
async function listDrivers(req, res) {
  const drivers = await prisma.user.findMany({
    where: { role: 'DRIVER' },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      driverProfile: {
        select: {
          isApproved: true,
          licenceVerified: true,
          insuranceVerified: true,
          gitVerified: true,
          licencePhotoUrl: true,
          insurancePhotoUrl: true,
          gitPhotoUrl: true,
          documentsSubmittedAt: true,
          vanType: true,
          vanRegistration: true,
          totalJobs: true,
          averageRating: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(drivers);
}

// PATCH /api/admin/drivers/:userId/verify — verify or reject individual documents
async function verifyDriver(req, res) {
  const { userId } = req.params;
  const { licenceVerified, insuranceVerified, gitVerified, isApproved } = req.body;

  const data = {};
  if (typeof licenceVerified === 'boolean') data.licenceVerified = licenceVerified;
  if (typeof insuranceVerified === 'boolean') data.insuranceVerified = insuranceVerified;
  if (typeof gitVerified === 'boolean') data.gitVerified = gitVerified;
  if (typeof isApproved === 'boolean') data.isApproved = isApproved;

  const profile = await prisma.driverProfile.update({
    where: { userId },
    data,
  });

  // Notify the driver
  const driver = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushToken: true },
  });

  if (driver?.pushToken) {
    const allVerified = profile.licenceVerified && profile.insuranceVerified && profile.gitVerified;
    sendPushNotification(
      driver.pushToken,
      allVerified ? 'Documents Verified ✅' : 'Document Update',
      allVerified
        ? 'All your documents are verified. You can now take jobs!'
        : 'One or more documents need attention. Check your profile.',
      {}
    );
  }

  return res.json(profile);
}

async function listBusinesses(req, res) {
  const businesses = await prisma.user.findMany({
    where: { role: 'BUSINESS' },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      businessProfile: {
        select: {
          businessName: true,
          isVerified: true,
          businessRegPhotoUrl: true,
          addressProofPhotoUrl: true,
          documentsSubmittedAt: true,
          totalJobs: true,
          averageRating: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(businesses);
}

async function verifyBusiness(req, res) {
  const { userId } = req.params;
  const { isVerified } = req.body;

  const profile = await prisma.businessProfile.update({
    where: { userId },
    data: { isVerified },
  });

  const business = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushToken: true },
  });

  if (business?.pushToken) {
    sendPushNotification(
      business.pushToken,
      isVerified ? 'Business Verified ✅' : 'Verification Update',
      isVerified
        ? 'Your business has been verified. You can now post jobs!'
        : 'Your business verification was not approved. Please resubmit your documents.',
      {}
    );
  }

  return res.json(profile);
}

// GET /api/admin/stats — platform-wide overview numbers
async function getStats(req, res) {
  const [
    totalJobs,
    deliveredJobs,
    cancelledJobs,
    activeJobs,
    totalDrivers,
    totalBusinesses,
    pendingDrivers,
    pendingBusinesses,
    revenue,
  ] = await Promise.all([
    prisma.job.count(),
    prisma.job.count({ where: { status: 'DELIVERED' } }),
    prisma.job.count({ where: { status: 'CANCELLED' } }),
    prisma.job.count({ where: { status: { in: ['POSTED', 'ACCEPTED', 'COLLECTING', 'IN_TRANSIT'] } } }),
    prisma.user.count({ where: { role: 'DRIVER' } }),
    prisma.user.count({ where: { role: 'BUSINESS' } }),
    prisma.driverProfile.count({
      where: { documentsSubmittedAt: { not: null }, isApproved: false },
    }),
    prisma.businessProfile.count({
      where: { documentsSubmittedAt: { not: null }, isVerified: false },
    }),
    prisma.job.aggregate({
      _sum: { totalPrice: true },
      where: { status: 'DELIVERED' },
    }),
  ]);

  return res.json({
    totalJobs,
    deliveredJobs,
    cancelledJobs,
    activeJobs,
    totalDrivers,
    totalBusinesses,
    pendingVerifications: pendingDrivers + pendingBusinesses,
    totalRevenue: revenue._sum.totalPrice || 0,
  });
}

// GET /api/admin/jobs — every job on the platform
async function listAllJobs(req, res) {
  const jobs = await prisma.job.findMany({
    include: {
      business: {
        select: {
          id: true,
          name: true,
          businessProfile: { select: { businessName: true } },
        },
      },
      driver: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(jobs);
}

// POST /api/admin/jobs/:jobId/cancel — admin force-cancels a job
async function adminCancelJob(req, res) {
  const job = await prisma.job.findUnique({ where: { id: req.params.jobId } });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (['DELIVERED', 'CANCELLED'].includes(job.status)) {
    return res.status(400).json({ error: 'Job is already finished or cancelled' });
  }

  const updated = await prisma.job.update({
    where: { id: req.params.jobId },
    data: { status: 'CANCELLED' },
  });

  return res.json(updated);
}

module.exports = { listDrivers, verifyDriver, listBusinesses, verifyBusiness, getStats, listAllJobs, adminCancelJob };
