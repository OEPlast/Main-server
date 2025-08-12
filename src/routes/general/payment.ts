import { Router, Request, Response, NextFunction } from 'express';
import PaymentController from '../../controller/PaymentController';
import { isAuthenticated } from '../../middleware/auth';
import { validationResult } from 'express-validator';
import {
  initializePaymentValidator,
  verifyPaymentValidator,
  getPaymentByIdValidator,
  getUserPaymentsValidator,
  getPaymentByReferenceValidator,
  refundPaymentValidator,
} from '../../validators/paymentValidator';

const router = Router();

// Validation middleware
const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      message: 'Validation failed',
      data: errors.array(),
      code: 400,
    });
    return;
  }
  next();
};

// Initialize payment
router.post('/initialize', isAuthenticated, initializePaymentValidator, validate, PaymentController.initializePayment);

// Verify payment
router.get('/verify/:reference', verifyPaymentValidator, validate, PaymentController.verifyPayment);

// Paystack webhook (no auth required)
router.post('/webhook', PaymentController.handleWebhook);

// Get payment by ID
router.get('/:paymentId', isAuthenticated, getPaymentByIdValidator, validate, PaymentController.getPaymentById);

// Get user payments
router.get('/user/payments', isAuthenticated, getUserPaymentsValidator, validate, PaymentController.getUserPayments);

// Get payment by reference
router.get(
  '/reference/:reference',
  isAuthenticated,
  getPaymentByReferenceValidator,
  validate,
  PaymentController.getPaymentByReference
);

// Refund payment (admin only)
router.post('/:paymentId/refund', isAuthenticated, refundPaymentValidator, validate, PaymentController.refundPayment);

export default router;
