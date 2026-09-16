import mongoose, { Document, InferSchemaType, Schema } from 'mongoose';
import { randomBytes } from 'crypto';

export interface IReturnItem {
  product: mongoose.Types.ObjectId;
  qty: number;
  reason: string;
  reasonDetails?: string;
  images?: string[]; // Base64 strings or URLs
  refundAmount?: number;
}

export interface IReturn extends Document {
  returnNumber: string;
  order: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  items: IReturnItem[];
  type: 'refund' | 'exchange';
  status:
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'items_received'
    | 'inspecting'
    | 'inspection_passed'
    | 'inspection_failed'
    | 'completed'
    | 'cancelled';
  totalRefundAmount: number | null;
  refundTransaction?: mongoose.Types.ObjectId;
  customerNotes?: string;
  adminNotes?: string;
  requestedAt: Date;
  /** Every status the return has been through, who moved it and why. */
  statusHistory: Array<{ status: IReturn['status']; at: Date; by: string; note?: string }>;
  /** Soft delete: hidden from every list, kept for the refund audit trail. */
  deleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReturnSchema = new Schema<IReturn>(
  {
    returnNumber: {
      type: String,
      unique: true,
      index: true,
      // Will be generated in pre-save hook if not provided
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order reference is required'],
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    items: [
      {
        product: {
          type: Schema.Types.ObjectId,
          ref: 'Product',
          required: [true, 'Product reference is required'],
        },
        qty: {
          type: Number,
          required: [true, 'Quantity is required'],
          min: [1, 'Quantity must be at least 1'],
        },
        reason: {
          type: String,
          required: [true, 'Return reason is required'],
          enum: [
            'defective',
            'wrong_item',
            'damaged',
            'not_as_described',
            'size_issue',
            'color_issue',
            'quality_issue',
            'changed_mind',
            'late_delivery',
            'other',
          ],
        },
        reasonDetails: {
          type: String,
          maxlength: [500, 'Reason details cannot exceed 500 characters'],
        },
        images: {
          type: [String],
          default: [],
        },
        refundAmount: {
          type: Number,
          min: [0, 'Refund amount cannot be negative'],
        },
      },
    ],
    type: {
      type: String,
      required: [true, 'Return type is required'],
      enum: ['refund', 'exchange'],
      default: 'refund',
    },
    status: {
      type: String,
      required: [true, 'Return status is required'],
      enum: [
        'pending',
        'approved',
        'rejected',
        'items_received',
        'inspecting',
        'inspection_passed',
        'inspection_failed',
        'completed',
        'cancelled',
      ],
      default: 'pending',
      index: true,
    },
    totalRefundAmount: {
      type: Number,
      default: null,
      min: [0, 'Total refund amount cannot be negative'],
    },
    refundTransaction: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    customerNotes: {
      type: String,
      maxlength: [1000, 'Customer notes cannot exceed 1000 characters'],
    },
    adminNotes: {
      type: String,
      maxlength: [1000, 'Admin notes cannot exceed 1000 characters'],
    },
    requestedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    statusHistory: {
      type: [
        {
          status: { type: String, required: true },
          at: { type: Date, required: true },
          by: { type: String, required: true },
          note: { type: String },
        },
      ],
      default: [],
    },
    deleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: String },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
ReturnSchema.index({ order: 1, status: 1 });
ReturnSchema.index({ user: 1, status: 1 });
ReturnSchema.index({ createdAt: -1 });

// Virtual for formatted return number
ReturnSchema.virtual('formattedReturnNumber').get(function () {
  return `RET-${this.returnNumber}`;
});


// Method to calculate total refund amount
ReturnSchema.methods.calculateTotalRefund = function (): number {
  return this.items.reduce((total: number, item: IReturnItem) => {
    return total + (item.refundAmount || 0);
  }, 0);
};

/**
 * Return numbers are RET-YYYYMMDD-XXXXXX with a random suffix. The old `${Date.now()}-${count+1}`
 * form was built from a document count, so two returns filed in the same moment collided, and a
 * delete shifted every later number.
 */
ReturnSchema.pre('save', function (next) {
  if (!this.returnNumber) {
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    this.returnNumber = `RET-${day}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }
  next();
});

const Return = mongoose.model<IReturn>('Return', ReturnSchema);
export type ReturnType = InferSchemaType<typeof Return>;
export default Return;
