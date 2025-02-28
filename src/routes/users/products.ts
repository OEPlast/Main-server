import { Router } from 'express';

const router = Router();

router.get('/all', () => {});
router.get('/search', () => {});
router.get('/week', () => {});
router.get('/top-sold', () => {});
router.get('/hot-sales', () => {});
router.get('/category/:category', () => {});
router.get('/:id', () => {});
router.get('/:id/stock', () => {});
router.get('/:id/review', () => {});

export default router;
