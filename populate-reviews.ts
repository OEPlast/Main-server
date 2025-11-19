/**
 * Populate Reviews Script
 *
 * This script creates sample reviews for products for testing purposes.
 * It will:
 * 1. Fetch all users from the database
 * 2. Fetch the 200 most recent orders (regardless of status)
 * 3. Distribute reviews across ALL users randomly
 * 4. Each user can review multiple products with different ratings
 * 5. Creates 5-star, 4-star, and 3-star reviews
 *
 * Usage: ts-node populate-reviews.ts
 */

import mongoose from 'mongoose';
import Order from './src/models/Order';
import Review from './src/models/Review';
import User from './src/models/User';
import Product from './src/models/Product'; // Required for Mongoose populate to work
import dotenv from 'dotenv';

dotenv.config();

// Ensure Product model is registered
// This prevents tree-shaking and ensures Mongoose can populate Product references
if (!Product) {
  throw new Error('Product model not loaded');
}

// Review template interface
interface ReviewTemplate {
  title: string;
  review: string;
}

// Simple user interface
interface SimpleUser {
  _id: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
}

// Populated product interface
interface PopulatedProduct {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
}

// Order interface with populated fields
interface PopulatedOrder {
  _id: mongoose.Types.ObjectId;
  products: Array<{
    product: PopulatedProduct;
    quantity: number;
    [key: string]: unknown;
  }>;
  transactionId?: mongoose.Types.ObjectId;
  createdAt: Date;
  [key: string]: unknown;
}

// Sample review templates for different ratings
const reviewTemplates: Record<number, ReviewTemplate[]> = {
  5: [
    {
      title: 'Excellent product!',
      review:
        'This product exceeded my expectations. The quality is outstanding and it works perfectly. Highly recommend to anyone looking for a reliable solution.',
    },
    {
      title: 'Amazing quality',
      review:
        'I am very impressed with the quality of this product. It arrived quickly and was exactly as described. Would definitely buy again.',
    },
    {
      title: 'Perfect!',
      review:
        'Absolutely love this product! It has made my life so much easier. The build quality is excellent and it performs flawlessly.',
    },
    {
      title: 'Highly recommended',
      review:
        'This is by far the best purchase I have made this year. The product is well-designed, durable, and does exactly what it promises.',
    },
    {
      title: 'Outstanding',
      review:
        'Could not be happier with this purchase. The product quality is top-notch and it has been working perfectly since day one.',
    },
  ],
  4: [
    {
      title: 'Very good product',
      review:
        'This is a solid product that does what it is supposed to do. The quality is good and I am satisfied with my purchase. Minor improvements could be made but overall great value.',
    },
    {
      title: 'Good quality',
      review:
        'I am pleased with this product. It works well and the quality is decent. There are a few small issues but nothing major. Would recommend.',
    },
    {
      title: 'Worth the money',
      review:
        'Good product for the price. It meets my needs and the quality is acceptable. Shipping was fast and packaging was secure.',
    },
    {
      title: 'Satisfied',
      review:
        'Overall a good purchase. The product works as expected and the quality is reasonable. A few minor flaws but still happy with it.',
    },
    {
      title: 'Pretty good',
      review:
        'This product is quite good. It does the job and the quality is fair. Some room for improvement but I would still recommend it to others.',
    },
  ],
  3: [
    {
      title: 'Average product',
      review:
        'This product is okay but nothing special. It works but there are better alternatives available. The quality could be improved.',
    },
    {
      title: 'Decent but not great',
      review:
        'The product is decent for the price but I expected more. It does the basic job but lacks some features. Quality is average.',
    },
    {
      title: 'It is okay',
      review:
        'Not bad but not great either. The product works but has some limitations. Would consider other options before buying again.',
    },
    {
      title: 'Fair quality',
      review:
        'The product quality is fair. It serves its purpose but there are noticeable flaws. For the price, I expected slightly better.',
    },
    {
      title: 'Mixed feelings',
      review:
        'I have mixed feelings about this product. Some aspects are good but others are disappointing. It works but could be better.',
    },
  ],
};

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

// Get random element from array
const getRandomElement = <T>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)];
};

// Get random rating (weighted towards higher ratings)
const getRandomRating = (): number => {
  const random = Math.random();
  if (random < 0.5) return 5; // 50% chance of 5 stars
  if (random < 0.8) return 4; // 30% chance of 4 stars
  return 3; // 20% chance of 3 stars
};

