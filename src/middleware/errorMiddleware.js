const ApiError = require('../utils/ApiError');

// ─── Mongoose / DB error converters ──────────────────────────────────────────

const handleCastError = (err) =>
  new ApiError(400, `Invalid value for field '${err.path}': ${err.value}`);

const handleDuplicateKey = (err) => {
  const field = Object.keys(err.keyPattern || {})[0] || 'field';
  const value = err.keyValue?.[field] || 'unknown';
  return new ApiError(
    409,
    `Duplicate value: '${value}' already exists for '${field}'.`
  );
};

const handleValidationError = (err) => {
  const messages = Object.values(err.errors).map((e) => e.message);
  return new ApiError(422, messages.join('. '));
};

// ─── JWT error converters ─────────────────────────────────────────────────────

const handleJWTError = () =>
  new ApiError(401, 'Invalid token. Please log in again.');

const handleJWTExpired = () =>
  new ApiError(401, 'Your session has expired. Please log in again.');

// ─── Global Error Handler ─────────────────────────────────────────────────────

const globalErrorHandler = (err, req, res, next) => {
  let error = Object.assign(new ApiError(err.statusCode || 500, err.message), err);
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  if (err.name === 'CastError') error = handleCastError(err);
  if (err.code === 11000) error = handleDuplicateKey(err);
  if (err.name === 'ValidationError') error = handleValidationError(err);
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpired();

  if (process.env.NODE_ENV === 'development') {
    console.error('──── ERROR ────');
    console.error(err);
  }

  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: error.message || 'Internal Server Error',
    ...(error.errors?.length && { errors: error.errors }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// ─── 404 Handler ─────────────────────────────────────────────────────────────

const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

module.exports = { globalErrorHandler, notFound };
