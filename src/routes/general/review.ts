import express from 'express';
import { likeReview, unlikeReview, isLikedByUser, getLikeCount, addReply, deleteReply } from '../../services/reviewService';

const router = express.Router();

router.post('/:reviewId/like', async (req, res) => {
  const { reviewId } = req.params;
  const { userId } = req.body;
  await likeReview(reviewId, userId);
  res.sendStatus(200);
});

router.post('/:reviewId/unlike', async (req, res) => {
  const { reviewId } = req.params;
  const { userId } = req.body;
  await unlikeReview(reviewId, userId);
  res.sendStatus(200);
});

router.get('/:reviewId/isLikedByUser', async (req, res) => {
  const { reviewId } = req.params;
  const { userId } = req.query;
  const liked = await isLikedByUser(reviewId, userId);
  res.json({ liked });
});

router.get('/:reviewId/likeCount', async (req, res) => {
  const { reviewId } = req.params;
  const likeCount = await getLikeCount(reviewId);
  res.json({ likeCount });
});

router.post('/:reviewId/reply', async (req, res) => {
  const { reviewId } = req.params;
  const reply = req.body;
  await addReply(reviewId, reply);
  res.sendStatus(200);
});

router.delete('/:reviewId/reply/:replyId', async (req, res) => {
  const { reviewId, replyId } = req.params;
  await deleteReply(reviewId, replyId);
  res.sendStatus(200);
});

export default router;