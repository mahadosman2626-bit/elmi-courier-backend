const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

async function register(req, res) {
  const { name, email, phone, password, role, businessName } = req.body;

  if (!name || !email || !phone || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (!['DRIVER', 'BUSINESS'].includes(role)) {
    return res.status(400).json({ error: 'Role must be DRIVER or BUSINESS' });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      password: hashedPassword,
      role,
      driverProfile: role === 'DRIVER' ? { create: { isApproved: true } } : undefined,
      businessProfile:
        role === 'BUSINESS'
          ? { create: { businessName: businessName || name } }
          : undefined,
    },
    include: {
      driverProfile: true,
      businessProfile: true,
    },
  });

  const token = generateToken(user);

  return res.status(201).json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      driverProfile: user.driverProfile,
      businessProfile: user.businessProfile,
    },
  });
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { driverProfile: true, businessProfile: true },
  });

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken(user);

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      driverProfile: user.driverProfile,
      businessProfile: user.businessProfile,
    },
  });
}

async function me(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { driverProfile: true, businessProfile: true },
  });

  if (!user) return res.status(404).json({ error: 'User not found' });

  return res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    driverProfile: user.driverProfile,
    businessProfile: user.businessProfile,
  });
}

async function savePushToken(req, res) {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });

  await prisma.user.update({
    where: { id: req.user.id },
    data: { pushToken: token },
  });

  return res.json({ ok: true });
}

async function updateProfile(req, res) {
  const { name, phone } = req.body;

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      name: name || undefined,
      phone: phone || undefined,
    },
    include: { driverProfile: true, businessProfile: true },
  });

  return res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    driverProfile: user.driverProfile,
    businessProfile: user.businessProfile,
  });
}

async function updateBusiness(req, res) {
  const { businessName } = req.body;

  if (!businessName) return res.status(400).json({ error: 'businessName is required' });

  const profile = await prisma.businessProfile.update({
    where: { userId: req.user.id },
    data: { businessName },
  });

  return res.json(profile);
}

async function uploadBusinessDocuments(req, res) {
  const { businessRegPhotoUrl, addressProofPhotoUrl } = req.body;

  const data = { documentsSubmittedAt: new Date() };
  if (businessRegPhotoUrl) data.businessRegPhotoUrl = businessRegPhotoUrl;
  if (addressProofPhotoUrl) data.addressProofPhotoUrl = addressProofPhotoUrl;

  const profile = await prisma.businessProfile.update({
    where: { userId: req.user.id },
    data,
  });

  // Notify all admins
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', pushToken: { not: null } },
    select: { pushToken: true },
  });
  const { sendPushNotification } = require('../utils/notifications');
  const business = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
  sendPushNotification(
    admins.map((a) => a.pushToken),
    'Business Docs Submitted 📋',
    `${business.name} has submitted documents for review`,
    { businessId: req.user.id }
  );

  return res.json(profile);
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed } });

  return res.json({ ok: true });
}

module.exports = { register, login, me, savePushToken, updateProfile, updateBusiness, uploadBusinessDocuments, changePassword };
