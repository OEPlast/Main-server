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
    active: {
      type: Boolean,
      default: false,
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

// Index for efficient searching by name
bannerSchema.index({ name: 'text' });

export type BannerType = InferSchemaType<typeof bannerSchema>;
const Banner = mongoose.model('Banner', bannerSchema);

export default Banner;