// Main population function
const populateReviews = async (): Promise<mongoose.Types.ObjectId[]> => {
  try {
    console.log('🚀 Starting review population...\n');

    // Fetch all users from database
    console.log('👥 Fetching all users...');
    const allUsers = (await User.find({ suspended: false })
      .select('_id firstName lastName email')
      .lean()) as SimpleUser[];

    console.log(`✅ Found ${allUsers.length} active users\n`);

    if (allUsers.length === 0) {
      console.log('❌ No users found. Cannot create reviews.');
      return [];
    }

    // Fetch all products that have been ordered
    console.log('📦 Fetching the 200 most recent orders...');
    const orders = (await Order.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('products.product', '_id name slug')
      .lean()) as unknown as PopulatedOrder[];

    console.log(`✅ Found ${orders.length} orders\n`);

    if (orders.length === 0) {
      console.log('❌ No orders found. Cannot create reviews.');
      return [];
    }

    // Collect all unique products from orders
    const productSet = new Set<string>();
    const productMap = new Map<string, { id: mongoose.Types.ObjectId; name: string }>();

    for (const order of orders) {
      if (!order.products || order.products.length === 0) continue;

      for (const orderProduct of order.products) {
        if (!orderProduct.product || !orderProduct.product._id) continue;

        const productId = orderProduct.product._id.toString();
        if (!productSet.has(productId)) {
          productSet.add(productId);
          productMap.set(productId, {
            id: orderProduct.product._id,
            name: orderProduct.product.name || 'Unknown Product',
          });
        }
      }
    }

    const uniqueProducts = Array.from(productMap.values());
    console.log(`📊 Found ${uniqueProducts.length} unique products from orders\n`);

    let reviewsCreated = 0;
    let reviewsSkipped = 0;
    let errors = 0;
    const createdReviewIds: mongoose.Types.ObjectId[] = [];

    // For each product, randomly assign reviews from different users
    console.log('🎲 Creating reviews with random user distribution...\n');

    for (const product of uniqueProducts) {
      // Randomly decide how many reviews this product should get (1-5 reviews per product)
      const reviewCount = Math.floor(Math.random() * 5) + 1;

      // Shuffle users and take random subset
      const shuffledUsers = [...allUsers].sort(() => Math.random() - 0.5);
      const selectedUsers = shuffledUsers.slice(0, reviewCount);

      for (const user of selectedUsers) {
        // Check if review already exists
        const existingReview = await Review.findOne({
          product: product.id,
          reviewBy: user._id,
        });

        if (existingReview) {
          console.log(`⏭️  Review already exists for "${product.name}" by ${user.firstName} ${user.lastName}`);
          reviewsSkipped++;
          continue;
        }

        // Generate random rating
        const rating = getRandomRating();
        const reviewTemplate = getRandomElement(reviewTemplates[rating]);

        // Find a random order that contains this product to link to
        const orderWithProduct = orders.find(
          (order) => order.products?.some((p) => p.product && p.product._id.toString() === product.id.toString())
        );

        try {
          // Create the review
          const newReview = new Review({
            product: product.id,
            reviewBy: user._id,
            rating,
            title: reviewTemplate.title,
            review: reviewTemplate.review,
            transactionId: orderWithProduct?.transactionId || orderWithProduct?._id,
            orderId: orderWithProduct?._id,
            images: [], // No images for auto-generated reviews
            likes: [],
            replies: [],
            isApproved: true,
            createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000), // Random date within last 90 days
          });

          await newReview.save();
          reviewsCreated++;
          createdReviewIds.push(newReview._id);
          console.log(`✅ Created ${rating}⭐ review for "${product.name}" by ${user.firstName} ${user.lastName}`);
        } catch (error: unknown) {
          errors++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ Error creating review for product ${product.id}:`, errorMessage);
        }
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 POPULATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total users available: ${allUsers.length}`);
    console.log(`Total products processed: ${uniqueProducts.length}`);
    console.log(`Reviews created: ${reviewsCreated}`);
    console.log(`Reviews skipped: ${reviewsSkipped}`);
    console.log(`Errors: ${errors}`);
    console.log('='.repeat(60) + '\n');

    console.log('✅ Review population completed!');

    // Return the list of created review IDs for potential cleanup
    return createdReviewIds;
  } catch (error) {
    console.error('❌ Error during review population:', error);
    throw error;
  }
};

// Run the script
const run = async (): Promise<void> => {
  try {
    await connectDB();
    const createdReviewIds = await populateReviews();

    // Save the review IDs to a file for cleanup
    if (createdReviewIds.length > 0) {
      const fs = await import('fs/promises');
      await fs.writeFile(
        './generated-review-ids.json',
        JSON.stringify({ reviewIds: createdReviewIds, createdAt: new Date().toISOString() }, null, 2)
      );
      console.log(`\n💾 Saved ${createdReviewIds.length} review IDs to generated-review-ids.json`);
    }

    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }
};

run();
