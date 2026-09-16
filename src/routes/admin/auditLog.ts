import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import AdminAuditLog from '@/models/AdminAuditLog';
import { authenticateUser, isAdmin, requirePermission } from '@/middleware/auth';

const router = express.Router();

router.use(authenticateUser, isAdmin);

/**
 * GET /admin/audit-log
 * Who changed what. Filters: userId, resource, targetId, method, from, to; page, limit (max 100).
 */
router.get('/', requirePermission('settings', 'read'), async (req: Request, res: Response) => {
  try {
    const { userId, resource, targetId, method, from, to } = req.query as Record<string, string | undefined>;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));

    const filter: Record<string, unknown> = {};
    if (userId && mongoose.Types.ObjectId.isValid(userId)) filter['actor.userId'] = new mongoose.Types.ObjectId(userId);
    if (resource) filter.resource = String(resource).slice(0, 50);
    if (targetId) filter.targetId = String(targetId).slice(0, 50);
    if (method) filter.method = String(method).toUpperCase().slice(0, 10);
    if (from || to) {
      const range: Record<string, Date> = {};
      if (from && !Number.isNaN(Date.parse(from))) range.$gte = new Date(from);
      if (to && !Number.isNaN(Date.parse(to))) range.$lte = new Date(to);
      if (Object.keys(range).length) filter.createdAt = range;
    }

    const [entries, total] = await Promise.all([
      AdminAuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('actor.userId', 'firstName lastName email')
        .lean(),
      AdminAuditLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      message: 'Audit log fetched',
      data: entries,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return res.status(500).json({ message: 'Failed to fetch audit log', data: null, code: 500 });
  }
});

export default router;
