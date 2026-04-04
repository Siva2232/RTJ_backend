const ActivityLog = require('../models/ActivityLog');

/**
 * Log a user action — non-blocking, never throws.
 *
 * @param {Object} opts
 * @param {Object}  opts.user       - Mongoose user doc or { _id, name }
 * @param {string}  opts.action     - ActivityLog action enum value
 * @param {Object}  [opts.car]      - Car doc (for carInfo snapshot)
 * @param {Object}  [opts.details]  - Extra metadata object
 * @param {string}  [opts.ipAddress]
 */
const logActivity = async ({ user, action, car, details = {}, ipAddress }) => {
  try {
    await ActivityLog.create({
      user: user._id || user,
      userName: user.name || undefined,
      action,
      car: car?._id || car || undefined,
      carInfo: car
        ? `${car.brand} ${car.model} (${car.registrationNumber})`
        : undefined,
      details,
      ipAddress,
    });
  } catch (err) {
    // Never fail the main request because of a logging error
    console.error('[ActivityLog] Failed to write log:', err.message);
  }
};

module.exports = { logActivity };
