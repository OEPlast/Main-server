/*
 * End-to-end checks for the Doreti additions (catalog, content, support, checkout, reviews,
 * orders, password reset) against a real Main-server process.
 *
 * Needs the local Docker stack (docker compose up -d in the doreti folder): MongoDB on 7007 and
 * Mailpit on 7009/7005. The server under test uses its own database (dropped at the start), an
 * unreachable RabbitMQ (events stay in the outbox), no storefront revalidation and no Bunny, so it
 * never touches the dev stack's data. Its emails go to Mailpit under addresses unique to the run.
 *
 *   npm run test:integration
 *
 * Override with TEST_MONGODB_URI, TEST_SMTP_PORT, TEST_MAILPIT_URL, TEST_PORT.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import mongoose from 'mongoose';

const MONGO = process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:7007/doreti_test?directConnection=true';
const SMTP_PORT = process.env.TEST_SMTP_PORT ?? '7009';
const MAILPIT = (process.env.TEST_MAILPIT_URL ?? 'http://127.0.0.1:7005').replace(/\/$/, '');
const PORT = Number(process.env.TEST_PORT ?? 7199);
const BASE = `http://127.0.0.1:${PORT}`;
const STOREFRONT = 'http://localhost:7000';
const ADMIN_URL = 'http://localhost:7001';

// Addresses unique to this run, so Mailpit's shared inbox can be filtered safely.
const RUN = Date.now().toString(36);
const ADA = `ada.${RUN}@example.com`;
const OWNER = `owner.${RUN}@doreti.test`;
const SUPPORT = `support.${RUN}@doreti.test`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

async function http(method: string, url: string, body?: unknown, token?: string): Promise<{ status: number; json: Json }> {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

type Mail = { to: string; subject: string; text: string };
async function mailsTo(address: string): Promise<Mail[]> {
  const list = (await (await fetch(`${MAILPIT}/api/v1/messages?limit=500`)).json()) as Json;
  const hits = (list.messages ?? []).filter((m: Json) => m.To?.some((t: Json) => t.Address === address));
  return Promise.all(
    hits.map(async (m: Json) => {
      const full = (await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json()) as Json;
      return { to: address, subject: m.Subject as string, text: (full.Text as string) ?? '' };
    })
  );
}
async function waitForMail(address: string, subject: RegExp, ms = 10_000): Promise<Mail> {
  const end = Date.now() + ms;
  let seen: Mail[] = [];
  while (Date.now() < end) {
    seen = await mailsTo(address);
    const hit = seen.find((m) => subject.test(m.subject));
    if (hit) return hit;
    await sleep(250);
  }
  throw new Error(`no email to ${address} matching ${subject}; got: ${seen.map((m) => m.subject).join(' | ') || 'none'}`);
}

let server: ChildProcess;
let serverLog = '';
let db: mongoose.mongo.Db;
const oid = () => new mongoose.Types.ObjectId();
const now = Date.now();
const cats = { necklaces: oid(), tennis: oid(), rings: oid(), gifts: oid() };
const P = { tennis: oid(), cuban: oid(), ring: oid(), box: oid(), draft: oid() };
let admin = '';
let customerToken = '';
let customerId = '';

describe('Doreti Main-server', () => {
  before(async () => {
    await mongoose.connect(MONGO);
    db = mongoose.connection.db!;
    await db.dropDatabase();

    server = spawn(process.execPath, ['-r', 'ts-node/register/transpile-only', '-r', 'tsconfig-paths/register', 'src/server.ts'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PORT: String(PORT),
        MONGODB_URI: MONGO,
        JWT_SECRET: 'x'.repeat(64),
        INTERNAL_SERVICE_KEY: 'i'.repeat(64),
        PEPPER_SECRET: 'p'.repeat(64),
        PAYSTACK_SECRET_KEY: 'sk_test_dummy',
        RABBITMQ_URL: 'amqp://127.0.0.1:1/doreti',
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT,
        SMTP_SECURE: 'false',
        SMTP_USER: '',
        SMTP_PASS: '',
        FROM_EMAIL: 'no-reply@doreti.test',
        STORE_NAME: 'Doreti',
        SUPPORT_EMAIL: SUPPORT,
        STOREFRONT_URL: STOREFRONT,
        FRONTEND_URL: STOREFRONT,
        ORDER_NUMBER_PREFIX: 'DR',
        TICKET_PREFIX: 'DT',
        ADMIN_URL,
        CORS_ORIGINS: STOREFRONT,
        // Explicitly off: dotenv would otherwise fill these from the dev .env
        VYLUX_API_URL: '',
        VYLUX_API_KEY: '',
        BUNNY_STORAGE_ZONE: '',
        BUNNY_ACCESS_KEY: '',
        STOREFRONT_REVALIDATE_URL: '',
        STOREFRONT_REVALIDATE_TAGS_URL: '',
        ADMIN_REVALIDATE_URL: '',
        LOG_LEVEL: 'warn',
      },
    });
    server.stdout!.on('data', (d) => (serverLog += d));
    server.stderr!.on('data', (d) => (serverLog += d));
    for (let i = 0; ; i++) {
      try {
        if ((await fetch(BASE + '/health')).ok) break;
      } catch {
        // not listening yet
      }
      if (i > 180) throw new Error('Main-server did not start\n' + serverLog.slice(-3000));
      await sleep(500);
    }

    await db.collection('settings').insertOne({ storeName: 'Doreti', websiteUrl: STOREFRONT, supportEmail: SUPPORT, currency: 'NGN' });
    await db.collection('categories').insertMany([
      { _id: cats.necklaces, name: 'Necklaces', slug: 'necklaces', parent: [], priority: true },
      { _id: cats.tennis, name: 'Tennis', slug: 'tennis', parent: [cats.necklaces] },
      { _id: cats.rings, name: 'Rings', slug: 'rings', parent: [], sizeChart: 'ring' },
      { _id: cats.gifts, name: 'Gift Boxes', slug: 'gift-boxes', parent: [], isAddOnCategory: true },
    ]);
    const base = (o: Json) => ({
      description: 'desc',
      weight: 0.2,
      height: 5,
      width: 10,
      length: 10,
      lowStockThreshold: 5,
      description_images: [{ url: 'product/x.webp', cover_image: true, mediaType: 'image' }],
      specifications: [],
      tags: [],
      attributes: [],
      status: 'active',
      updatedAt: new Date(now),
      ...o,
    });
    await db.collection('products').insertMany([
      base({ _id: P.tennis, sku: 1, name: 'VVS Tennis Necklace', slug: 'vvs-tennis-necklace', price: 120000, stock: 100, originStock: 100, category: cats.tennis, tags: ['women'], specifications: [{ key: 'Material', value: '925 Sterling Silver' }], attributes: [{ name: 'Metal', children: [{ name: 'Gold', stock: 50, colorCode: '#D4AF37', images: ['product/gold.webp'] }, { name: 'Silver', stock: 50, colorCode: '#C0C0C0' }] }], addOns: [P.box], createdAt: new Date(now) }),
      base({ _id: P.cuban, sku: 2, name: 'Miami Cuban Chain', slug: 'miami-cuban-chain', price: 85000, stock: 100, originStock: 100, category: cats.necklaces, tags: ['men'], specifications: [{ key: 'Material', value: 'Stainless Steel' }], createdAt: new Date(now - 60 * 86400000) }),
      base({ _id: P.ring, sku: 3, name: 'Solitaire Ring', slug: 'solitaire-ring', price: 45000, stock: 0, originStock: 0, category: cats.rings, attributes: [{ name: 'Ring Size', children: [{ name: '6', stock: 0 }, { name: '7', stock: 0 }] }], createdAt: new Date(now - 10 * 86400000) }),
      base({ _id: P.box, sku: 4, name: 'Velvet Gift Box', slug: 'velvet-gift-box', price: 5000, stock: 100, originStock: 100, category: cats.gifts, createdAt: new Date(now - 90 * 86400000) }),
      base({ _id: P.draft, sku: 5, name: 'Draft Necklace', slug: 'draft-necklace', price: 1, stock: 100, originStock: 100, category: cats.necklaces, status: 'inactive', createdAt: new Date(now) }),
    ]);
    await db.collection('orders').insertOne({ user: oid(), orderNumber: 'DR-TEST-0001', products: [{ product: P.cuban, qty: 5, price: 85000 }, { product: P.tennis, qty: 1, price: 120000 }], isPaid: true, status: 'Processing', total: 545000, deliveryType: 'shipping', shippingPrice: 0, createdAt: new Date(now - 86400000) });
  });

  after(async () => {
    server?.kill();
    await mongoose.disconnect().catch(() => undefined);
  });

  // ---------------------------------------------------------------- accounts
  describe('accounts', () => {
    test('register returns a token, records marketing opt-in, never the password hash', async () => {
      const reg = await http('POST', '/auth/register', { email: ADA, password: 'secret123', firstName: 'Ada', lastName: 'Okonkwo', marketingEmails: true, marketingTexts: true });
      assert.equal(reg.status, 201, JSON.stringify(reg.json));
      customerToken = reg.json.data.token;
      customerId = reg.json.data.newUser._id;
      assert.ok(customerToken);
      assert.equal(reg.json.data.newUser.password, undefined);
      assert.equal(reg.json.data.newUser.tokenVersion, undefined);
      await sleep(300);
      const u = await db.collection('users').findOne({ email: ADA });
      assert.equal(u?.emailPreferences?.marketing, true);
      assert.equal(u?.marketingTexts, true);
    });
    test('owner can sign in', async () => {
      await http('POST', '/auth/register', { email: OWNER, password: 'secret123', firstName: 'Owner', lastName: 'One' });
      await db.collection('users').updateOne({ email: OWNER }, { $set: { role: 'owner', emailVerified: new Date() } });
      const login = await http('POST', '/auth/login', { email: OWNER, password: 'secret123' });
      admin = login.json?.data?.token;
      assert.ok(admin, JSON.stringify(login.json));
    });
    test('GET /user/me and PUT /user/profile with a phone number', async () => {
      const r = await http('GET', '/user/me', undefined, customerToken);
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.json.data.email, ADA);
      assert.equal(r.json.data.phone, '');
      assert.equal(r.json.data.emailVerified, false);
      const p = await http('PUT', '/user/profile', { phoneNumber: '+2348012345678' }, customerToken);
      assert.equal(p.status, 200, JSON.stringify(p.json));
      assert.equal((await http('GET', '/user/me', undefined, customerToken)).json.data.phone, '+2348012345678');
    });
  });

  // ---------------------------------------------------------------- catalog
  describe('catalog', () => {
    const sr = (q: string) => http('GET', '/products/search-results?' + q);
    const slugs = (r: { json: Json }) => r.json.data.map((p: Json) => p.slug);

    test('category includes subcategories, excludes drafts, adds badges', async () => {
      const r = await sr('category=necklaces&limit=20');
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.deepEqual(r.json.data.map((p: Json) => p.name).sort(), ['Miami Cuban Chain', 'VVS Tennis Necklace']);
      assert.deepEqual(r.json.data.find((p: Json) => p.slug === 'vvs-tennis-necklace').badges, { isNew: true, isBestSeller: true });
      assert.deepEqual(r.json.data.find((p: Json) => p.slug === 'miami-cuban-chain').badges, { isNew: false, isBestSeller: true });
      assert.equal(r.json.meta.total, 2);
    });
    test('best sellers by units sold; new arrivals in the 30-day window', async () => {
      assert.deepEqual(slugs(await sr('collection=best-sellers')), ['miami-cuban-chain', 'vvs-tennis-necklace']);
      assert.deepEqual(slugs(await sr('collection=new-arrivals')).sort(), ['solitaire-ring', 'vvs-tennis-necklace']);
      assert.equal(slugs(await sr('sortBy=sales&limit=10'))[0], 'miami-cuban-chain');
    });
    test('best seller picks fill the list after real sellers, and clear again', async () => {
      const set = await http('PUT', '/settings', { bestSellerPicks: [String(P.ring), String(P.cuban)] }, admin);
      assert.equal(set.status, 200, JSON.stringify(set.json));
      assert.deepEqual(slugs(await sr('collection=best-sellers')), ['miami-cuban-chain', 'vvs-tennis-necklace', 'solitaire-ring']);
      const ring = await http('GET', '/products/by-slug/solitaire-ring');
      assert.equal(ring.json.data.badges.isBestSeller, true);
      await http('PUT', '/settings', { bestSellerPicks: [] }, admin);
      assert.deepEqual(slugs(await sr('collection=best-sellers')), ['miami-cuban-chain', 'vvs-tennis-necklace']);
    });
    test('add-on products stay out of plain browsing but not their category, search or ids', async () => {
      assert.ok(!slugs(await sr('limit=50')).includes('velvet-gift-box'));
      assert.deepEqual(slugs(await sr('category=gift-boxes')), ['velvet-gift-box']);
      assert.deepEqual(slugs(await sr('q=velvet')), ['velvet-gift-box']);
      assert.deepEqual(slugs(await sr(`ids=${P.box},${P.tennis},${P.draft}`)), ['velvet-gift-box', 'vvs-tennis-necklace']);
    });
    test('specs, tags, attributes and price filters; unknown category 404', async () => {
      assert.deepEqual(slugs(await sr('specs=' + encodeURIComponent('Material:Stainless Steel'))), ['miami-cuban-chain']);
      assert.deepEqual(slugs(await sr('tags=women&attributes=' + encodeURIComponent('Metal:Gold') + '&minPrice=100000')), ['vvs-tennis-necklace']);
      assert.equal((await sr('category=nope')).status, 404);
    });
    test('search filters scoped to a category', async () => {
      const r = await http('GET', '/products/search-filters?category=necklaces');
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.ok(r.json.data.attributes.find((a: Json) => a.name === 'Metal'));
      assert.deepEqual(r.json.data.specifications.map((s: Json) => s.key), ['Material']);
      assert.equal(r.json.data.priceRange.min, 85000);
    });
    test('category tree with rolled-up counts and collections', async () => {
      const r = await http('GET', '/categories/tree');
      assert.equal(r.status, 200, JSON.stringify(r.json));
      const neck = r.json.data.categories.find((c: Json) => c.slug === 'necklaces');
      assert.equal(neck.count, 2);
      assert.equal(neck.children[0].slug, 'tennis');
      assert.equal(r.json.data.categories.find((c: Json) => c.slug === 'gift-boxes').isAddOnCategory, true);
      assert.equal(r.json.data.collections.find((c: Json) => c.key === 'best-sellers').count, 2);
    });
    test('product detail: size chart from the category, option images, add-ons, related', async () => {
      assert.equal((await http('GET', '/products/by-slug/solitaire-ring')).json.data.sizeChart, 'ring');
      assert.deepEqual((await http('GET', '/products/by-slug/vvs-tennis-necklace')).json.data.attributes[0].children[0].images, ['product/gold.webp']);
      assert.deepEqual((await http('GET', `/products/${P.tennis}/add-ons`)).json.data.map((p: Json) => p.slug), ['velvet-gift-box']);
      assert.deepEqual((await http('GET', `/products/${P.cuban}/add-ons`)).json.data.map((p: Json) => p.slug), ['velvet-gift-box']);
      assert.equal((await http('GET', `/products/${P.tennis}/related`)).status, 200);
    });
    test('admin product create accepts the shipping and merchandising fields', async () => {
      const r = await http('POST', '/admin/products/create', { sku: 77, name: 'Pearl Studs', description: 'Freshwater pearls', price: 30000, category: String(cats.necklaces), stock: 10, weight: 0.1, height: 3, width: 3, length: 3, isVolumetric: false, status: 'active', lowStockThreshold: 2, sizeChart: 'ring', addOns: [String(P.box)], attributes: [{ name: 'Metal', children: [{ name: 'Gold', stock: 10, images: ['product/p.webp'] }] }] }, admin);
      assert.equal(r.status, 201, JSON.stringify(r.json));
      assert.equal(r.json.data.status, 'active');
      assert.equal(r.json.data.lowStockThreshold, 2);
      assert.equal(r.json.data.weight, 0.1);
    });
  });

  // ---------------------------------------------------------------- content
  describe('content', () => {
    test('site content: home, about, testimonials and popular searches', async () => {
      const r = await http(
        'PUT',
        '/admin/content/site',
        {
          popularSearches: ['Tennis chain', 'Moissanite'],
          testimonials: [{ quote: 'Lovely!', author: 'Bisi' }],
          articleCategories: [{ value: 'lifestyle', label: 'Lifestyle' }],
          home: { hero: { image: 'content/hero.webp', title: 'Shine daily', ctaLabel: 'Shop', ctaHref: '/shop' }, tiles: [{ image: 'content/w.webp', label: 'Shop Women', href: '/shop?gender=women' }], feature: { image: '', title: '', text: '', ctaLabel: '', ctaHref: '' } },
          about: { hero: { image: '', title: 'Our story', text: 'Since 2026' }, quote: { text: 'Wear it every day.', author: 'Founder' }, mission: { image: '', title: 'Promise', text: 'Fair prices' }, milestones: [{ image: '', title: 'Launch', text: 'First pieces' }] },
        },
        admin
      );
      assert.equal(r.status, 200, JSON.stringify(r.json));
      const home = (await http('GET', '/content/home')).json.data;
      assert.equal(home.testimonials[0].author, 'Bisi');
      assert.equal(home.home.hero.title, 'Shine daily');
      assert.equal(home.home.tiles[0].label, 'Shop Women');
      assert.equal(home.about.quote.text, 'Wear it every day.');
      assert.equal(home.about.milestones[0].title, 'Launch');
      assert.deepEqual((await http('GET', '/search/suggestions?q=')).json.data.terms, ['Tennis chain', 'Moissanite']);
      const bad = await http('PUT', '/admin/content/site', { home: { tiles: [{ label: 'x' }] } }, admin);
      assert.equal(bad.status, 400);
    });
    test('search suggestions', async () => {
      const s = await http('GET', '/search/suggestions?q=ten');
      assert.equal(s.status, 200, JSON.stringify(s.json));
      assert.ok(s.json.data.terms.includes('Tennis'), JSON.stringify(s.json.data.terms));
      assert.equal(s.json.data.products[0].slug, 'vvs-tennis-necklace');
    });
    test('customers cannot use admin content routes', async () => {
      assert.equal((await http('PUT', '/admin/content/site', { popularSearches: [] }, customerToken)).status, 403);
    });
    test('articles: featured, upNext, drafts hidden, sitemap', async () => {
      const a1 = await http('POST', '/admin/content/articles', { title: 'How to care for silver', excerpt: 'Keep it shiny', category: 'lifestyle', status: 'published', publishedAt: new Date(now - 86400000).toISOString(), body: [{ type: 'lead', text: 'Silver tarnishes.' }, { type: 'image', src: 'articles/a.webp', alt: 'ring' }] }, admin);
      assert.equal(a1.status, 201, JSON.stringify(a1.json));
      assert.equal(a1.json.data.slug, 'how-to-care-for-silver');
      assert.equal((await http('POST', '/admin/content/articles', { title: 'New drop', status: 'published', body: [{ type: 'paragraph', text: 'Out now' }] }, admin)).status, 201);
      await http('POST', '/admin/content/articles', { title: 'Secret draft' }, admin);
      assert.equal((await http('POST', '/admin/content/articles', { title: 'x', body: [{ type: 'image' }] }, admin)).status, 400);
      const list = (await http('GET', '/articles')).json.data;
      assert.equal(list.featured.slug, 'new-drop');
      assert.deepEqual(list.items.map((a: Json) => a.slug), ['how-to-care-for-silver']);
      const detail = (await http('GET', '/articles/how-to-care-for-silver')).json.data;
      assert.equal(detail.article.body.length, 2);
      assert.deepEqual(detail.upNext.map((a: Json) => a.slug), ['new-drop']);
      assert.equal((await http('GET', '/articles/secret-draft')).status, 404);
      assert.equal((await http('GET', '/sitemap/articles')).json.data.length, 2);
    });
    test('FAQs, legal pages and size charts', async () => {
      assert.equal((await http('POST', '/admin/content/faqs', { label: 'Shipping', order: 1, items: [{ question: 'How long?', answer: '2-5 days' }] }, admin)).status, 201);
      assert.equal((await http('GET', '/content/faqs')).json.data[0].key, 'shipping');
      assert.equal((await http('POST', '/admin/content/legal', { title: 'Privacy Policy', effectiveDate: '2026-10-01', intro: 'We care', sections: [{ id: 'data', heading: 'Data', body: 'We keep little.' }] }, admin)).status, 201);
      assert.equal((await http('GET', '/content/legal/privacy-policy')).json.data.sections[0].heading, 'Data');
      assert.equal((await http('POST', '/admin/content/size-charts', { title: 'Ring', columns: ['US', 'Diameter (mm)'], rows: [['6']] }, admin)).status, 400);
      assert.equal((await http('POST', '/admin/content/size-charts', { title: 'Ring', columns: ['US', 'Diameter (mm)'], rows: [['6', '16.5'], ['7', '17.3']], howToMeasure: [{ label: 'String', text: 'Wrap a string' }] }, admin)).status, 201);
      assert.equal((await http('GET', '/content/size-charts/ring')).json.data.rows.length, 2);
    });
  });

  // ---------------------------------------------------------------- support
  describe('support', () => {
    test('contact form opens a ticket and emails the customer and support', async () => {
      const r = await http('POST', '/contact', { name: 'Ada Okonkwo', email: ADA, topic: 'sizing', orderNumber: 'dr-test-0001', message: 'Does the ring run small? I wear a 7.' });
      assert.equal(r.status, 201, JSON.stringify(r.json));
      assert.equal(r.json.data.id, 'DT-000001');
      assert.match((await waitForMail(ADA, /DT-000001/)).text, /I wear a 7/);
      assert.match((await waitForMail(SUPPORT, /New sizing message/)).text, new RegExp(`${ADMIN_URL}/support/tickets/`));
      const bad = await http('POST', '/contact', { name: '', email: 'nope', topic: 'x', message: 'short' });
      assert.equal(bad.status, 400);
      assert.ok(bad.json.errors.length >= 3);
    });
    test('support inbox: list, detail with order, emailed reply', async () => {
      const list = await http('GET', '/admin/support/tickets', undefined, admin);
      assert.equal(list.status, 200, JSON.stringify(list.json));
      assert.equal(list.json.meta.open, 1);
      const ticketId = list.json.data[0]._id;
      assert.equal((await http('GET', `/admin/support/tickets/${ticketId}`, undefined, admin)).json.data.order.orderNumber, 'DR-TEST-0001');
      const note = await http('POST', `/admin/support/tickets/${ticketId}/notes`, { text: 'It runs true to size.', email: true }, admin);
      assert.equal(note.status, 200, JSON.stringify(note.json));
      assert.equal(note.json.data.status, 'pending');
      await waitForMail(ADA, /^Re: your message/);
      assert.equal((await http('GET', '/admin/notifications/summary', undefined, admin)).json.data.counts.openTickets, 0);
    });
    test('stock alert for one option, emailed once when that option is back', async () => {
      assert.equal((await http('POST', `/products/${P.ring}/stock-alerts`, { email: ADA, attribute: { name: 'Ring Size', value: '9' } })).status, 400);
      assert.equal((await http('POST', `/products/${P.ring}/stock-alerts`, { email: ADA, attribute: { name: 'Ring Size', value: '7' } })).status, 201);
      assert.equal((await http('POST', `/products/${P.ring}/stock-alerts`, { email: ADA, attribute: { name: 'Ring Size', value: '7' } })).status, 201);
      assert.equal(await db.collection('stockalerts').countDocuments(), 1);
      let u = await http('PATCH', `/admin/products/${P.ring}`, { stock: 3, attributes: [{ name: 'Ring Size', children: [{ name: '6', stock: 3 }, { name: '7', stock: 0 }] }] }, admin);
      assert.equal(u.status, 200, JSON.stringify(u.json));
      await sleep(1000);
      assert.equal((await mailsTo(ADA)).filter((m) => /back in stock/i.test(m.subject)).length, 0);
      u = await http('PATCH', `/admin/products/${P.ring}`, { stock: 5, attributes: [{ name: 'Ring Size', children: [{ name: '6', stock: 3 }, { name: '7', stock: 2 }] }] }, admin);
      assert.equal(u.status, 200, JSON.stringify(u.json));
      const mail = await waitForMail(ADA, /back in stock/i);
      assert.match(mail.text, /Ring Size: 7/);
      assert.match(mail.text, new RegExp(`${STOREFRONT}/product/solitaire-ring`));
      assert.ok((await db.collection('stockalerts').findOne({}))?.notifiedAt);
    });
  });

  // ---------------------------------------------------------------- checkout
  describe('checkout', () => {
    test('pickup locations and shipping options', async () => {
      assert.equal((await http('POST', '/admin/pickup-locations', { name: 'Lekki Studio', address: '1 Admiralty Way', city: 'Lekki', state: 'Lagos', readyIn: 'Ready in 24 hours' }, admin)).status, 201);
      assert.equal((await http('GET', '/checkout/pickup-locations')).json.data[0].name, 'Lekki Studio');
      const opts = await http('POST', '/checkout/shipping-options', { items: [{ productId: String(P.tennis), qty: 1 }] });
      assert.equal(opts.status, 200, JSON.stringify(opts.json));
      const byId = Object.fromEntries(opts.json.data.options.map((o: Json) => [o.id, o]));
      assert.equal(byId.shipping.price, null);
      assert.equal(byId.pickup.price, 0);
      assert.equal(byId.pickup.eta, 'Ready in 24 hours');
      assert.equal(byId.gig.requiresQuote, true);
      assert.equal(opts.json.data.itemsSubtotal, 120000);
    });
  });

  // ---------------------------------------------------------------- reviews
  describe('reviews', () => {
    const reviewId = oid();
    before(async () => {
      await db.collection('reviews').insertOne({ _id: reviewId, product: P.tennis, reviewBy: new mongoose.Types.ObjectId(customerId), rating: 5, review: 'Beautiful and sparkly necklace', images: ['reviews/r1.webp'], recommends: true, transactionId: oid(), orderId: oid(), likes: [], replies: [], helpfulVotes: { helpful: [], notHelpful: [] }, createdAt: new Date(), updatedAt: new Date() });
    });
    test('list: verified, recommends, counts, total', async () => {
      const r = await http('GET', `/reviews/product/${P.tennis}`);
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.json.data[0].verified, true);
      assert.equal(r.json.data[0].recommends, true);
      assert.equal(r.json.meta.total, 1);
    });
    test('helpful votes toggle and switch; signed-out votes refused', async () => {
      let v = await http('POST', `/reviews/${reviewId}/vote`, { helpful: true }, admin);
      assert.deepEqual(v.json.data, { helpfulCount: 1, notHelpfulCount: 0, userVote: 'helpful' });
      v = await http('POST', `/reviews/${reviewId}/vote`, { helpful: false }, admin);
      assert.deepEqual(v.json.data, { helpfulCount: 0, notHelpfulCount: 1, userVote: 'not-helpful' });
      v = await http('POST', `/reviews/${reviewId}/vote`, { helpful: false }, admin);
      assert.deepEqual(v.json.data, { helpfulCount: 0, notHelpfulCount: 0, userVote: null });
      assert.equal((await http('POST', `/reviews/${reviewId}/vote`, { helpful: true })).status, 401);
      assert.equal((await http('GET', `/reviews/product/${P.tennis}?sortBy=most-helpful`)).status, 200);
    });
    test('stats: gallery and recommend %', async () => {
      const r = (await http('GET', `/reviews/product/${P.tennis}/stats`)).json.data;
      assert.deepEqual(r.gallery, ['reviews/r1.webp']);
      assert.equal(r.recommendPercent, 100);
      assert.equal(r.totalRatings, 1);
    });
  });

  // ---------------------------------------------------------------- orders
  describe('orders', () => {
    const orderId = oid();
    before(async () => {
      await db.collection('orders').insertOne({ _id: orderId, user: new mongoose.Types.ObjectId(customerId), orderNumber: 'DR-2610-00001', products: [{ product: P.tennis, qty: 1, price: 120000, attributes: [{ name: 'Metal', value: 'Gold' }] }], isPaid: true, paidAt: new Date(now - 3600000), status: 'Processing', total: 120000, totalBeforeDiscount: 120000, couponDiscount: 0, deliveryType: 'shipping', shippingPrice: 0, shippingAddress: { firstName: 'Ada', lastName: 'O', city: 'Ikeja', state: 'Lagos', country: 'Nigeria' }, createdAt: new Date(now - 7200000), updatedAt: new Date() });
    });
    test('guest tracking needs the matching email', async () => {
      assert.equal((await http('POST', '/orders/track', { orderNumber: 'DR-2610-00001', email: 'other@example.com' })).status, 404);
      const r = await http('POST', '/orders/track', { orderNumber: 'dr-2610-00001', email: ADA });
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.json.data.fulfillmentStatus, 'processing');
      assert.deepEqual(r.json.data.steps.map((s: Json) => s.state), ['done', 'current', 'upcoming', 'upcoming', 'upcoming']);
      assert.equal(r.json.data.order.items[0].name, 'VVS Tennis Necklace');
    });
    test('a shipment moves the order to shipped; only the owner sees it', async () => {
      await db.collection('shipments').insertOne({ orderId, trackingNumber: 'TRK1', courier: 'Doreti Courier', status: 'In-Transit', cost: 0, trackingHistory: [{ location: 'Lagos hub', timestamp: new Date(now - 1800000), description: 'Left the hub' }], createdAt: new Date(now - 1800000) });
      const r = await http('GET', `/myorder/orders/${orderId}/tracking`, undefined, customerToken);
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.json.data.fulfillmentStatus, 'shipped');
      assert.equal(r.json.data.trackingNumber, 'TRK1');
      assert.equal((await http('GET', '/myorder/orders', undefined, customerToken)).json.data.orders[0].fulfillmentStatus, 'shipped');
      assert.equal((await http('GET', `/myorder/orders/${orderId}/tracking`, undefined, admin)).status, 404);
    });
  });

  // ---------------------------------------------------------------- password reset by link
  describe('password reset', () => {
    test('generic answer, single-use link, old sessions end', async () => {
      const unknown = await http('POST', '/auth/forgot-password', { email: `nobody.${RUN}@example.com` });
      const r = await http('POST', '/auth/forgot-password', { email: ADA });
      assert.equal(r.status, 200);
      assert.equal(r.json.message, unknown.json.message);
      const mail = await waitForMail(ADA, /Reset your Doreti password/);
      const token = decodeURIComponent(mail.text.match(/reset-password\?token=([^\s]+)/)![1]);
      assert.equal((await http('POST', '/auth/reset-password', { token, password: 'newsecret456' })).status, 200);
      assert.equal((await http('POST', '/auth/reset-password', { token, password: 'another789' })).status, 400);
      assert.equal((await http('GET', '/user/me', undefined, customerToken)).status, 401);
      assert.equal((await http('POST', '/auth/login', { email: ADA, password: 'newsecret456' })).status, 200);
      await waitForMail(ADA, /password was changed/i);
    });
  });

  // ---------------------------------------------------------------- Rawura behaviour without Doreti env
  describe('unchanged without Doreti settings', () => {
    test('Vylux import is off without VYLUX_* (status, list, Add product)', async () => {
      assert.deepEqual((await http('GET', '/admin/vylux/status', undefined, admin)).json.data, { configured: false });
      assert.equal((await http('GET', '/admin/vylux/products', undefined, admin)).status, 503);
      assert.equal((await http('POST', '/admin/vylux/products/1/prepare', undefined, admin)).status, 503);
    });
    test('existing product and category lists respond as before', async () => {
      const p = await http('GET', '/products/all?limit=5');
      assert.equal(p.status, 200);
      assert.ok(Array.isArray(p.json.data));
      const c = await http('GET', '/categories');
      assert.equal(c.status, 200);
      assert.ok(Array.isArray(c.json.data));
    });
  });
});
