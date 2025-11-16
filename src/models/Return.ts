import mongoose, { Document, InferSchemaType, Schema } from 'mongoose';

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

// Method to check if return is within 7-day window
ReturnSchema.methods.isWithinReturnWindow = function (deliveryDate: Date): boolean {
  const RETURN_WINDOW_DAYS = 7;
  const now = new Date();
  const windowEndDate = new Date(deliveryDate);
  windowEndDate.setDate(windowEndDate.getDate() + RETURN_WINDOW_DAYS);

  return now <= windowEndDate;
};

// Method to calculate total refund amount
ReturnSchema.methods.calculateTotalRefund = function (): number {
  return this.items.reduce((total: number, item: IReturnItem) => {
    return total + (item.refundAmount || 0);
  }, 0);
};

// Pre-save hook to generate return number if not exists
ReturnSchema.pre('save', async function (next) {
  if (!this.returnNumber) {
    const count = await mongoose.model('Return').countDocuments();
    this.returnNumber = `${Date.now()}-${count + 1}`;
  }
  next();
});

const Return = mongoose.model<IReturn>('Return', ReturnSchema);
export type ReturnType = InferSchemaType<typeof Return>;
export default Return;
