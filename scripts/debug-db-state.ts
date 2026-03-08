/**
 * Debug script to check current DB state and verify CDN images
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import axios from 'axios';
import Banner from '../src/models/Banner';
import Product from '../src/models/Product';
import Category from '../src/models/Category';

dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const BUNNY_BASE_URL = process.env.BUNNY_BASE_URL;
  console.log('BUNNY_BASE_URL:', BUNNY_BASE_URL);

  // Check Banner images
  const banners = await Banner.find({}).lean();
  console.log('\n=== BANNERS ===');
  for (const b of banners) {
    console.log(JSON.stringify({ name: b.name, imageUrl: b.imageUrl, miniImageUrl: (b as any).miniImageUrl }));
  }

  // Check a few products
  const products = await Product.find({}).limit(3).lean();
  console.log('\n=== PRODUCTS (first 3) ===');
  for (const p of products) {
    if (p.description_images && p.description_images.length) {
      console.log(p.name + ':', JSON.stringify(p.description_images.map((i: any) => ({ url: i.url, miniUrl: i.miniUrl }))));
    }
  }

  // Check categories
  const cats = await Category.find({}).lean();
  console.log('\n=== CATEGORIES ===');
  for (const c of cats) {
    console.log(JSON.stringify({ name: c.name, image: c.image, miniImage: (c as any).miniImage }));
  }

  // Test if files actually exist on CDN
  console.log('\n=== CDN VERIFICATION ===');
  const testUrls: Array<{ label: string; path: string }> = [];

  for (const b of banners.slice(0, 2)) {
    if (b.imageUrl) testUrls.push({ label: `Banner: ${b.name}`, path: b.imageUrl });
    if ((b as any).miniImageUrl) testUrls.push({ label: `Banner mini: ${b.name}`, path: (b as any).miniImageUrl });
  }

  for (const p of products.slice(0, 1)) {
    if (p.description_images?.[0]?.url) {
      testUrls.push({ label: `Product: ${p.name}`, path: p.description_images[0].url });
      if (p.description_images[0].miniUrl) {
        testUrls.push({ label: `Product mini: ${p.name}`, path: p.description_images[0].miniUrl });
      }
    }
  }

  for (const url of testUrls) {
    const fullUrl = `https://${BUNNY_BASE_URL}/${url.path.replace(/^\//, '')}`;
    try {
      const res = await axios.head(fullUrl, { timeout: 5000 });
      console.log(`  ✅ EXISTS (${res.status}): ${fullUrl}`);
    } catch (err: any) {
      const status = err.response ? err.response.status : 'NETWORK_ERROR';
      console.log(`  ❌ MISSING (${status}): ${fullUrl}`);
    }
  }

  await mongoose.disconnect();
}

check().catch(console.error);
