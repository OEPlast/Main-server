import { Schema, model, InferSchemaType, Types } from 'mongoose';

export const CONTACT_TOPICS = ['order', 'returns', 'product', 'sizing', 'other'] as const;
export const TICKET_STATUSES = ['open', 'pending', 'closed'] as const;

/** A message sent from the storefront contact form; staff work it from the support inbox. */
const contactTicketSchema = new Schema(
  {
    ticketNumber: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    orderNumber: { type: String, trim: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    topic: { type: String, enum: CONTACT_TOPICS, default: 'other' },
    message: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: TICKET_STATUSES, default: 'open' },
    notes: {
      type: [
        new Schema(
          {
            by: { type: Schema.Types.ObjectId, ref: 'User' },
            text: { type: String, required: true },
            // true when the note was also emailed to the customer
            emailed: { type: Boolean, default: false },
            at: { type: Date, default: Date.now },
          },
          { _id: true }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

contactTicketSchema.index({ status: 1, createdAt: -1 });
contactTicketSchema.index({ email: 1, createdAt: -1 });

export type ContactTicketType = InferSchemaType<typeof contactTicketSchema> & { _id: Types.ObjectId };
const ContactTicket = model('ContactTicket', contactTicketSchema);
export default ContactTicket;
