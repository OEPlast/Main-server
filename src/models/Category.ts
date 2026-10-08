import mongoose, { InferSchemaType, model } from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      minlength: [2, 'must be atleast 2 charcters'],
      maxlength: [32, 'must be atleast 2 charcters'],
    },
    image: {
      type: String,
      default: 'https://isomorphic-furyroad.s3.amazonaws.com/public/categories/bags.webp',
    },
    miniImage: {
      type: String,
      required: false, // Minified version (optional for backward compatibility)
    },
    banner: {
      type: String,
      default: '',
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
    },
    parent: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'Category',
      },
    ],
    priority: {
      type: Boolean,
      default: false,
    },
    // Size chart slug (see SizeChart) used by products in this category that don't set their own.
    sizeChart: {
      type: String,
      required: false,
    },
    // Products in an add-on category (e.g. Gift Boxes) are suggested as add-ons on product pages.
    isAddOnCategory: {
      type: Boolean,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);
export type CategoryType = InferSchemaType<typeof categorySchema>;
const Category = model('Category', categorySchema);

export default Category;
