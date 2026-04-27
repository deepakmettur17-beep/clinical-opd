const rateLimit = require('express-rate-limit');
const { ApiError } = require('./errorMiddleware');

/**
 * Rate limiting for general API requests
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  handler: (req, res, next, options) => {
    next(new ApiError(429, options.message));
  }
});

/**
 * Stricter rate limiting for clinical endpoints
 */
const clinicalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 clinical evaluations per minute
  message: 'Clinical evaluation rate limit exceeded. Please slow down.',
  handler: (req, res, next, options) => {
    next(new ApiError(429, options.message));
  }
});

/**
 * RBAC Middleware
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, 'Unauthorized: Access denied for this role'));
    }
    next();
  };
};

module.exports = {
  apiLimiter,
  clinicalLimiter,
  authorize
};
