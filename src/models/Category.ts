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
  },
  {
    timestamps: true,
  }
);
export type CategoryType = InferSchemaType<typeof categorySchema>;
const Category = model('Category', categorySchema);

export default Category;
