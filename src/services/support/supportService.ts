import mongoose from 'mongoose';
import ContactTicket, { CONTACT_TOPICS, TICKET_STATUSES } from '@/models/ContactTicket';
import Order from '@/models/Order';
import { nextSequence } from '@/models/Counter';
import EmailProcessor from '@/services/processor/EmailProcessor';
import eventPublisher from '@/events/eventPublisher';
import { EventType } from '@/events/eventTypes';
import { getBrand } from '@/services/brand';
import { logger } from '@/lib/logger';
import { CustomResponseType, CustomResponseTypeWithMeta } from '@/types';

/**
 * Contact-form tickets. The customer gets a confirmation, the store's support address gets the
 * message, and staff answer from the support inbox (a reply note can be emailed to the customer).
 */

export type ContactTopic = (typeof CONTACT_TOPICS)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];

const TOPIC_LABELS: Record<ContactTopic, string> = {
  order: 'order',
  returns: 'returns',
  product: 'product',
  sizing: 'sizing',
  other: 'general',
};

const ticketPrefix = () => (process.env.TICKET_PREFIX || 'TK').trim().toUpperCase();
const adminTicketLink = (id: string) => {
  const base = (process.env.ADMIN_URL || '').replace(/\/+$/, '');
  return base ? `${base}/support/tickets/${id}` : '';
};
const firstName = (name: string) => name.trim().split(/\s+/)[0];

const createTicket = async (input: {
  name: string;
  email: string;
  phone?: string;
  orderNumber?: string;
  topic: ContactTopic;
  message: string;
  userId?: string;
}): Promise<CustomResponseType<{ id: string; createdAt: Date; email: string }>> => {
  try {
    const seq = await nextSequence('ticket');
    const ticketNumber = `${ticketPrefix()}-${String(seq).padStart(6, '0')}`;
    const orderNumber = input.orderNumber?.trim().toUpperCase() || undefined;
    const order = orderNumber ? await Order.findOne({ orderNumber }).select('_id').lean() : null;

    const ticket = await ContactTicket.create({
      ticketNumber,
      name: input.name,
      email: input.email,
      phone: input.phone,
      orderNumber,
      order: order?._id,
      topic: input.topic,
      message: input.message,
      user: input.userId && mongoose.Types.ObjectId.isValid(input.userId) ? input.userId : undefined,
    });

    // Emails and the staff notification never fail the submission.
    void notifyNewTicket(ticket.toObject());

    return {
      message: 'Message received',
      data: { id: ticket.ticketNumber, createdAt: ticket.createdAt, email: ticket.email },
      code: 201,
    };
  } catch (error) {
    console.error('Error creating contact ticket:', error);
    return { message: 'Could not send your message', data: null, code: 500 };
  }
};

async function notifyNewTicket(ticket: {
  _id: unknown;
  ticketNumber: string;
  name: string;
  email: string;
  phone?: string | null;
  orderNumber?: string | null;
  topic: ContactTopic;
  message: string;
}) {
  const topic = TOPIC_LABELS[ticket.topic] ?? 'general';
  try {
    await EmailProcessor.send('contact-received', {
      email: ticket.email,
      firstName: firstName(ticket.name),
      ticketNumber: ticket.ticketNumber,
      topic,
      message: ticket.message,
      orderNumber: ticket.orderNumber ?? undefined,
    });
  } catch (error) {
    logger.error(`[support] confirmation email for ${ticket.ticketNumber} failed`, error);
  }
  try {
    const brand = await getBrand();
    if (brand.supportEmail) {
      await EmailProcessor.send('support-new-ticket', {
        email: brand.supportEmail,
        ticketNumber: ticket.ticketNumber,
        customerName: ticket.name,
        customerEmail: ticket.email,
        customerPhone: ticket.phone ?? undefined,
        topic,
        orderNumber: ticket.orderNumber ?? undefined,
        message: ticket.message,
        adminLink: adminTicketLink(String(ticket._id)),
      });
    }
  } catch (error) {
    logger.error(`[support] staff email for ${ticket.ticketNumber} failed`, error);
  }
  eventPublisher
    .publish(EventType.SUPPORT_TICKET_CREATED, {
      ticketId: String(ticket._id),
      ticketNumber: ticket.ticketNumber,
      name: ticket.name,
      email: ticket.email,
      topic,
      message: ticket.message.slice(0, 500),
    })
    .catch((error) => logger.warn(`[support] could not publish ticket event: ${(error as Error).message}`));
}

