const {
  getNotifications,
  markAsRead,
  markAllAsRead
} = require('../services/notificationService');
const { sendSuccess } = require('../utils/ApiResponse');

// GET /api/notifications
const getUserNotifications = async (req, res) => {
  const notifications = await getNotifications(req.user._id, 50);
  return sendSuccess(res, 200, { notifications }, 'Fetched user notifications');
};

// PATCH /api/notifications/:id/read
const markNotificationRead = async (req, res) => {
  const notification = await markAsRead(req.params.id, req.user._id);
  return sendSuccess(res, 200, { notification }, 'Notification marked as read');
};

// POST /api/notifications/read-all
const markAllNotificationsRead = async (req, res) => {
  await markAllAsRead(req.user._id);
  return sendSuccess(res, 200, null, 'All notifications marked as read');
};

module.exports = {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead
};
