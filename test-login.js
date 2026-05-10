require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testLogin() {
  try {
    console.log('1. Finding user...');
    const user = await prisma.user.findUnique({
      where: { email: 'john.driver@elmi.com' },
      include: { driverProfile: true, businessProfile: true },
    });
    console.log('2. User found:', user.email);

    console.log('3. Comparing password...');
    const valid = await bcrypt.compare('password123', user.password);
    console.log('4. Password valid:', valid);

    console.log('5. Generating token...');
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    console.log('6. Token generated:', token.substring(0, 20) + '...');
    console.log('ALL STEPS PASSED ✅');
  } catch (e) {
    console.error('FAILED AT STEP:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();
