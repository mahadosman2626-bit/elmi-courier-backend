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

module.exports = { listDrivers, verifyDriver };
