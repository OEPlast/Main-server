import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import User from '@/models/User';
import { authenticateUser } from '@/middleware/auth';
import type { AuthenticatedRequest } from '@/types';
import { logger } from '@/lib/logger';

const router = Router();
router.use(authenticateUser);

/**
 * GET/PUT /user/email-preferences
 *
 * The unsubscribe page sends people to "manage your email preferences" in their account, and the
 * account had no such setting. Marketing only: order, delivery and security email always sends.
 */
router.get('/', async (req: Request, res: Response) => {
  const user = await User.findById((req as AuthenticatedRequest).userId).select('emailPreferences').lean();
  if (!user) return res.status(404).json({ message: 'User not found', data: null, code: 404 });
  return res.status(200).json({
    message: 'Email preferences',
    code: 200,
    data: {
      marketing: user.emailPreferences?.marketing !== false,
      unsubscribedAt: user.emailPreferences?.unsubscribedAt ?? null,
      subscribedAt: user.emailPreferences?.subscribedAt ?? null,
    },
  });
});

router.put('/', body('marketing').isBoolean({ strict: true }).withMessage('marketing must be true or false'), async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg, data: null, code: 400 });
  try {
    const marketing = req.body.marketing === true;
    const now = new Date();
    await User.updateOne(
      { _id: (req as AuthenticatedRequest).userId },
      {
        $set: marketing
          ? { 'emailPreferences.marketing': true, 'emailPreferences.unsubscribedAt': null, 'emailPreferences.subscribedAt': now, 'emailPreferences.source': 'account' }
          : { 'emailPreferences.marketing': false, 'emailPreferences.unsubscribedAt': now },
      }
    );
    return res.status(200).json({
      message: marketing ? "You'll receive offers and news by email." : "You won't receive marketing email.",
      data: { marketing },
      code: 200,
    });
  } catch (error) {
    logger.error('Updating email preferences failed:', error);
    return res.status(500).json({ message: 'Could not save your preferences', data: null, code: 500 });
  }
});

export default router;
