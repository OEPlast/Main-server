import rateLimit from 'express-rate-limit';

const OTP_Limiter = rateLimit({
  windowMs: 6 * 60 * 1000, // 16 minutes
  limit: 1,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,
  ipv6Subnet: 56, // Set to 60 or 64 to be less aggressive, or 52 or 48 to be more aggressive
});

const RateLimits = { OTP_Limiter };
export default RateLimits;
