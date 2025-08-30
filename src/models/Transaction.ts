import mongoose, { Document, Schema } from 'mongoose';

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded';
export type TransactionGateway = 'paystack' | 'stripe' | 'flutterwave' | 'manual';
export type PaymentMethod = 'stripe' | 'paystack' | 'flutterwave' | 'bank_transfer' | 'cash_on_delivery';

export interface ITransaction extends Document {
  orderId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  reference: string; // Unique transaction reference
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentGateway: TransactionGateway;
  status: TransactionStatus;
  channel?: string; // card, bank, ussd, etc.
  accessCode?: string;
  paymentDate: Date;
  paidAt?: Date;
  gatewayResponse: {
    transactionReference?: string;
    gatewayTransactionId?: string;
    responseCode?: string;
    responseMessage?: string;
    metadata?: Record<string, unknown>;
  };
  refunds: Array<{
    refundId: string;
    amount: number;
    reason: string;
    status: 'pending' | 'completed' | 'failed';
    refundDate: Date;
    gatewayRefundId?: string;
  }>;
  fees: {
    gatewayFee: number;
    processingFee: number;
    totalFees: number;
  };
  customerInfo: {
    email: string;
    phone?: string;
    name: string;
  };
  billingAddress?: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reference: { type: String, required: true, unique: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'NGN', uppercase: true },
    paymentMethod: {
      type: String,
      enum: ['stripe', 'paystack', 'flutterwave', 'bank_transfer', 'cash_on_delivery'],
      required: true,
    },
    paymentGateway: { 
      type: String, 
      enum: ['paystack', 'stripe', 'flutterwave', 'manual'], 
      required: true 
    },
    status: { 
      type: String, 
      enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded'], 
      default: 'pending', 
      index: true 
    },
    channel: { type: String },
    accessCode: { type: String },
    paymentDate: { type: Date, default: Date.now },
    paidAt: { type: Date },
    gatewayResponse: {
      transactionReference: String,
      gatewayTransactionId: String,
      responseCode: String,
      responseMessage: String,
      metadata: Schema.Types.Mixed,
    },
    refunds: [
      {
        refundId: {
          type: String,
          required: true,
        },
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
        reason: {
          type: String,
          required: true,
        },
        status: {
          type: String,
          enum: ['pending', 'completed', 'failed'],
          default: 'pending',
        },
        refundDate: {
          type: Date,
          default: Date.now,
        },
        gatewayRefundId: String,
      },
    ],
    fees: {
      gatewayFee: {
        type: Number,
        default: 0,
        min: 0,
      },
      processingFee: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalFees: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    customerInfo: {
      email: {
        type: String,
        required: true,
      },
      phone: String,
      name: {
        type: String,
        required: true,
      },
    },
    billingAddress: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
    },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true }
);

TransactionSchema.index({ orderId: 1 });
TransactionSchema.index({ userId: 1 });
TransactionSchema.index({ reference: 1 }, { unique: true });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ paymentDate: -1 });

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);
