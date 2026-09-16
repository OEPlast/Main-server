import mongoose, { InferSchemaType, Schema } from 'mongoose';

/**
 * Someone who asked for marketing email through a newsletter form.
 *
 * Kept apart from User on purpose: creating a User (even a guest one) per footer signup would
 * pollute the customers list and per-customer analytics. A signed-in customer who subscribes is
 * recorded on their own User.emailPreferences instead; `user` is set when the address matches an
 * account so the two can be reconciled.
 */
const newsletterSubscriberSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    status: { type: String, enum: ['subscribed', 'unsubscribed'], default: 'subscribed', index: true },
    /** Which form it came from, e.g. `footer`, `about`. */
    source: { type: String, default: 'footer' },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    subscribedAt: { type: Date, default: Date.now },
    unsubscribedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type NewsletterSubscriberType = InferSchemaType<typeof newsletterSubscriberSchema>;
const NewsletterSubscriber = mongoose.model('NewsletterSubscriber', newsletterSubscriberSchema);
export default NewsletterSubscriber;
