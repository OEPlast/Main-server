import { Router } from 'express';
import LogisticsController from '@/controller/LogisticsController';
import { quoteValidator, flatCartShippingValidator } from '@/validators/logistics';
import { validate } from '@/middleware/validate';

const router = Router();

// Public: Track shipment by tracking number
router.get('/track/:trackingNumber', LogisticsController.trackOrder);

// Public: List supported logistics countries
router.get('/countries', LogisticsController.listCountries);
// Public: List full logistics configs (countries with pricing)
router.get('/configs', LogisticsController.listAllConfigs);
// Public: Countries with nested states, lga, cities (no price)
router.get('/locations-tree', LogisticsController.listLocationsTree);
// Public: Get location hierarchy for specific country (for address forms)
router.get('/locations/:country', LogisticsController.getLocationsByCountry);

// Public: Get logistics config by country
router.get('/config/:country', LogisticsController.getConfig);

// Public: Get shipping quote considering product shipping modifiers
router.post('/quote', quoteValidator, validate, LogisticsController.quote);

// Public: Calculate flat cart shipping with size/weight
router.post('/cart/flat-shipping', flatCartShippingValidator, validate, LogisticsController.flatCartShipping);

export default router;
