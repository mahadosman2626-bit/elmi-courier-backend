require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.user.findUnique({ where: { email: 'john.driver@elmi.com' } })
  .then(u => console.log('Found user:', u ? u.email + ' role:' + u.role : 'NOT FOUND'))
  .catch(e => console.error('DB ERROR:', e.message))
  .finally(() => prisma.$disconnect());
