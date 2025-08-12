import mongoose, { InferSchemaType } from 'mongoose';
const { ObjectId } = mongoose.Schema;

const attributeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  children: [
    {
      name: {
        type: String,
        required: true,
      },
      price: {
        type: Number,
      },
      discount: {
        type: Number,
        default: 0,
      },
      stock: {
        type: Number,
        required: true,
        default: 0,
      },
      image: {
        type: String,
        required: true,
      },
    },
  ],
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
    price: {
      type: Number,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    category: {
      type: ObjectId,
      required: true,
      ref: 'Category',
    },
    subCategories: {
      type: ObjectId,
      ref: 'subCategory',
    },
    tags: [{ type: String }],
    cover_image: {
      type: String,
      required: true,
    },

    description_images: [
      {
        url: { type: String, required: true },
        cover_image: {
          type: Boolean,
          default: false,
        },
      },
    ],
    specifications: [
      {
        key: {
          type: String,
          required: true,
        },
        value: {
          type: String,
          required: true,
        },
      },
    ],
    shipping: {
      type: Number,
      required: true,
      default: 0,
    },
    deliveryTime: {
      type: Number,
      required: true,
    },
    attributes: [attributeSchema],
    stock: {
      type: Number,
      required: true,
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      required: true,
      default: 5,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'archived'],
      default: 'inactive',
    },
  },
  {
    timestamps: true,
  }
);

export type ProductType = InferSchemaType<typeof productSchema>;
const Product = mongoose.model('Product', productSchema);
export default Product;
