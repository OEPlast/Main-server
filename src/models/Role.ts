import { model, Schema, InferSchemaType } from 'mongoose';

const roleSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    permissions: [
      {
        resource: { type: String, required: true }, // e.g., 'products', 'orders', 'users'
        actions: [{ type: String, required: true }], // e.g., ['create', 'read', 'update', 'delete']
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type IRole = InferSchemaType<typeof roleSchema>;
const Role = model('Role', roleSchema);
export default Role;
