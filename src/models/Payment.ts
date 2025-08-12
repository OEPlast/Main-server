import mongoose, { Document, Schema } from 'mongoose';

export interface IPayment extends Document {
  orderId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  paymentId: string; // Payment gateway ID
  paymentMethod: 'stripe' | 'paystack' | 'flutterwave' | 'bank_transfer' | 'cash_on_delivery';
  paymentGateway: 'stripe' | 'paystack' | 'flutterwave' | 'manual';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded';
  paymentDate: Date;
  transactionId: string;
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

const PaymentSchema = new Schema<IPayment>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    paymentId: {
      type: String,
      required: true,
      unique: true,
    },
    paymentMethod: {
      type: String,
      enum: ['stripe', 'paystack', 'flutterwave', 'bank_transfer', 'cash_on_delivery'],
      required: true,
    },
    paymentGateway: {
      type: String,
      enum: ['stripe', 'paystack', 'flutterwave', 'manual'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: 'USD',
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded'],
      default: 'pending',
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    transactionId: {
      type: String,
      required: true,
    },
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
  {
    timestamps: true,
  }
);

// Indexes for better query performance
PaymentSchema.index({ orderId: 1 });
PaymentSchema.index({ userId: 1 });
PaymentSchema.index({ transactionId: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ paymentDate: -1 });

export default mongoose.model<IPayment>('Payment', PaymentSchema);
