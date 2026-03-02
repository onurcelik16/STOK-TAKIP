import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many requests, please try again after 15 minutes.',
        code: 'RATE_LIMIT_EXCEEDED'
    }
});

export const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // Limit each IP to 60 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Rate limit exceeded.',
        code: 'RATE_LIMIT_EXCEEDED'
    }
});
