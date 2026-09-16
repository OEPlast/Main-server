import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateUser } from '@/middleware/auth';
import RateLimits from '@/middleware/rate';
import type { AuthenticatedRequest } from '@/types';
import {
  buildDataExport,
  cancelAccountDeletion,
  getDeletionStatus,
  requestAccountDeletion,
} from '@/services/users/accountDeletion';
import { logger } from '@/lib/logger';

const router = Router();
router.use(authenticateUser);

const userIdOf = (req: Request) => (req as AuthenticatedRequest).userId!;

/** GET /user/account/deletion: whether deletion is scheduled, and anything blocking it. */
router.get('/deletion', async (req: Request, res: Response) => {
  const status = await getDeletionStatus(userIdOf(req));
  if (!status) return res.status(404).json({ message: 'Account not found', data: null, code: 404 });
  return res.status(200).json({ message: 'Deletion status', data: status, code: 200 });
});

/** POST /user/account/deletion { confirmation: 'DELETE', password? }: schedule deletion after the grace period. */
router.post(
  '/deletion',
  RateLimits.AccountDanger_Limiter,
  body('confirmation').isString().withMessage('Type DELETE to confirm'),
  body('password').optional().isString(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg, data: null, code: 400 });
    try {
      const result = await requestAccountDeletion(userIdOf(req), {
        confirmation: req.body.confirmation,
        password: req.body.password,
      });
      if (result.code === 200) logger.info(`[account-deletion] scheduled for user ${userIdOf(req)}`);
      return res.status(result.code).json(result);
    } catch (error) {
      logger.error('Account deletion request failed:', error);
      return res.status(500).json({ message: 'Could not schedule deletion', data: null, code: 500 });
    }
  }
);

/** DELETE /user/account/deletion: cancel a scheduled deletion. */
router.delete('/deletion', async (req: Request, res: Response) => {
  const result = await cancelAccountDeletion(userIdOf(req));
  if (result.code === 200) logger.info(`[account-deletion] cancelled by user ${userIdOf(req)}`);
  return res.status(result.code).json(result);
});

/** GET /user/account/export: a JSON copy of the customer's personal data. */
router.get('/export', RateLimits.AccountDanger_Limiter, async (req: Request, res: Response) => {
  try {
    const data = await buildDataExport(userIdOf(req));
    if (!data) return res.status(404).json({ message: 'Account not found', data: null, code: 404 });
    res.setHeader('Content-Disposition', `attachment; filename="my-data-${new Date().toISOString().slice(0, 10)}.json"`);
    return res.status(200).json({ message: 'Your data', data, code: 200 });
  } catch (error) {
    logger.error('Data export failed:', error);
    return res.status(500).json({ message: 'Could not prepare your data', data: null, code: 500 });
  }
});

export default router;
