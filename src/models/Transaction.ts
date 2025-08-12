import mongoose, { Document, Schema } from 'mongoose';

export type TransactionStatus = 'pending' | 'success' | 'failed' | 'abandoned';
export type TransactionGateway = 'paystack' | 'stripe' | 'flutterwave' | 'manual';

export interface ITransaction extends Document {
  orderId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  reference: string; // use Order _id string as reference
  amount: number;
  currency: string;
  gateway: TransactionGateway;
  status: TransactionStatus;
  channel?: string; // card, bank, ussd, etc.
  authorizationUrl?: string;
  accessCode?: string;
  paidAt?: Date;
  gatewayResponse?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // remove inline index to avoid duplicate; uniqueness is enforced via index below
    reference: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'NGN', uppercase: true },
    gateway: { type: String, enum: ['paystack', 'stripe', 'flutterwave', 'manual'], required: true },
    status: { type: String, enum: ['pending', 'success', 'failed', 'abandoned'], default: 'pending', index: true },
    channel: { type: String },
    authorizationUrl: { type: String },
    accessCode: { type: String },
    paidAt: { type: Date },
    gatewayResponse: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

TransactionSchema.index({ orderId: 1 });
TransactionSchema.index({ userId: 1 });
TransactionSchema.index({ reference: 1 }, { unique: true });

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);
