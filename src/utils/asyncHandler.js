/**
 * Wraps async route handlers to automatically catch errors
 * and forward them to Express error middleware.
 * express-async-errors is the primary mechanism — this
 * utility is available for explicit use in service functions.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
