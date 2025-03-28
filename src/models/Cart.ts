import mongoose, { InferSchemaType } from 'mongoose';

const { ObjectId } = mongoose.Schema;

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: ObjectId,
      ref: 'User',
      required: true,
      unique: true, // Enforce one cart per user
    },
    products: [
      {
        product: {
          type: ObjectId,
          ref: 'Product',
        },
        qty: {
          type: Number,
        },
        price: {
          type: Number,
        },
        attributes: [
          {
            name: {
              type: String,
              required: true,
            },
            value: {
              type: String,
              required: true,
            },
          },
        ],
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 60 * 60 * 24 * 15, // TTL index: 15 days
    },
  },
  {
    timestamps: true,
  }
);

export type CartType = InferSchemaType<typeof cartSchema>;
const Cart = mongoose.model('Cart', cartSchema);

export default Cart;
