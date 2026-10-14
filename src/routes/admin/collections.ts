import express, { Request, Response } from 'express';
import { body, param } from 'express-validator';
import { authenticateUser, isAdmin, requirePermission } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { CollectionAdminService } from '@/services/catalog/collections';
import { CustomResponseType } from '@/types';

/** Storefront collections (mounted at /admin/collections). Uses the products permission. */
const router = express.Router();
router.use(authenticateUser, isAdmin);

const send = (label: string, run: (req: Request) => Promise<CustomResponseType<unknown>>) => async (req: Request, res: Response) => {
  try {
    const { message, data, code } = await run(req);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error(`Error in ${label}:`, error);
    return res.status(500).json({ message: 'Internal server error', data: null });
  }
};

const idParam = [param('id').isMongoId().withMessage('Invalid id'), validate];

const fields = (update: boolean) => [
  ...(update ? [param('id').isMongoId().withMessage('Invalid id')] : []),
  (update ? body('title').optional() : body('title')).isString().trim().isLength({ min: 1, max: 80 }).withMessage('title is required (at most 80 characters)'),
  body('slug').optional().isString().trim().isLength({ max: 80 }),
  body('description').optional().isString().trim().isLength({ max: 400 }),
  body('image').optional().isString().trim(),
  body('group').optional().isIn(['collections', 'gifting', 'men']).withMessage('group must be collections, gifting or men'),
  body('order').optional().isInt({ min: 0, max: 999 }).toInt(),
  body('showInMenu').optional().isBoolean().toBoolean(),
  body('active').optional().isBoolean().toBoolean(),
  body('mode').optional().isIn(['manual', 'rules']).withMessage('mode must be manual or rules'),
  body('products').optional().isArray({ max: 200 }),
  body('products.*').isMongoId().withMessage('products must be product ids'),
  body('rules').optional().isObject(),
  body('rules.categories').optional().isArray({ max: 20 }),
  body('rules.categories.*').isMongoId().withMessage('categories must be category ids'),
  body('rules.tags').optional().isArray({ max: 20 }),
  body('rules.tags.*').isString().trim().notEmpty(),
  body('rules.specs').optional().isArray({ max: 10 }),
  body('rules.specs.*.key').isString().trim().notEmpty().withMessage('specification key is required'),
  body('rules.specs.*.values').isArray({ min: 1, max: 20 }).withMessage('each specification needs at least one value'),
  body('rules.specs.*.values.*').isString().trim().notEmpty(),
  body('rules.minPrice').optional({ values: 'null' }).isFloat({ min: 0 }).toFloat(),
  body('rules.maxPrice').optional({ values: 'null' }).isFloat({ min: 0 }).toFloat(),
  validate,
];

router.get('/', requirePermission('products', 'read'), send('listCollections', () => CollectionAdminService.list()));
router.get('/:id', requirePermission('products', 'read'), ...idParam, send('getCollection', (req) => CollectionAdminService.get(req.params.id)));
router.post('/', requirePermission('products', 'create'), ...fields(false), send('createCollection', (req) => CollectionAdminService.create(req.body)));
router.patch('/:id', requirePermission('products', 'update'), ...fields(true), send('updateCollection', (req) => CollectionAdminService.update(req.params.id, req.body)));
router.delete('/:id', requirePermission('products', 'delete'), ...idParam, send('deleteCollection', (req) => CollectionAdminService.remove(req.params.id)));

export default router;
