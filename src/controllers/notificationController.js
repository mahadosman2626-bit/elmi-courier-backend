const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function saveNotification(userId, title, body, type, jobId = null) {
  try {
    await prisma.notification.create({
      data: { userId, title, body, type, jobId },
    });
  } catch (err) {
    console.error('Failed to save notification:', err.message);
  }
}

async function listNotifications(req, res) {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Mark all as read
  await prisma.notification.updateMany({
    where: { userId: req.user.id, read: false },
    data: { read: true },
  });

  return res.json(notifications);
}

async function unreadCount(req, res) {
  const count = await prisma.notification.count({
    where: { userId: req.user.id, read: false },
  });
  return res.json({ count });
}

module.exports = { saveNotification, listNotifications, unreadCount };
