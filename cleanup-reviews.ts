/**
 * Cleanup Reviews Script
 *
 * This script deletes reviews created by the populate-reviews.ts script.
 * It uses the generated-review-ids.json file to target only the reviews
 * that were created during population.
 *
 * Usage: ts-node cleanup-reviews.ts
 */

import mongoose from 'mongoose';
import Review from './src/models/Review';
import dotenv from 'dotenv';
import fs from 'fs/promises';

dotenv.config();

// Connect to MongoDB
const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/oeplast');
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Main cleanup function
const cleanupReviews = async (): Promise<void> => {
  try {
    console.log('🗑️  Starting review cleanup...\n');

    // Check if generated-review-ids.json exists
    const idsFilePath = './generated-review-ids.json';

    try {
      const fileContent = await fs.readFile(idsFilePath, 'utf-8');
      const data = JSON.parse(fileContent);
      const reviewIds: string[] = data.reviewIds || [];

      if (reviewIds.length === 0) {
        console.log('⚠️  No review IDs found in generated-review-ids.json');
        console.log('💡 Run populate-reviews.ts first to generate reviews\n');
        return;
      }

      console.log(`📊 Found ${reviewIds.length} review IDs to delete`);
      console.log(`📅 Reviews created at: ${data.createdAt || 'Unknown'}\n`);

      // Ask for confirmation
      console.log('⚠️  WARNING: This will DELETE the generated reviews!');
      console.log('Press Ctrl+C to cancel or wait 3 seconds to proceed...\n');

      // Wait 3 seconds before proceeding
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Delete reviews by IDs
      const result = await Review.deleteMany({ _id: { $in: reviewIds } });

      console.log(`✅ Successfully deleted ${result.deletedCount} reviews`);

      // Delete the IDs file
      await fs.unlink(idsFilePath);
      console.log('🗑️  Removed generated-review-ids.json file');

      console.log('🎉 Cleanup completed!\n');
    } catch (fileError: unknown) {
      if ((fileError as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log('⚠️  File generated-review-ids.json not found');
        console.log('💡 This file is created when you run populate-reviews.ts');
        console.log('\nAlternative: Delete ALL reviews? (Ctrl+C to cancel)\n');

        await new Promise((resolve) => setTimeout(resolve, 3000));

        const result = await Review.deleteMany({});
        console.log(`✅ Deleted all ${result.deletedCount} reviews from database\n`);
      } else {
        throw fileError;
      }
    }
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
};

// Run the script
const run = async (): Promise<void> => {
  try {
    await connectDB();
    await cleanupReviews();
    console.log('✅ Script completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
};

run();
