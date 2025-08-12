import { model, Schema, InferSchemaType } from 'mongoose';

const fileUploadSchema = new Schema(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String, required: true },
    s3Key: { type: String }, // S3 object key for easy deletion
    category: {
      type: String,
      enum: ['product', 'gallery', 'campaign', 'user', 'banner'],
      required: true,
    },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    metadata: {
      width: { type: Number },
      height: { type: Number },
      format: { type: String },
      s3Bucket: { type: String },
      s3Region: { type: String },
    },
  },
  { timestamps: true }
);

export type IFileUpload = InferSchemaType<typeof fileUploadSchema>;
const FileUpload = model('FileUpload', fileUploadSchema);
export default FileUpload;
