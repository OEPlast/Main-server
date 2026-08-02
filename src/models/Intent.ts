import { model, Schema, InferSchemaType } from 'mongoose';

/**
 * Intent shop — a curated SEO landing page at storefront `/shop/<slug>`.
 *
 * Each document targets one "I need X" search intent (category x attribute x
 * price x use-case) and lists a hand-picked set of products. `products` is an
 * ORDERED array: its order is the display order on the storefront, set by
 * dragging in the admin panel. Mongoose `populate` preserves array order, so no
 * separate sort index is needed.
 *
 * These are curated, NOT mass-generated: publishing lots of thin variants
 * creates doorway pages that damage the whole domain.
 */
const intentFaqSchema = new Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
  },
  { _id: false }
);

/**
 * Below this, a page is too thin to be worth indexing. Enforced on publish
 * (see the pre-validate hook) and again by the storefront at render time.
 */
export const MIN_PUBLISHED_PRODUCTS = 3;

const intentSchema = new Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-z0-9-_]+$/,
        'slug may only contain lowercase letters, numbers, underscores, and hyphens',
      ],
    },
    /** Page <h1>. */
    heading: { type: String, required: true, trim: true },
    /** <title> — the brand suffix is appended by the storefront template. */
    title: { type: String, required: true, trim: true },
    /** Meta description + intro copy. */
    description: { type: String, required: true, trim: true },
    keywords: { type: [String], default: [] },
    /** Optional longer intro paragraph rendered above the product grid. */
    intro: { type: String, trim: true },
    /** Hand-picked products, in display order. */
    products: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    faqs: { type: [intentFaqSchema], default: [] },
    status: {
      type: String,
      enum: ['active', 'inactive', 'draft'],
      default: 'draft',
    },
  },
  { timestamps: true }
);

// `slug` already declares `unique: true` above, which creates the index —
// repeating it here would trigger Mongoose's duplicate-index warning.
// The storefront lists only published intents, ordered newest-first.
intentSchema.index({ status: 1, updatedAt: -1 });

intentSchema.pre('validate', function (next) {
  const count = this.products?.length || 0;

  if (count === 0) {
    return next(new Error('Select at least one product for this intent shop.'));
  }

  // A published page that is too thin gets indexed and then 404s once the
  // storefront's own gate rejects it — so block publishing rather than saving.
  if (this.status === 'active' && count < MIN_PUBLISHED_PRODUCTS) {
    return next(
      new Error(
        `An active intent shop needs at least ${MIN_PUBLISHED_PRODUCTS} products (this one has ${count}). Save it as a draft instead.`
      )
    );
  }

  // Duplicates would render the same product twice in the grid.
  const ids = (this.products || []).map((p) => String(p));
  if (new Set(ids).size !== ids.length) {
    return next(new Error('The same product cannot be added twice.'));
  }

  next();
});

export type IIntent = InferSchemaType<typeof intentSchema>;

const Intent = model('Intent', intentSchema);
export default Intent;
