import express from 'express';
const router = express.Router();

router.get('/users', () => {});
router.post('/users', () => {});
router.put('/users/:id', () => {});
router.delete('/users/:id', () => {});

// Managing access levels
router.put('/users/:id/role', () => {});

export default router;
