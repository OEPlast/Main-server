import { model, Schema, InferSchemaType } from 'mongoose';
import { PermissionResource, PermissionAction } from '@/types/permissions';

const roleSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    permissions: [
      {
        _id: false,
        resource: {
          type: String,
          required: true,
          enum: Object.values(PermissionResource),
        },
        actions: [
          {
            type: String,
            required: true,
            enum: Object.values(PermissionAction),
          },
        ],
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type IRole = InferSchemaType<typeof roleSchema>;
const Role = model('Role', roleSchema);
export default Role;
