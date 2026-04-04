const router = require('express').Router();
const {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getUserNotifications);
router.patch('/:id/read', protect, markNotificationRead);
router.post('/read-all', protect, markAllNotificationsRead);

module.exports = router;
