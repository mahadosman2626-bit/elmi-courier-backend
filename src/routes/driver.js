const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { toggleStatus, earnings, withdraw, updateProfile } = require('../controllers/driverController');

router.patch('/status',  requireAuth, requireRole('DRIVER'), toggleStatus);
router.get('/earnings',  requireAuth, requireRole('DRIVER'), earnings);
router.post('/withdraw', requireAuth, requireRole('DRIVER'), withdraw);
router.patch('/profile', requireAuth, requireRole('DRIVER'), updateProfile);

module.exports = router;
