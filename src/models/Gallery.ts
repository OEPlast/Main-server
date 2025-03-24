import mongoose, { Schema, InferSchemaType } from 'mongoose';

const GallerySchema = new Schema(
  {
    title: { type: String, required: true, unique: true },
    description: { type: String },
    imageUrl: { type: String, required: true },
  },
  { timestamps: true }
);

export type GalleryType = InferSchemaType<typeof GallerySchema>;
const Gallery = mongoose.model('Gallery', GallerySchema);
export default Gallery;
