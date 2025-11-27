import mongoose from 'mongoose';
import Order from '../src/models/Order';
import Coupon from '../src/models/Coupon';
import { config } from 'dotenv';
config();
const MONGO_URI = process.env.MONGODB_URI || '';

async function main() {
  await mongoose.connect(MONGO_URI);

  const orders = await Order.find({
    coupon: { $ne: null },
    $or: [{ couponSnapshot: null }, { couponSnapshot: { $exists: false } }],
  });

  console.log(`Found ${orders.length} orders to update.`);

  let updated = 0;
  for (const order of orders) {
    const coupon = await Coupon.findById(order.coupon);
    if (!coupon) {
      console.warn(`Coupon not found for order ${order._id}`);
      continue;
    }

    // Build the snapshot structure as in your Order model
    const couponSnapshot = {
      discount: coupon.discount,
      discountType: coupon.discountType,
      appliesTo: coupon.appliesTo
        ? {
            scope: coupon.appliesTo.scope,
            productIds: coupon.appliesTo.productIds,
            categoryIds: coupon.appliesTo.categoryIds,
          }
        : undefined,
    };

    order.couponSnapshot = couponSnapshot;
    await order.save();
    updated++;
    console.log(`Updated order ${order._id} with couponSnapshot.`);
  }

  console.log(`Done. Updated ${updated} orders.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