const listTickets = async (opts: {
  status?: TicketStatus;
  search?: string;
  page?: number;
  limit?: number;
}): CustomResponseTypeWithMeta<unknown[], { total: number; page: number; limit: number; pages: number; open: number }> => {
  try {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const filter: Record<string, unknown> = {};
    if (opts.status) filter.status = opts.status;
    if (opts.search) {
      const rx = { $regex: opts.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      filter.$or = [{ ticketNumber: rx }, { email: rx }, { name: rx }, { orderNumber: rx }];
    }
    const [items, total, open] = await Promise.all([
      ContactTicket.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-notes')
        .lean(),
      ContactTicket.countDocuments(filter),
      ContactTicket.countDocuments({ status: 'open' }),
    ]);
    return {
      message: 'Tickets retrieved successfully',
      data: items,
      code: 200,
      meta: { total, page, limit, pages: Math.ceil(total / limit), open },
    };
  } catch (error) {
    console.error('Error listing tickets:', error);
    return { message: 'Failed to retrieve tickets', data: null, code: 500 };
  }
};

const getTicket = async (id: string): Promise<CustomResponseType<unknown>> => {
  try {
    const ticket = await ContactTicket.findById(id)
      .populate('order', 'orderNumber status total createdAt')
      .populate('notes.by', 'firstName lastName')
      .lean();
    return ticket
      ? { message: 'Ticket retrieved successfully', data: ticket, code: 200 }
      : { message: 'Ticket not found', data: null, code: 404 };
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return { message: 'Failed to retrieve ticket', data: null, code: 500 };
  }
};

const updateStatus = async (id: string, status: TicketStatus): Promise<CustomResponseType<unknown>> => {
  try {
    const ticket = await ContactTicket.findByIdAndUpdate(id, { status }, { new: true }).select('-notes').lean();
    return ticket
      ? { message: 'Ticket updated successfully', data: ticket, code: 200 }
      : { message: 'Ticket not found', data: null, code: 404 };
  } catch (error) {
    console.error('Error updating ticket:', error);
    return { message: 'Failed to update ticket', data: null, code: 500 };
  }
};

/** Adds a staff note; with `email: true` it is also sent to the customer and the ticket moves to pending. */
const addNote = async (
  id: string,
  input: { text: string; email?: boolean },
  staffId: string
): Promise<CustomResponseType<unknown>> => {
  try {
    const ticket = await ContactTicket.findById(id);
    if (!ticket) return { message: 'Ticket not found', data: null, code: 404 };
    let emailed = false;
    if (input.email) {
      emailed = await EmailProcessor.send('contact-reply', {
        email: ticket.email,
        firstName: firstName(ticket.name),
        ticketNumber: ticket.ticketNumber,
        reply: input.text,
      });
      if (!emailed) return { message: 'The reply could not be emailed. Check the email settings and try again.', data: null, code: 502 };
      if (ticket.status === 'open') ticket.status = 'pending';
    }
    ticket.notes.push({ by: staffId, text: input.text, emailed, at: new Date() });
    await ticket.save();
    return getTicket(id);
  } catch (error) {
    console.error('Error adding ticket note:', error);
    return { message: 'Failed to add note', data: null, code: 500 };
  }
};

const countOpen = () => ContactTicket.countDocuments({ status: 'open' });

const SupportService = { createTicket, listTickets, getTicket, updateStatus, addNote, countOpen };
export default SupportService;
