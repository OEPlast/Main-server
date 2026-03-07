import mongoose from 'mongoose';
import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const BUNNY_BASE_URL = process.env.BUNNY_BASE_URL;

  // Check what original file extensions exist - try common extensions
  const testPaths = [
    'general/d97516e5-6f0d-4e77-9821-21797e1460b1-1761177974955-879728573',
    'products/bags2',
    'products/bags1',
    'general/3e397294-f1cb-438c-9133-09a162d178c2-1766559801883-277813152',
    'general/cb559b69-0f8b-4550-a42f-a856e917fb5e-1761179891642-547058260',
  ];
  const extensions = ['.jpeg', '.jpg', '.png', '.webp', '.gif', '.avif', '.JPEG', '.JPG', '.PNG'];

  console.log('Probing CDN for original files...\n');
  
  for (const basePath of testPaths) {
    let found = false;
    for (const ext of extensions) {
      const fullUrl = `https://${BUNNY_BASE_URL}/${basePath}${ext}`;
      try {
        const res = await axios.head(fullUrl, { timeout: 5000 });
        console.log(`FOUND (${res.status}): ${fullUrl} [${res.headers['content-type']}, ${res.headers['content-length']} bytes]`);
        found = true;
      } catch {
        // skip
      }
    }
    if (!found) {
      console.log(`NOT FOUND: ${basePath}.* (tried all extensions)`);
    }
  }

  await mongoose.disconnect();
}

check().catch(console.error);
