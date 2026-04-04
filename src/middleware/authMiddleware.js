const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../utils/generateToken');
const User = require('../models/User');

/**
 * protect — verifies JWT and attaches req.user.
 * Throws 401 if no token, invalid token, or user no longer exists.
 */
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new ApiError(401, 'Access denied. No token provided.'));
  }

  // verifyToken throws on invalid/expired — caught by globalErrorHandler
  const decoded = verifyToken(token);

  const user = await User.findById(decoded.id).select('-password');

  if (!user) {
    return next(new ApiError(401, 'The user belonging to this token no longer exists.'));
  }

  if (!user.isActive) {
    return next(new ApiError(403, 'Your account has been deactivated. Contact an admin.'));
  }

  req.user = user;
  next();
};

/**
 * authorizeRoles(...roles) — restrict route to specific roles.
 * Must be used after protect.
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return next(
        new ApiError(
          403,
          `Role '${req.user?.role}' is not authorized to access this resource.`
        )
      );
    }
    next();
  };
};

module.exports = { protect, authorizeRoles };
