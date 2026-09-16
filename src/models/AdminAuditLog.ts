import mongoose, { InferSchemaType, Schema } from 'mongoose';

/**
 * One record per state-changing admin request (POST/PUT/PATCH/DELETE under /admin) that succeeded.
 *
 * Written by middleware/audit.ts, so every admin route is covered without each controller having
 * to remember. Until this existed a refund, a role change or an order deletion left no trace of
 * who did it.
 */
const adminAuditLogSchema = new Schema(
  {
    actor: {
      userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
      role: { type: String },
    },
    method: { type: String, required: true },
    path: { type: String, required: true },
    /** First path segment after /admin, e.g. `orders`, `transactions`, `users`. */
    resource: { type: String, required: true, index: true },
    /** The ObjectId in the path, when there is one: the order, user, transaction being acted on. */
    targetId: { type: String, index: true },
    /** Request body with secrets redacted and large values truncated. */
    body: { type: Schema.Types.Mixed },
    query: { type: Schema.Types.Mixed },
    statusCode: { type: Number, required: true },
    ip: { type: String },
    userAgent: { type: String },
    requestId: { type: String },
    durationMs: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

adminAuditLogSchema.index({ createdAt: -1 });
adminAuditLogSchema.index({ resource: 1, targetId: 1, createdAt: -1 });

export type AdminAuditLogType = InferSchemaType<typeof adminAuditLogSchema>;
const AdminAuditLog = mongoose.model('AdminAuditLog', adminAuditLogSchema);
export default AdminAuditLog;
