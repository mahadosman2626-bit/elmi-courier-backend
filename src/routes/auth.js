const router = require('express').Router();
const { register, login, me, savePushToken, updateProfile, updateBusiness } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', requireAuth, me);
router.post('/push-token', requireAuth, savePushToken);
router.patch('/profile', requireAuth, updateProfile);
router.patch('/business', requireAuth, updateBusiness);

module.exports = router;
