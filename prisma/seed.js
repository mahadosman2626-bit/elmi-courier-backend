require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create driver accounts
  const driverPassword = await bcrypt.hash('password123', 12);

  const driver1 = await prisma.user.upsert({
    where: { email: 'john.driver@elmi.com' },
    update: {},
    create: {
      name: 'John Smith',
      email: 'john.driver@elmi.com',
      phone: '+44 7700 111111',
      password: driverPassword,
      role: 'DRIVER',
      driverProfile: {
        create: {
          vanType: 'Large Van',
          vanRegistration: 'BM21 ABC',
          vanYear: '2021',
          licenceVerified: true,
          insuranceVerified: true,
          gitVerified: true,
          isOnline: true,
          isApproved: true,
          averageRating: 4.9,
          totalJobs: 34,
          totalEarnings: 2400,
          availableBalance: 200.70,
        },
      },
    },
  });

  const driver2 = await prisma.user.upsert({
    where: { email: 'mike.driver@elmi.com' },
    update: {},
    create: {
      name: 'Mike Taylor',
      email: 'mike.driver@elmi.com',
      phone: '+44 7700 222222',
      password: driverPassword,
      role: 'DRIVER',
      driverProfile: {
        create: {
          vanType: 'Small Van',
          vanRegistration: 'WM20 XYZ',
          vanYear: '2020',
          licenceVerified: true,
          insuranceVerified: true,
          gitVerified: true,
          isOnline: true,
          isApproved: true,
          averageRating: 4.7,
          totalJobs: 21,
          totalEarnings: 1580,
          availableBalance: 54.00,
        },
      },
    },
  });

  // Create business accounts
  const bizPassword = await bcrypt.hash('password123', 12);

  const biz1 = await prisma.user.upsert({
    where: { email: 'admin@smithsupplies.com' },
    update: {},
    create: {
      name: 'Smith Supplies Ltd',
      email: 'admin@smithsupplies.com',
      phone: '+44 121 000 0001',
      password: bizPassword,
      role: 'BUSINESS',
      businessProfile: {
        create: {
          businessName: 'Smith Supplies Ltd',
          isVerified: true,
          totalJobs: 18,
          totalSpend: 720,
          averageRating: 4.8,
        },
      },
    },
  });

  const biz2 = await prisma.user.upsert({
    where: { email: 'ops@urbanstore.com' },
    update: {},
    create: {
      name: 'Urban Store',
      email: 'ops@urbanstore.com',
      phone: '+44 121 000 0002',
      password: bizPassword,
      role: 'BUSINESS',
      businessProfile: {
        create: {
          businessName: 'Urban Store',
          isVerified: true,
          totalJobs: 9,
          totalSpend: 360,
          averageRating: 4.6,
        },
      },
    },
  });

  // Create sample open jobs
  await prisma.job.createMany({
    data: [
      {
        businessId: biz1.id,
        pickupAddress: 'Birmingham City Centre, B1 1BB',
        pickupContact: 'Sarah Jones',
        dropoffAddress: 'Coventry City Centre, CV1 1JN',
        dropoffContact: 'Tom Brown',
        loadDescription: 'Flat-pack furniture (3 boxes, approx 40kg)',
        vanSize: 'Large Van',
        urgency: 'ASAP',
        status: 'POSTED',
        totalPrice: 45,
        platformFee: 5.40,
        driverEarnings: 39.60,
      },
      {
        businessId: biz1.id,
        pickupAddress: 'Solihull, B91 3RH',
        pickupContact: 'Dave Harris',
        dropoffAddress: 'Wolverhampton, WV1 1DT',
        dropoffContact: 'Lisa Cole',
        loadDescription: 'Catering equipment — 4 bags, 2 boxes',
        vanSize: 'Any Van',
        urgency: 'Today',
        status: 'POSTED',
        totalPrice: 60,
        platformFee: 7.20,
        driverEarnings: 52.80,
      },
      {
        businessId: biz2.id,
        pickupAddress: 'Aston, Birmingham, B6 5RQ',
        pickupContact: 'Mark Evans',
        dropoffAddress: 'Leicester City Centre, LE1 1TY',
        dropoffContact: 'Nina Patel',
        loadDescription: 'Stock boxes (20 units, clothing)',
        vanSize: 'Large Van',
        urgency: 'Tomorrow',
        status: 'POSTED',
        totalPrice: 90,
        platformFee: 10.80,
        driverEarnings: 79.20,
      },
      {
        businessId: biz2.id,
        pickupAddress: 'Erdington, Birmingham, B23 6SJ',
        pickupContact: 'Chris Wall',
        dropoffAddress: 'Walsall Town Centre, WS1 1DG',
        dropoffContact: 'Amy Grant',
        loadDescription: 'Single pallet — electrical goods',
        vanSize: 'Small Van',
        urgency: 'Today',
        status: 'POSTED',
        totalPrice: 28,
        platformFee: 3.36,
        driverEarnings: 24.64,
      },
    ],
  });

  console.log('✅ Seed complete!\n');
  console.log('Test accounts:');
  console.log('  Driver:   john.driver@elmi.com   / password123');
  console.log('  Driver:   mike.driver@elmi.com   / password123');
  console.log('  Business: admin@smithsupplies.com / password123');
  console.log('  Business: ops@urbanstore.com     / password123\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
