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

export default {
  validateUserProfileUpdate,
  validateUserSettingsUpdate,
};
