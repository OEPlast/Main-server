import { body, param } from 'express-validator';
import { validate } from '@/middleware/validate';

const BLOCK_TYPES = ['lead', 'heading', 'paragraph', 'quote', 'image'];
/** Required on create; on update only checked when sent. */
const field = (name: string, update: boolean, message: string) =>
  (update ? body(name).optional() : body(name).exists({ values: 'falsy' }).withMessage(message)).bail();

export const idParam = [param('id').isMongoId().withMessage('Invalid id'), validate];

const article = (update: boolean) => [
  ...(update ? [param('id').isMongoId().withMessage('Invalid id')] : []),
  field('title', update, 'title is required')
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('title is required (max 200 characters)'),
  body('slug').optional().isString().trim().isLength({ max: 200 }),
  body('excerpt').optional().isString().isLength({ max: 500 }).withMessage('excerpt must be at most 500 characters'),
  body('category').optional().isString().trim(),
  body('image').optional().isString(),
  body('status').optional().isIn(['draft', 'published']).withMessage('status must be draft or published'),
  body('publishedAt').optional({ values: 'null' }).isISO8601().withMessage('publishedAt must be a date'),
  body('body').optional().isArray(),
  body('body.*.type').isIn(BLOCK_TYPES).withMessage(`block type must be one of ${BLOCK_TYPES.join(', ')}`),
  body('body.*.text').optional().isString(),
  body('body.*.src').optional().isString(),
  body('body.*.alt').optional().isString(),
  body('body.*')
    .custom((block) => (block.type === 'image' ? !!block.src : !!block.text?.trim()))
    .withMessage('image blocks need src; text blocks need text'),
  body('seo.title').optional().isString().isLength({ max: 70 }),
  body('seo.description').optional().isString().isLength({ max: 160 }),
  validate,
];

const siteContent = [
  body('testimonials').optional().isArray({ max: 50 }),
  body('testimonials.*.quote').isString().trim().notEmpty().withMessage('testimonial quote is required'),
  body('testimonials.*.author').isString().trim().notEmpty().withMessage('testimonial author is required'),
  body('instagram').optional().isArray({ max: 24 }),
  body('instagram.*.image').isString().notEmpty().withMessage('instagram image is required'),
  body('instagram.*.link').optional().isString(),
  body('popularSearches').optional().isArray({ max: 20 }),
  body('popularSearches.*').isString().trim().notEmpty(),
  body('articleCategories').optional().isArray({ max: 20 }),
  body('articleCategories.*.value').isString().trim().notEmpty(),
  body('articleCategories.*.label').isString().trim().notEmpty(),
  body('newsletterPopup.enabled').optional().isBoolean(),
  body('newsletterPopup.headline').optional().isString(),
  body('newsletterPopup.body').optional().isString(),
  body('newsletterPopup.couponCode').optional().isString().trim(),
  validate,
];

const faqGroup = (update: boolean) => [
  ...(update ? [param('id').isMongoId().withMessage('Invalid id')] : []),
  field('label', update, 'label is required').isString().trim().notEmpty().withMessage('label is required'),
  body('key').optional().isString().trim(),
  body('order').optional().isInt(),
  body('items').optional().isArray(),
  body('items.*.question').isString().trim().notEmpty().withMessage('question is required'),
  body('items.*.answer').isString().trim().notEmpty().withMessage('answer is required'),
  validate,
];

const legal = (update: boolean) => [
  ...(update ? [param('id').isMongoId().withMessage('Invalid id')] : []),
  field('title', update, 'title is required').isString().trim().notEmpty().withMessage('title is required'),
  body('slug').optional().isString().trim(),
  field('effectiveDate', update, 'effectiveDate is required').isISO8601().withMessage('effectiveDate must be a date'),
  body('intro').optional().isString(),
  body('sections').optional().isArray(),
  body('sections.*.id').isString().trim().notEmpty(),
  body('sections.*.heading').isString().trim().notEmpty(),
  body('sections.*.body').isString().trim().notEmpty(),
  validate,
];

const sizeChart = (update: boolean) => [
  ...(update ? [param('id').isMongoId().withMessage('Invalid id')] : []),
  field('title', update, 'title is required').isString().trim().notEmpty().withMessage('title is required'),
  body('slug').optional().isString().trim(),
  body('columns').optional().isArray({ min: 1, max: 12 }),
  body('columns.*').isString().trim().notEmpty(),
  body('rows').optional().isArray({ max: 100 }),
  body('rows.*').isArray(),
  body('rows.*.*').isString(),
  body('howToMeasure').optional().isArray(),
  body('howToMeasure.*.label').isString().trim().notEmpty(),
  body('howToMeasure.*.text').isString().trim().notEmpty(),
  body('fitNote').optional().isString(),
  validate,
];

const ContentValidator = {
  idParam,
  createArticle: article(false),
  updateArticle: article(true),
  siteContent,
  createFaqGroup: faqGroup(false),
  updateFaqGroup: faqGroup(true),
  createLegal: legal(false),
  updateLegal: legal(true),
  createSizeChart: sizeChart(false),
  updateSizeChart: sizeChart(true),
};
export default ContentValidator;
