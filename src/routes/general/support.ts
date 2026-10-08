import express from 'express';
import SupportController from '@/controller/SupportController';
import SupportValidator from '@/validators/SupportValidator';
import { authenticateUser_No_Force } from '@/middleware/auth';
import RateLimits from '@/middleware/rate';

/** Public contact form (mounted at /contact). */
export const contactRouter = express.Router();
/**
 * @route POST /contact { name, email, phone?, orderNumber?, topic, message }
 * @desc  Opens a support ticket; returns { id: ticketNumber, createdAt, email }
 */
contactRouter.post(
  '/',
  authenticateUser_No_Force,
  RateLimits.Contact_Limiter,
  ...SupportValidator.contact,
  SupportController.createTicket
);

/** Back-in-stock alerts (mounted at /products). */
export const stockAlertRouter = express.Router();
/**
 * @route POST /products/:productId/stock-alerts { email, attribute?: { name, value } }
 */
stockAlertRouter.post(
  '/:productId/stock-alerts',
  authenticateUser_No_Force,
  RateLimits.StockAlert_Limiter,
  ...SupportValidator.stockAlert,
  SupportController.createStockAlert
);

/** Pickup locations and delivery options for checkout (mounted at /checkout, ahead of the checkout router). */
export const pickupRouter = express.Router();
/** @route GET /checkout/pickup-locations — active locations in display order */
pickupRouter.get('/pickup-locations', SupportController.listPickupLocations);
/**
 * @route POST /checkout/shipping-options { items: [{ productId, qty, selectedAttributes? }], address?: { country, state, city, lga } }
 * @desc  [{ id, name, eta, price, requiresQuote? }] for the enabled delivery methods; works for guests
 */
pickupRouter.post('/shipping-options', ...SupportValidator.shippingOptions, SupportController.shippingOptions);
