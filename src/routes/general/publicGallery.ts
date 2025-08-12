import { Router } from 'express';
import Gallery from '@/models/Gallery';

const router = Router();

// Public gallery listing for storefront
router.get('/', async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);

    const [images, total] = await Promise.all([
      Gallery.find()
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Gallery.countDocuments(),
    ]);

    return res.status(200).json({ message: 'Gallery retrieved', data: { images, total, page, limit } });
  } catch (error) {
    console.error('Error getting public gallery:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const image = await Gallery.findById(req.params.id);
    if (!image) return res.status(404).json({ message: 'Image not found' });
    return res.status(200).json({ message: 'Image retrieved', data: image });
  } catch (error) {
    console.error('Error getting gallery image:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
