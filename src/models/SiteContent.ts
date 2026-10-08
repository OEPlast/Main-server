import { Schema, model, InferSchemaType, Types } from 'mongoose';

/**
 * Storefront content that isn't a product or a page of its own (singleton, read with findOne):
 * home testimonials and Instagram tiles, popular searches, article categories and the
 * newsletter popup.
 */
const siteContentSchema = new Schema(
  {
    testimonials: {
      type: [new Schema({ quote: { type: String, required: true }, author: { type: String, required: true } }, { _id: false })],
      default: [],
    },
    instagram: {
      type: [new Schema({ image: { type: String, required: true }, link: { type: String } }, { _id: false })],
      default: [],
    },
    popularSearches: { type: [String], default: [] },
    articleCategories: {
      type: [new Schema({ value: { type: String, required: true }, label: { type: String, required: true } }, { _id: false })],
      default: [],
    },
    newsletterPopup: {
      type: new Schema(
        {
          enabled: { type: Boolean, default: false },
          headline: { type: String, default: '' },
          body: { type: String, default: '' },
          // A normal coupon code (created on the Coupons page) sent in the welcome email.
          couponCode: { type: String, default: '' },
        },
        { _id: false }
      ),
      default: {},
    },
  },
  { timestamps: true }
);

export type SiteContentType = InferSchemaType<typeof siteContentSchema> & { _id: Types.ObjectId };
const SiteContent = model('SiteContent', siteContentSchema);
export default SiteContent;
