import mongoose, { InferSchemaType } from 'mongoose';

const childAttributeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: '',
      required: true,
    },
    image: {
      type: String,
    },
    miniImage: {
      type: String,
      required: false, // Minified version (optional for backward compatibility)
    },
  },
  { _id: false }
);

type ChildAttribute = InferSchemaType<typeof childAttributeSchema>;
const attributeSchema = new mongoose.Schema({
  name: {
    type: String,
    default: '',
    required: true,
    unique: true,
  },
  children: {
    type: [childAttributeSchema],
    validate: {
      validator: function (children: ChildAttribute[] | undefined) {
        if (!children) return true;
        const names = children.map((c) => c.name);
        return new Set(names).size === names.length;
      },
      message: 'Child names must be unique within an attribute',
    },
  },
});
attributeSchema.index({ name: 1 }, { unique: true });
export type AttributeType = InferSchemaType<typeof attributeSchema>;
const Attribute = mongoose.model('Attribute', attributeSchema);

export default Attribute;
