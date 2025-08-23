import { Router } from 'express';
import AdminLogisticsController from '@/controller/admin/LogisticsController';
import { authenticateUser, isAdmin } from '@/middleware/auth';
import {
  upsertConfigValidator,
  getByCountryValidator,
  createEmptyCountryValidator,
  deleteCountryValidator,
  updateConfigIdValidator,
  updateConfigPartialValidator,
} from '@/validators/admin/logistics';
import { validate } from '@/middleware/validate';

const router = Router();

router.use(authenticateUser, isAdmin);

router.get('/countries', AdminLogisticsController.listCountries);
router.get('/one/:country', getByCountryValidator, validate, AdminLogisticsController.getByCountry);
// Create full logistics config and update by ID
router.post('/config', upsertConfigValidator, validate, AdminLogisticsController.createConfig);
router.patch(
  '/config/:id',
  updateConfigIdValidator,
  updateConfigPartialValidator,
  validate,
  AdminLogisticsController.updateConfig
);
// routes to create an empty country, delete a country and update a country name
router.post('/country/add', createEmptyCountryValidator, validate, AdminLogisticsController.createEmptyCountry);
router.delete('/country/:id', deleteCountryValidator, validate, AdminLogisticsController.deleteCountry);

export default router;
