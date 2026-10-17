import { Router } from 'express';
import GIGController from '@/controller/GIGController';
import { authenticateUser, authenticateUserIfTokenSent } from '@/middleware/auth';
import RateLimits from '@/middleware/rate';

const router = Router();

// Calculate shipping requires authentication (to prevent abuse)
router.post('/calculate-shipping', authenticateUser, GIGController.calculateShipping);

// Public: get stations list
router.get('/stations', GIGController.getStations);

// Public: GIG service centres in a state, and the price to collect a cart at one. Guests choose
// pickup centres too, so the quote is open to them, rate limited per IP.
router.get('/service-centres', GIGController.getServiceCentres);
router.post('/centre-quote', authenticateUserIfTokenSent, RateLimits.GigCentreQuote_Limiter, GIGController.centreQuote);

// Public: checkout delivery settings
router.get('/config', GIGController.getCheckoutConfig);

// Public: track shipment
router.get('/track/:waybill', GIGController.trackShipment);

export default router;
