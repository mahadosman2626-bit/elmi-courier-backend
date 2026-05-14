const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { listDrivers, verifyDriver } = require('../controllers/adminController');

router.get('/drivers', requireAuth, requireRole('ADMIN'), listDrivers);
router.patch('/drivers/:userId/verify', requireAuth, requireRole('ADMIN'), verifyDriver);

module.exports = router;
