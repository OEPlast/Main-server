import mongoose, { InferSchemaType } from 'mongoose';
const { ObjectId } = mongoose.Schema;

const subSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    minlength: [2, 'must be atleast 2 charcters'],
    maxlength: [32, 'must be atleast 2 charcters'],
  },
  image: {
    type: String,
    required: true,
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    index: true,
  },
  parent: {
    type: ObjectId,
    ref: 'Category',
    required: true,
  },
});

export type SubcategoryType = InferSchemaType<typeof subSchema>;
const SubCategory = mongoose.model('SubCategory', subSchema);

export default SubCategory;
