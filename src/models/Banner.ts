import mongoose, { InferSchemaType } from 'mongoose';

const bannerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    miniImageUrl: {
      type: String,
      required: false, // Minified version (optional for backward compatibility)
    },
    pageLink: {
      type: String,
      required: true,
      validate: {
        validator: function (v: string) {
          return /^\/.*/.test(v);
        },
        message: `not a valid page link! Must start with '/'`,
      },
    },
    headerText: {
      type: String,
      trim: true,
    },
    mainText: {
      type: String,
      trim: true,
    },
    CTA: {
      type: String,
      default: '#',
      trim: true,
    },
    fullImage: {
      type: Boolean,
      default: true,
    },
    active: {
      type: Boolean,
      default: false,
    },
    position: {
      type: Number,
      default: 100,
    },

    category: {
      type: String,
      required: true,
      enum: ['A', 'B', 'C', 'D', 'E'],
    },
  },
  {
    timestamps: true,
  }
);

bannerSchema.index({ category: 1, name: 'text' });

export type BannerType = InferSchemaType<typeof bannerSchema>;
const Banner = mongoose.model('Banner', bannerSchema);

export default Banner;
