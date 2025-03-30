import mongoose, { InferSchemaType } from 'mongoose';

const StatisticsSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    totalAmount: {
      type: Number,
    },
    totalRevenue: {
      type: Number,
    },
    totalCustomers: {
      type: Number,
    },
    totalSales: {
      type: Number,
    },
    totalOrders: {
      type: Number,
    },
    totalReturns: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

StatisticsSchema.index({ date: 1 }, { unique: true });

export type StatisticsType = InferSchemaType<typeof StatisticsSchema>;
const Statistics = mongoose.model('Statistics', StatisticsSchema);

export default Statistics;
