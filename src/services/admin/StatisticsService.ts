import mongoose from 'mongoose';
import StatisticsService, { StatisticsType } from '@/models/Statistics';

/**
 * Increments a specific field in the Statistics model within a session transaction.
 * @param field - The field to increment.
 * @param incrementBy - The value to increment by.
 * @param timeStamp - Optional timestamp for the analytics event. Defaults to current time.
 * @returns Promise resolving to the updated Statistics document.
 */
const incrementAnalyticalField = async (
  field: Exclude<keyof StatisticsType, 'createdAt' | 'updatedAt' | 'date'>,
  incrementBy: number,
  timeStamp?: Date
): Promise<StatisticsType> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const currentTime = timeStamp || new Date();
    const startOfDay = new Date(
      Date.UTC(currentTime.getUTCFullYear(), currentTime.getUTCMonth(), currentTime.getUTCDate())
    );

    const Statistics = await StatisticsService.findOneAndUpdate(
      { date: startOfDay },
      { $inc: { [field]: incrementBy } },
      { new: true, upsert: true, session }
    );

    await session.commitTransaction();
    session.endSession();

    return Statistics;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(`Error incrementing field ${field}:`, error);
    throw new Error(`Failed to increment field ${field}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export default { incrementAnalyticalField };
