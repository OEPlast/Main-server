import express from 'express';
import { getCoupons, createCoupon, updateCoupon, deleteCoupon } from '../../controller/couponController';

const router = express.Router();

router.get('/coupons', getCoupons);
router.post('/coupons', createCoupon);
router.put('/coupons/:id', updateCoupon);
router.delete('/coupons/:id', deleteCoupon);

export default router;
