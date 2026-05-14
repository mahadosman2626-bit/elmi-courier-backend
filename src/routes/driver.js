const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { toggleStatus, earnings, withdraw, updateProfile, uploadDocuments } = require('../controllers/driverController');

router.patch('/status',    requireAuth, requireRole('DRIVER'), toggleStatus);
router.get('/earnings',    requireAuth, requireRole('DRIVER'), earnings);
router.post('/withdraw',   requireAuth, requireRole('DRIVER'), withdraw);
router.patch('/profile',   requireAuth, requireRole('DRIVER'), updateProfile);
router.patch('/documents', requireAuth, requireRole('DRIVER'), uploadDocuments);

module.exports = router;
