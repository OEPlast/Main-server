/**
 * Script to create "Deals of the Day" campaign with sales
 * 
 * This script:
 * 1. Fetches random products from the database
 * 2. Creates sales entries for those products with discounts
 * 3. Creates a "Deals of the Day" campaign
 * 4. Links the sales to the campaign
 * 
 * Usage: ts-node scripts/create-deals-of-the-day.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../src/models/Product';
import Sales from '../src/models/Sales';
import Campaign from '../src/models/Campaign';
import User from '../src/models/User';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/oeplast';
const PRODUCTS_TO_SELECT = 20; // Number of products for the campaign
const CAMPAIGN_NAME = 'Deals of the Day';
const CAMPAIGN_DESCRIPTION = 'Limited time offers on selected products - up to 50% off!';

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function getRandomProducts(count: number) {
  try {
    // Get random products that are active and in stock
    const products = await Product.aggregate([
      { $match: { status: 'active', stock: { $gt: 0 } } },
      { $sample: { size: count } }
    ]);
    
    console.log(`✅ Found ${products.length} random products`);
    return products;
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    throw error;
  }
}

async function getAdminUser() {
  try {
    // Find an admin user to use as creator
    const admin = await User.findOne({ role: 'owner', email: 'timileyinwandf@gmail.com' });
    
    if (!admin) {
      console.error('❌ No admin user found. Please create an admin user first.');
      process.exit(1);
    }
    
    console.log(`✅ Found admin user: ${admin.email}`);
    return admin;
  } catch (error) {
    console.error('❌ Error fetching admin user:', error);
    throw error;
  }
}

async function createSalesForProducts(products: any[], adminId: mongoose.Types.ObjectId) {
  const salesIds: mongoose.Types.ObjectId[] = [];
  
  console.log('\n🔄 Creating sales entries...');
  
  for (const product of products) {
    try {
      // Check if sale already exists for this product
      const existingSale = await Sales.findOne({ product: product._id, deleted: false });
      
      if (existingSale) {
        console.log(`⚠️  Sale already exists for product: ${product.name}`);
        salesIds.push(existingSale._id);
        continue;
      }
      
      // Generate random discount between 10% and 50%
      const discount = Math.floor(Math.random() * 41) + 10; // 10-50%
      
      // Create sale with variant for the product
      const sale = await Sales.create({
        title: `${discount}% OFF - ${product.name}`,
        product: product._id,
        isActive: true,
        createdBy: adminId,
        updatedBy: adminId,
        type: 'Limited', // Limited time offer
        startDate: new Date(),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        deleted: false,
        variants: [
          {
            attributeName: null,
            attributeValue: null,
            discount: discount,
            amountOff: 0,
            maxBuys: 100, // Limit per customer
            boughtCount: 0,
          }
        ],
      });
      
      salesIds.push(sale._id);
      console.log(`  ✅ Created sale for: ${product.name} (${discount}% OFF)`);
    } catch (error: any) {
      console.error(`  ❌ Error creating sale for ${product.name}:`, error.message);
    }
  }
  
  console.log(`\n✅ Created ${salesIds.length} sales entries`);
  return salesIds;
}

async function createDealsOfTheDayCampaign(productIds: mongoose.Types.ObjectId[], salesIds: mongoose.Types.ObjectId[]) {
  try {
    // Check if campaign already exists
    const existingCampaign = await Campaign.findOne({ title: CAMPAIGN_NAME });
    
    if (existingCampaign) {
      console.log('\n⚠️  "Deals of the Day" campaign already exists');
      
      // Update existing campaign
      existingCampaign.products = productIds;
      existingCampaign.sales = salesIds;
      existingCampaign.status = 'active';
      existingCampaign.startDate = new Date();
      existingCampaign.endDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      await existingCampaign.save();
      console.log('✅ Updated existing campaign with new products and sales');
      
      // Update sales to reference this campaign
      await Sales.updateMany(
        { _id: { $in: salesIds } },
        { campaign: existingCampaign._id }
      );
      
      return existingCampaign;
    }
    
    // Create new campaign
    const campaign = await Campaign.create({
      image: 'https://placeholder.com/deals-of-the-day.jpg', // Replace with actual image
      title: CAMPAIGN_NAME,
      description: CAMPAIGN_DESCRIPTION,
      startDate: new Date(),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      status: 'active',
      products: productIds,
      sales: salesIds,
    });
    
    console.log('\n✅ Created "Deals of the Day" campaign');
    
    // Update sales to reference this campaign
    await Sales.updateMany(
      { _id: { $in: salesIds } },
      { campaign: campaign._id }
    );
    
    console.log('✅ Linked sales to campaign');
    
    return campaign;
  } catch (error) {
    console.error('❌ Error creating campaign:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting "Deals of the Day" campaign creation...\n');
  
  await connectDB();
  
  try {
    // Step 1: Get admin user
    const admin = await getAdminUser();
    
    // Step 2: Get random products
    const products = await getRandomProducts(PRODUCTS_TO_SELECT);
    
    if (products.length === 0) {
      console.error('❌ No products found. Please add products to the database first.');
      process.exit(1);
    }
    
    // Step 3: Create sales for products
    const salesIds = await createSalesForProducts(products, admin._id);
    
    if (salesIds.length === 0) {
      console.error('❌ No sales created. Exiting.');
      process.exit(1);
    }
    
    // Step 4: Create campaign
    const productIds = products.map(p => p._id);
    const campaign = await createDealsOfTheDayCampaign(productIds, salesIds);
    
    console.log('\n✅ ============================================');
    console.log('✅ Successfully created "Deals of the Day" campaign!');
    console.log('✅ ============================================');
    console.log(`📊 Campaign ID: ${campaign._id}`);
    console.log(`📦 Products: ${productIds.length}`);
    console.log(`💰 Sales: ${salesIds.length}`);
    console.log(`📅 Valid until: ${campaign.endDate}`);
    console.log('✅ ============================================\n');
    
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Disconnected from MongoDB');
  }
}

main();
