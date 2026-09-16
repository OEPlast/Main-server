import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';
import { AuthenticatedRequest } from '@/types';

const OTP_Limiter = rateLimit({
  windowMs: 1.5 * 60 * 1000, // 1.5 minutes
  limit: 1,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,
  ipv6Subnet: 56, // Set to 60 or 64 to be less aggressive, or 52 or 48 to be more aggressive
});

// Guest checkout is an unauthenticated endpoint that reserves stock: every placed order holds
// inventory until payment succeeds or the payment timeout releases it. Without a limit, anyone can
// hold the whole catalogue in unpaid orders. Signed-in shoppers are skipped — they are already
// accountable — so this must run AFTER the optional auth middleware has had the chance to set userId.
//
// Deliberately generous: Nigerian mobile carriers put many customers behind one IP (CGNAT), and a
// single honest checkout can POST several times while accepting price or stock corrections.
const GuestCheckout_Limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  ipv6Subnet: 56,
  skip: (req: Request) => !!(req as AuthenticatedRequest).userId,
  message: { message: 'Too many checkout attempts. Please wait a few minutes and try again.' },
});

/**
 * Per-IP-and-account key. Keying on the IP alone would lock out every customer behind the same
 * carrier NAT once one of them mistypes; keying on the account alone would let one attacker
 * lock anyone out. Together, an attacker is limited per target without collateral.
 */
const ipAndAccountKey = (req: Request): string => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const account = email || (req as AuthenticatedRequest).userId || '';
  return `${ipKeyGenerator(req.ip ?? '', 56)}|${account}`;
};

// Password guessing. Generous enough for a forgotten password, far too slow for a wordlist.
const Login_Limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipAndAccountKey,
  message: { message: 'Too many sign-in attempts. Please wait 15 minutes and try again.' },
});

// Emailed-code checks (password reset, account verification). The per-code attempt limit in
// OTPService is the main defence; this stops one client hammering new codes as they arrive.
const CodeCheck_Limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipAndAccountKey,
  message: { message: 'Too many code attempts. Please wait 15 minutes and request a new code.' },
});

// Account creation. Per IP only, and loose, because of carrier NAT.
const Register_Limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  ipv6Subnet: 56,
  message: { message: 'Too many accounts created from this network. Please try again later.' },
});

// Newsletter signups. Per IP and address: generous for shared carrier IPs, too slow to spam.
const Newsletter_Limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipAndAccountKey,
  message: { message: 'Too many signup attempts. Please try again later.' },
});

// Public order lookup by order number + email. Keyed per IP and email so one client cannot walk
// through order numbers, while customers behind the same carrier IP are not blocked together.
const OrderLookup_Limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipAndAccountKey,
  message: { message: 'Too many lookups. Please wait 15 minutes and try again.' },
});

// Account deletion requests (password checked) and data exports (a heavy read of everything).
const AccountDanger_Limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipAndAccountKey,
  message: { message: 'Too many attempts. Please try again in an hour.' },
});

const RateLimits = {
  OTP_Limiter,
  GuestCheckout_Limiter,
  Login_Limiter,
  CodeCheck_Limiter,
  Register_Limiter,
  Newsletter_Limiter,
  OrderLookup_Limiter,
  AccountDanger_Limiter,
};
export default RateLimits;
