const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { listDrivers, verifyDriver, listBusinesses, verifyBusiness } = require('../controllers/adminController');

router.get('/drivers', requireAuth, requireRole('ADMIN'), listDrivers);
router.patch('/drivers/:userId/verify', requireAuth, requireRole('ADMIN'), verifyDriver);
router.get('/businesses', requireAuth, requireRole('ADMIN'), listBusinesses);
router.patch('/businesses/:userId/verify', requireAuth, requireRole('ADMIN'), verifyBusiness);

module.exports = router;
