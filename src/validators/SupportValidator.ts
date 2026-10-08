import { body, param } from 'express-validator';
import { validate } from '@/middleware/validate';
import { CONTACT_TOPICS, TICKET_STATUSES } from '@/models/ContactTicket';

const contact = [
  body('name').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Please enter your name'),
  body('email').isEmail().withMessage('Please enter a valid email').normalizeEmail({ gmail_remove_dots: false }),
  body('phone').optional({ values: 'falsy' }).isString().trim().isLength({ max: 30 }),
  body('orderNumber').optional({ values: 'falsy' }).isString().trim().isLength({ max: 40 }),
  body('topic').isIn(CONTACT_TOPICS).withMessage(`topic must be one of ${CONTACT_TOPICS.join(', ')}`),
  body('message').isString().trim().isLength({ min: 10, max: 5000 }).withMessage('Please write at least 10 characters'),
  validate,
];

const stockAlert = [
  param('productId').isMongoId().withMessage('Invalid product id'),
  body('email').isEmail().withMessage('Please enter a valid email').normalizeEmail({ gmail_remove_dots: false }),
  body('attribute').optional({ values: 'null' }).isObject(),
  body('attribute.name').if(body('attribute').exists({ values: 'null' })).isString().trim().notEmpty(),
  body('attribute.value').if(body('attribute').exists({ values: 'null' })).isString().trim().notEmpty(),
  validate,
];

const idParam = [param('id').isMongoId().withMessage('Invalid id'), validate];

const ticketStatus = [
  param('id').isMongoId().withMessage('Invalid id'),
  body('status').isIn(TICKET_STATUSES).withMessage(`status must be one of ${TICKET_STATUSES.join(', ')}`),
  validate,
];

const ticketNote = [
  param('id').isMongoId().withMessage('Invalid id'),
  body('text').isString().trim().isLength({ min: 1, max: 5000 }).withMessage('Note text is required'),
  body('email').optional().isBoolean().toBoolean(),
  validate,
];

const pickup = (update: boolean) => [
  ...(update ? [param('id').isMongoId().withMessage('Invalid id')] : []),
  ...['name', 'address', 'city', 'state'].map((f) =>
    (update ? body(f).optional() : body(f).exists({ values: 'falsy' }).withMessage(`${f} is required`))
      .bail()
      .isString()
      .trim()
      .notEmpty()
      .withMessage(`${f} is required`)
  ),
  body('phone').optional().isString().trim(),
  body('hours').optional().isString().trim(),
  body('readyIn').optional().isString().trim(),
  body('active').optional().isBoolean(),
  body('order').optional().isInt(),
  validate,
];

const shippingOptions = [
  body('items').isArray({ min: 1, max: 100 }).withMessage('items must be a non-empty array'),
  body('items.*.productId').isMongoId().withMessage('Each item needs a valid productId'),
  body('items.*.qty').isInt({ min: 1 }).withMessage('Each item quantity must be at least 1').toInt(),
  body('items.*.selectedAttributes').optional().isArray(),
  body('address').optional().isObject(),
  body('address.country').optional().isString().trim(),
  body('address.state').optional().isString().trim(),
  body('address.city').optional().isString().trim(),
  body('address.lga').optional().isString().trim(),
  validate,
];

const SupportValidator = {
  shippingOptions,
  contact,
  stockAlert,
  idParam,
  ticketStatus,
  ticketNote,
  createPickup: pickup(false),
  updatePickup: pickup(true),
};
export default SupportValidator;
