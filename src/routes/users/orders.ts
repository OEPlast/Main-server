import express from 'express';
const router = express.Router();

router.get('/orders', () => {});
router.get('/orders/:id', () => {});
router.post('/orders', () => {});
router.put('/orders/:id', () => {});
router.delete('/orders/:id', () => {});

export default router;
