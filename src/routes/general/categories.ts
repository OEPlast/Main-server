import express from 'express';
const router = express.Router();

router.get('/categories', () => {});
router.get('/categories/:id', () => {});
router.post('/categories', () => {});
router.put('/categories/:id', () => {});
router.delete('/categories/:id', () => {});

// Special feature routes
router.get('/categories/:id/subcategories', () => {});
router.get('/categories/:id/products', () => {});
router.get('/subcategories/:id/products', () => {});

export default router;
