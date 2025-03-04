import mongoose, { InferSchemaType, model } from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      minlength: [2, 'must be atleast 2 charcters'],
      maxlength: [32, 'must be atleast 2 charcters'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },
    sub_categories: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'SubCategory',
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
