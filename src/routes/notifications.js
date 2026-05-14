const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { listNotifications, unreadCount } = require('../controllers/notificationController');

router.get('/', requireAuth, listNotifications);
router.get('/unread-count', requireAuth, unreadCount);

module.exports = router;
