import { Router } from 'express';
import AdminLogisticsController from '@/controller/admin/LogisticsController';
import { authenticateUser, isAdmin } from '@/middleware/auth';
import {
  upsertConfigValidator,
  getByCountryValidator,
  createEmptyCountryValidator,
  deleteCountryValidator,
  updateCountryNameValidator,
} from '@/validators/admin/logistics';
import { validate } from '@/middleware/validate';

const router = Router();

router.use(authenticateUser, isAdmin);

router.get('/countries', AdminLogisticsController.listCountries);
router.get('/:countryCode', getByCountryValidator, validate, AdminLogisticsController.getByCountry);
router.put('/', upsertConfigValidator, validate, AdminLogisticsController.upsertConfig); // can crud any ciry, lga , state
// routes to create an empty country, delete a country and update a country name
router.post('/', createEmptyCountryValidator, validate, AdminLogisticsController.createEmptyCountry);
router.delete('/:countryCode', deleteCountryValidator, validate, AdminLogisticsController.deleteCountry);
router.patch('/:countryCode', updateCountryNameValidator, validate, AdminLogisticsController.updateCountryName);

export default router;
