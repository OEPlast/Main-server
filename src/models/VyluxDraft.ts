import { Schema, model, InferSchemaType } from 'mongoose';

/**
 * Pictures copied by the admin's "Add product" (POST /admin/vylux/products/:id/prepare) before a
 * product exists. If the form is abandoned, or a picture is removed from it, those files are left
 * in storage; the hourly cleanup (cron/vyluxDrafts.ts) deletes the ones no product uses.
 */
const vyluxDraftSchema = new Schema(
  {
    vyluxId: { type: Number, required: true },
    /** One entry per copied picture/video: its paths as the form got them, and every file stored for it. */
    media: {
      type: [
        new Schema(
          {
            url: { type: String, required: true },
            miniUrl: { type: String },
            files: { type: [String], default: [] },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

vyluxDraftSchema.index({ createdAt: 1 });

export type VyluxDraftType = InferSchemaType<typeof vyluxDraftSchema>;
const VyluxDraft = model('VyluxDraft', vyluxDraftSchema);
export default VyluxDraft;
