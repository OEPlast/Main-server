import mongoose, { InferSchemaType } from 'mongoose';

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
      image: {
        type: String,
        required: true,
      },
    },
  ],
});

export type AttributeType = InferSchemaType<typeof attributeSchema>;
const Attribute = mongoose.model('Attribute', attributeSchema);

export default Attribute;
