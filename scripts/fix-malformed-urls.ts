/**
 * Fix Malformed URLs Script
 * 
 * This script fixes URLs that have triple slashes (https:///) or other malformations
 * by extracting the relative path and storing it correctly.
 * 
 * Usage:
 *   npm run fix:urls -- --dry-run  # Preview changes
 *   npm run fix:urls                # Apply fixes
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../src/models/Product';
import User from '../src/models/User';
import Campaign from '../src/models/Campaign';
import Banner from '../src/models/Banner';
import Category from '../src/models/Category';
import Attribute from '../src/models/Attributes';

dotenv.config();

const MONGO_URL = process.env.MONGODB_URI as unknown as string;
const DRY_RUN = process.argv.includes('--dry-run');

const stats = {
  productsFixed: 0,
  usersFixed: 0,
  campaignsFixed: 0,
  bannersFixed: 0,
  categoriesFixed: 0,
  attributesFixed: 0,
};

/**
 * Extract clean relative path from potentially malformed URL
 */
function extractCleanPath(url: string): string {
  if (!url) return url;
  
  // If it's already a clean relative path, return it
  if (!url.includes('://') && !url.startsWith('//')) {
    return url;
  }
  
  // Fix triple slashes: https:/// -> extract path after ///
  if (url.includes(':///')) {
    const pathPart = url.split(':///')[1];
    return pathPart || url;
  }
  
  // Fix double slashes after protocol: https://path -> extract path
  if (url.match(/^https?:\/\/[^\/]/)) {
    // Normal URL structure, extract path
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.replace(/^\//, '');
    } catch {
      // If URL parsing fails, use string manipulation
      return url.replace(/^https?:\/\/[^\/]+\//, '');
    }
  }
  
  // Fallback: remove any protocol and leading slashes
  return url
    .replace(/^https?:\/+/, '')
    .replace(/^\/+/, '');
}

/**
 * Check if URL is malformed
 */
function isMalformed(url: string): boolean {
  if (!url) return false;
  
  // Check for triple slashes
  if (url.includes(':///')) return true;
  
  // Check for protocol but no domain
  if (url.match(/^https?:\/\/[^a-zA-Z0-9]/)) return true;
  
  // Check if it starts with protocol when it should be relative
  const hasProtocol = url.startsWith('http://') || url.startsWith('https://');
  const shouldBeRelative = !url.includes('b-cdn.net') && !url.includes('amazonaws.com');
  
  return hasProtocol && shouldBeRelative;
}

/**
 * Fix Product images
 */
async function fixProducts() {
  console.log('\n📦 Checking Products...');
  const products = await Product.find({}).lean();
  
  for (const product of products) {
    if (!product.description_images || product.description_images.length === 0) continue;
    
    let needsUpdate = false;
    const updatedImages = [];
    
    for (const img of product.description_images) {
      const newImg = { ...img };
      
      if (img.url && isMalformed(img.url)) {
        const cleanPath = extractCleanPath(img.url);
        console.log(`  🔧 Product ${product.name}: ${img.url} -> ${cleanPath}`);
        newImg.url = cleanPath;
        needsUpdate = true;
      }
      
      if (img.miniUrl && isMalformed(img.miniUrl)) {
        const cleanPath = extractCleanPath(img.miniUrl);
        console.log(`  🔧 Product ${product.name}: ${img.miniUrl} -> ${cleanPath}`);
        newImg.miniUrl = cleanPath;
        needsUpdate = true;
      }
      
      updatedImages.push(newImg);
    }
    
    if (needsUpdate) {
      if (!DRY_RUN) {
        await Product.updateOne({ _id: product._id }, { $set: { description_images: updatedImages } });
      }
      stats.productsFixed++;
    }
  }
  
  console.log(`✅ Fixed ${stats.productsFixed} products`);
}

/**
 * Fix User images
 */
async function fixUsers() {
  console.log('\n👤 Checking Users...');
  const users = await User.find({ $or: [{ image: { $exists: true } }, { miniImage: { $exists: true } }] }).lean();
  
  for (const user of users) {
    const updates: any = {};
    
    if (user.image && isMalformed(user.image)) {
      const cleanPath = extractCleanPath(user.image);
      console.log(`  🔧 User ${user.email}: ${user.image} -> ${cleanPath}`);
      updates.image = cleanPath;
    }
    
    if (user.miniImage && isMalformed(user.miniImage)) {
      const cleanPath = extractCleanPath(user.miniImage);
      console.log(`  🔧 User ${user.email} (mini): ${user.miniImage} -> ${cleanPath}`);
      updates.miniImage = cleanPath;
    }
    
    if (Object.keys(updates).length > 0) {
      if (!DRY_RUN) {
        await User.updateOne({ _id: user._id }, { $set: updates });
      }
      stats.usersFixed++;
    }
  }
  
  console.log(`✅ Fixed ${stats.usersFixed} users`);
}

/**
 * Fix Campaign images
 */
async function fixCampaigns() {
  console.log('\n📢 Checking Campaigns...');
  const campaigns = await Campaign.find({}).lean();
  
  for (const campaign of campaigns) {
    const updates: any = {};
    
    if (campaign.image && isMalformed(campaign.image)) {
      const cleanPath = extractCleanPath(campaign.image);
      console.log(`  🔧 Campaign ${campaign.title}: ${campaign.image} -> ${cleanPath}`);
      updates.image = cleanPath;
    }
    
    // @ts-ignore
    if (campaign.miniImage && isMalformed(campaign.miniImage)) {
      // @ts-ignore
      const cleanPath = extractCleanPath(campaign.miniImage);
      // @ts-ignore
      console.log(`  🔧 Campaign ${campaign.title} (mini): ${campaign.miniImage} -> ${cleanPath}`);
      updates.miniImage = cleanPath;
    }
    
    if (Object.keys(updates).length > 0) {
      if (!DRY_RUN) {
        await Campaign.updateOne({ _id: campaign._id }, { $set: updates });
      }
      stats.campaignsFixed++;
    }
  }
  
  console.log(`✅ Fixed ${stats.campaignsFixed} campaigns`);
}

/**
 * Fix Banner images
 */
async function fixBanners() {
  console.log('\n🎯 Checking Banners...');
  const banners = await Banner.find({}).lean();
  
  for (const banner of banners) {
    const updates: any = {};
    
    if (banner.imageUrl && isMalformed(banner.imageUrl)) {
      const cleanPath = extractCleanPath(banner.imageUrl);
      console.log(`  🔧 Banner ${banner.name}: ${banner.imageUrl} -> ${cleanPath}`);
      updates.imageUrl = cleanPath;
    }
    
    // @ts-ignore
    if (banner.miniImageUrl && isMalformed(banner.miniImageUrl)) {
      // @ts-ignore
      const cleanPath = extractCleanPath(banner.miniImageUrl);
      // @ts-ignore
      console.log(`  🔧 Banner ${banner.name} (mini): ${banner.miniImageUrl} -> ${cleanPath}`);
      updates.miniImageUrl = cleanPath;
    }
    
    if (Object.keys(updates).length > 0) {
      if (!DRY_RUN) {
        await Banner.updateOne({ _id: banner._id }, { $set: updates });
      }
      stats.bannersFixed++;
    }
  }
  
  console.log(`✅ Fixed ${stats.bannersFixed} banners`);
}

/**
 * Fix Category images
 */
async function fixCategories() {
  console.log('\n📂 Checking Categories...');
  const categories = await Category.find({}).lean();
  
  for (const category of categories) {
    const updates: any = {};
    
    if (category.image && isMalformed(category.image)) {
      const cleanPath = extractCleanPath(category.image);
      console.log(`  🔧 Category ${category.name}: ${category.image} -> ${cleanPath}`);
      updates.image = cleanPath;
    }
    
    // @ts-ignore
    if (category.miniImage && isMalformed(category.miniImage)) {
      // @ts-ignore
      const cleanPath = extractCleanPath(category.miniImage);
      // @ts-ignore
      console.log(`  🔧 Category ${category.name} (mini): ${category.miniImage} -> ${cleanPath}`);
      updates.miniImage = cleanPath;
    }
    
    if (Object.keys(updates).length > 0) {
      if (!DRY_RUN) {
        await Category.updateOne({ _id: category._id }, { $set: updates });
      }
      stats.categoriesFixed++;
    }
  }
  
  console.log(`✅ Fixed ${stats.categoriesFixed} categories`);
}

/**
 * Fix Attribute images
 */
async function fixAttributes() {
  console.log('\n🏷️  Checking Attributes...');
  const attributes = await Attribute.find({ 'children.image': { $exists: true } }).lean();
  
  for (const attribute of attributes) {
    if (!attribute.children || attribute.children.length === 0) continue;
    
    let needsUpdate = false;
    const updatedChildren = [];
    
    for (const child of attribute.children) {
      const newChild = { ...child };
      
      if (child.image && isMalformed(child.image)) {
        const cleanPath = extractCleanPath(child.image);
        console.log(`  🔧 Attribute ${attribute.name}/${child.name}: ${child.image} -> ${cleanPath}`);
        newChild.image = cleanPath;
        needsUpdate = true;
      }
      
      // @ts-ignore
      if (child.miniImage && isMalformed(child.miniImage)) {
        // @ts-ignore
        const cleanPath = extractCleanPath(child.miniImage);
        // @ts-ignore
        console.log(`  🔧 Attribute ${attribute.name}/${child.name} (mini): ${child.miniImage} -> ${cleanPath}`);
        // @ts-ignore
        newChild.miniImage = cleanPath;
        needsUpdate = true;
      }
      
      updatedChildren.push(newChild);
    }
    
    if (needsUpdate) {
      if (!DRY_RUN) {
        await Attribute.updateOne({ _id: attribute._id }, { $set: { children: updatedChildren } });
      }
      stats.attributesFixed++;
    }
  }
  
  console.log(`✅ Fixed ${stats.attributesFixed} attributes`);
}

/**
 * Main function
 */
async function main() {
  console.log('🔧 Starting malformed URL fix script\n');
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (preview only)' : '✏️  LIVE RUN (will update database)'}`);
  console.log(`MongoDB: ${MONGO_URL}\n`);
  
  try {
    await mongoose.connect(MONGO_URL);
    console.log('✅ Connected to MongoDB');
    
    await fixProducts();
    await fixUsers();
    await fixCampaigns();
    await fixBanners();
    await fixCategories();
    await fixAttributes();
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary:');
    console.log(`  Products:   ${stats.productsFixed} fixed`);
    console.log(`  Users:      ${stats.usersFixed} fixed`);
    console.log(`  Campaigns:  ${stats.campaignsFixed} fixed`);
    console.log(`  Banners:    ${stats.bannersFixed} fixed`);
    console.log(`  Categories: ${stats.categoriesFixed} fixed`);
    console.log(`  Attributes: ${stats.attributesFixed} fixed`);
    console.log('='.repeat(50));
    
    if (DRY_RUN) {
      console.log('\n🔍 This was a dry run. Run without --dry-run to apply changes.');
    } else {
      console.log('\n✅ All malformed URLs have been fixed!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

main().catch(console.error);
