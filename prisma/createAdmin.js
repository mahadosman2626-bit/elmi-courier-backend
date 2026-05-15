const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@elmi.com';
  const password = process.env.ADMIN_PASSWORD || 'Elmi@Admin2024';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin already exists: ${email}`);
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name: 'Elmi Admin',
      email,
      phone: '00000000000',
      password: hashed,
      role: 'ADMIN',
    },
  });

  console.log(`✅ Admin account created`);
  console.log(`   Email:    ${user.email}`);
  console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'Elmi@Admin2024'}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
