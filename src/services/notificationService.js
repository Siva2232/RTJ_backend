const Notification = require('../models/Notification');

/**
 * Send a notification to a specific user
 * @param {string} userId - ID of the user to notify
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - Notification type (e.g., 'sale_approved', 'sale_rejected')
 * @param {string} carId - Optional ID of the car related to the notification
 */
const sendNotification = async (userId, title, message, type = 'system', carId = null) => {
  try {
    await Notification.create({
      recipient: userId,
      title,
      message,
      type,
      relatedCar: carId
    });
  } catch (error) {
    console.error('Failed to send notification:', error.message);
  }
};

/**
 * Get user's notifications
 * @param {string} userId - User's ID
 * @param {number} limit - Max number of notifications to fetch
 */
const getNotifications = async (userId, limit = 20) => {
  return await Notification.find({ recipient: userId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

/**
 * Mark a notification as read
 * @param {string} notificationId - Notification's ID
 * @param {string} userId - Recipient's ID for authorization
 */
const markAsRead = async (notificationId, userId) => {
  return await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { isRead: true },
    { new: true }
  );
};

/**
 * Mark all user's notifications as read
 * @param {string} userId - User's ID
 */
const markAllAsRead = async (userId) => {
  return await Notification.updateMany(
    { recipient: userId, isRead: false },
    { isRead: true }
  );
};

module.exports = {
  sendNotification,
  getNotifications,
  markAsRead,
  markAllAsRead
};
