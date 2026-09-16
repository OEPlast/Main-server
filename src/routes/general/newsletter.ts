import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateUserIfTokenSent } from '@/middleware/auth';
import RateLimits from '@/middleware/rate';
import type { AuthenticatedRequest } from '@/types';
import { subscribeToNewsletter } from '@/services/email/newsletter';
import { logger } from '@/lib/logger';

const router = Router();

/**
 * POST /newsletter/subscribe { email, source? }
 *
 * Backs the newsletter forms, which used to be `<form action="post">` and sent nothing anywhere.
 * Always answers the same success message whether or not the address has an account, so the
 * endpoint cannot be used to find out who is a customer.
 */
router.post(
  '/subscribe',
  authenticateUserIfTokenSent,
  RateLimits.Newsletter_Limiter,
  body('email').isEmail().withMessage('Enter a valid email address').bail().normalizeEmail({ gmail_remove_dots: false }),
  body('source').optional().isIn(['footer', 'about', 'account', 'checkout']).withMessage('Unknown signup source'),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg, data: null, code: 400 });
    }
    try {
      await subscribeToNewsletter({
        email: String(req.body.email),
        userId: (req as AuthenticatedRequest).userId,
        source: String(req.body.source ?? 'footer'),
      });
      return res.status(200).json({ message: "You're subscribed. Thanks for joining!", data: null, code: 200 });
    } catch (error) {
      logger.error('Newsletter subscribe failed:', error);
      return res.status(500).json({ message: 'Could not subscribe right now. Please try again.', data: null, code: 500 });
    }
  }
);

export default router;
