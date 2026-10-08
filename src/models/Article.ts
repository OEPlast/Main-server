import { Schema, model, InferSchemaType, Types } from 'mongoose';

/** A journal article. The body is a list of blocks so the storefront controls the layout. */
const blockSchema = new Schema(
  {
    type: { type: String, enum: ['lead', 'heading', 'paragraph', 'quote', 'image'], required: true },
    text: { type: String },
    src: { type: String }, // image blocks: bare CDN path or absolute URL
    alt: { type: String },
  },
  { _id: false }
);

const articleSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    excerpt: { type: String, default: '', maxlength: 500 },
    category: { type: String, default: '' }, // value from SiteContent.articleCategories
    image: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    publishedAt: { type: Date },
    body: { type: [blockSchema], default: [] },
    seo: {
      type: new Schema({ title: { type: String }, description: { type: String } }, { _id: false }),
      default: undefined,
    },
  },
  { timestamps: true }
);

articleSchema.index({ status: 1, publishedAt: -1 });
articleSchema.index({ status: 1, category: 1, publishedAt: -1 });

export type ArticleType = InferSchemaType<typeof articleSchema> & { _id: Types.ObjectId };
const Article = model('Article', articleSchema);
export default Article;
