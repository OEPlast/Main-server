import mongoose, { InferSchemaType } from 'mongoose';
const { ObjectId } = mongoose.Schema;

const replySchema = new mongoose.Schema({
  replyBy: {
    type: ObjectId,
    ref: 'User',
    required: true,
  },
  review: {
    type: ObjectId,
    ref: 'Review',
    required: true,
  },
  reply: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export type ReplyType = InferSchemaType<typeof replySchema>;
const Reply = mongoose.model('Reply', replySchema);

export default Reply;
