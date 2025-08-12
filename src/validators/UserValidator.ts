import { body } from 'express-validator';

// Validation rules for user-related operations
const validateUserProfileUpdate = [
  body('name').optional().isString().withMessage('Name must be a string'),
  body('email').optional().isEmail().withMessage('Invalid email address'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
];

const validateUserSettingsUpdate = [
  body('notifications').optional().isBoolean().withMessage('Notifications must be a boolean'),
  body('theme').optional().isString().withMessage('Theme must be a string'),
];

const validateStoreSettings = [
  body('storeName').optional().isString(),
  body('companyName').optional().isString(),
  body('logoUrl').optional().isString(),
  body('websiteUrl').optional().isString(),
  body('supportEmail').optional().isEmail(),
  body('supportPhone').optional().isString(),
  body('currency').optional().isString(),
  body('taxId').optional().isString(),
  body('address').optional().isObject(),
  body('address.line1').optional().isString(),
  body('address.line2').optional().isString(),
  body('address.city').optional().isString(),
  body('address.state').optional().isString(),
  body('address.zip').optional().isString(),
  body('address.country').optional().isString(),
];

export default {
  validateUserProfileUpdate,
  validateUserSettingsUpdate,
  validateStoreSettings,
};
