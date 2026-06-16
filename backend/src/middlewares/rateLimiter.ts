import rateLimit from 'express-rate-limit';

// General rate limiter for standard endpoints
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});

// Stricter rate limiter for auth routes (login, register) and AI generation
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 auth attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many authentication attempts, please try again after 15 minutes',
  },
});

// Limiter for file upload and AI generation
export const aiGenerationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 generations per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many requests for AI generation. Please wait a minute.',
  },
});
