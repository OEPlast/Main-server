import { Router } from 'express';
import LogisticsController from '@/controller/LogisticsController';
import { quoteValidator } from '@/validators/logistics';
import { validate } from '@/middleware/validate';

const router = Router();

// Public: Track shipment by tracking number
router.get('/track/:trackingNumber', LogisticsController.trackOrder);

// Public: List supported logistics countries
router.get('/countries', LogisticsController.listCountries);
// Public: Countries with nested states, lga, cities (no price)
router.get('/locations-tree', LogisticsController.listLocationsTree);

// Public: Get logistics config by country
router.get('/config/:countryCode', LogisticsController.getConfig);

// Public: Get shipping quote considering product shipping modifiers
router.post('/quote', quoteValidator, validate, LogisticsController.quote);

export default router;
