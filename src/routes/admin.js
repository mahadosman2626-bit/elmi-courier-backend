const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  listDrivers, verifyDriver,
  listBusinesses, verifyBusiness,
  getStats, listAllJobs, adminCancelJob,
} = require('../controllers/adminController');

router.get('/stats',                      requireAuth, requireRole('ADMIN'), getStats);
router.get('/drivers',                    requireAuth, requireRole('ADMIN'), listDrivers);
router.patch('/drivers/:userId/verify',   requireAuth, requireRole('ADMIN'), verifyDriver);
router.get('/businesses',                 requireAuth, requireRole('ADMIN'), listBusinesses);
router.patch('/businesses/:userId/verify',requireAuth, requireRole('ADMIN'), verifyBusiness);
router.get('/jobs',                       requireAuth, requireRole('ADMIN'), listAllJobs);
router.post('/jobs/:jobId/cancel',        requireAuth, requireRole('ADMIN'), adminCancelJob);

module.exports = router;
