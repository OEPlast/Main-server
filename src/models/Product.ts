import mongoose, { InferSchemaType } from 'mongoose';
const { ObjectId } = mongoose.Schema;

const subProductSchema = new mongoose.Schema({
  _id: {
    type: ObjectId,
    default: new mongoose.Types.ObjectId(),
  },
  sku: String,
  images: [],
  description_images: [],
  color: {
    color: {
      type: String,
    },
    image: {
      type: String,
    },
  },
  sizes: [
    {
      size: String,
      qty: Number,
      price: Number,
    },
  ],
  discount: {
    type: Number,
    default: 0,
  },
  sold: {
    type: Number,
    default: 0,
  },
});

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      //lowercase: true,
    },
    category: {
      type: ObjectId,
      required: true,
      ref: 'Category',
    },
    subCategories: [
      {
        type: ObjectId,
        ref: 'subCategory',
      },
    ],
    details: [
      {
        name: String,
        value: String,
      },
    ],
    questions: [
      {
        question: String,
        answer: String,
      },
    ],
    refundPolicy: {
      type: String,
      default: '30 days',
    },
    rating: {
      type: Number,
      required: true,
      default: 0,
    },
    numReviews: {
      type: Number,
      required: true,
      default: 0,
    },
    shipping: {
      type: Number,
      required: true,
      default: 0,
    },
    subProducts: [subProductSchema],
  },
  {
    timestamps: true,
  }
);

export type ProductType = InferSchemaType<typeof productSchema>;
const Product = mongoose.model('Product', productSchema);

export default Product;
