import { Schema, model, InferSchemaType, Types } from 'mongoose';

/**
 * Storefront content that isn't a product or a page of its own (singleton, read with findOne):
 * home hero, tiles and feature block, testimonials and Instagram tiles, popular searches,
 * article categories and the newsletter popup.
 */
const siteContentSchema = new Schema(
  {
    // Home page imagery and copy. Image fields hold CDN paths (or absolute URLs); an empty hero
    // image shows a plain text hero, and tiles without an image are skipped.
    home: {
      type: new Schema(
        {
          hero: {
            type: new Schema(
              {
                image: { type: String, default: '' },
                title: { type: String, default: '' },
                ctaLabel: { type: String, default: '' },
                ctaHref: { type: String, default: '' },
              },
              { _id: false }
            ),
            default: {},
          },
          tiles: {
            type: [new Schema({ image: { type: String, required: true }, label: { type: String, required: true }, href: { type: String, required: true } }, { _id: false })],
            default: [],
          },
          feature: {
            type: new Schema(
              {
                image: { type: String, default: '' },
                title: { type: String, default: '' },
                text: { type: String, default: '' },
                ctaLabel: { type: String, default: '' },
                ctaHref: { type: String, default: '' },
              },
              { _id: false }
            ),
            default: {},
          },
        },
        { _id: false }
      ),
      default: {},
    },
    // About page: hero, an optional quote, the mission block and milestone cards. Empty fields
    // are hidden on the storefront (images are CDN paths or absolute URLs).
    about: {
      type: new Schema(
        {
          hero: {
            type: new Schema({ image: { type: String, default: '' }, title: { type: String, default: '' }, text: { type: String, default: '' } }, { _id: false }),
            default: {},
          },
          quote: {
            type: new Schema({ text: { type: String, default: '' }, author: { type: String, default: '' } }, { _id: false }),
            default: {},
          },
          mission: {
            type: new Schema({ image: { type: String, default: '' }, title: { type: String, default: '' }, text: { type: String, default: '' } }, { _id: false }),
            default: {},
          },
          milestones: {
            type: [new Schema({ image: { type: String, default: '' }, title: { type: String, required: true }, text: { type: String, default: '' } }, { _id: false })],
            default: [],
          },
        },
        { _id: false }
      ),
      default: {},
    },
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
