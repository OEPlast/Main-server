/**
 * Self-service account deletion and data export (Nigeria Data Protection Act: the rights to
 * erasure and to a copy of your data).
 *
 * Deletion is anonymisation, not a hard delete (owner decision, 2026-09-15):
 *  - The customer asks; the account keeps working for DELETION_GRACE_DAYS so they can cancel.
 *  - Then `cron/accountDeletion` calls `anonymiseUser`: every field that identifies the person is
 *    scrubbed, sign-in is disabled, and sessions and linked Google accounts are removed. Orders,
 *    payments and refunds stay (tax and accounting records), but no longer name, locate or contact
 *    anyone. The User document itself is kept so those records still point at something.
 *  - The same email can sign up again later as a new, empty account.
 *
 * Deletion waits while an order, return or refund is still in progress, because finishing it
 * needs the customer's address and email.
 */
import mongoose, { ClientSession } from 'mongoose';
import User from '@/models/User';
import Order from '@/models/Order';
import Return from '@/models/Return';
import Transaction from '@/models/Transaction';
import Shipment from '@/models/Shipment';
import Review from '@/models/Review';
import Cart from '@/models/Cart';
import Wishlist from '@/models/wishlist';
import OTP from '@/models/OTP';
import Account from '@/models/Account';
import Session from '@/models/Session';
import NewsletterSubscriber from '@/models/NewsletterSubscriber';
import CouponRedemption from '@/models/CouponRedemption';
import passwordLib from '@/lib/password';
import { EMAIL_COLLATION } from '@/services/email/newsletter';

export const DELETION_GRACE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const OPEN_RETURN_STATUSES = ['pending', 'approved', 'items_received', 'inspecting', 'inspection_passed'];

export const ANONYMOUS_NAME = { firstName: 'Deleted', lastName: 'customer' };
export const anonymisedEmail = (userId: string) => `deleted-${userId}@deleted.invalid`;

/** What still needs this customer's details. Empty means the account can be deleted. */
export async function findDeletionBlockers(userId: string, session?: ClientSession): Promise<string[]> {
  const user = new mongoose.Types.ObjectId(userId);
  const withSession = <T extends { session: (s: ClientSession) => T }>(query: T) => (session ? query.session(session) : query);

  // Sequential: a transaction session can't run operations in parallel.
  const openOrders = await withSession(
    Order.countDocuments({ user, $or: [{ status: 'Processing' }, { status: 'Pending', isPaid: true }] })
  );
  const openReturns = await withSession(Return.countDocuments({ user, status: { $in: OPEN_RETURN_STATUSES } }));
  const pendingRefunds = await withSession(Transaction.countDocuments({ userId: user, 'refunds.status': 'pending' }));

  const blockers: string[] = [];
  if (openOrders > 0) blockers.push(`${openOrders} order${openOrders > 1 ? 's are' : ' is'} still being processed or delivered`);
  if (openReturns > 0) blockers.push(`${openReturns} return${openReturns > 1 ? 's are' : ' is'} still open`);
  if (pendingRefunds > 0) blockers.push(`a refund to you is still being processed`);
  return blockers;
}

export interface DeletionStatus {
  scheduledFor: Date | null;
  requestedAt: Date | null;
  graceDays: number;
  hasPassword: boolean;
  blockers: string[];
}

export async function getDeletionStatus(userId: string): Promise<DeletionStatus | null> {
  const user = await User.findById(userId).select('deletionRequestedAt deletionScheduledFor password').lean();
  if (!user) return null;
  return {
    scheduledFor: user.deletionScheduledFor ?? null,
    requestedAt: user.deletionRequestedAt ?? null,
    graceDays: DELETION_GRACE_DAYS,
    hasPassword: Boolean(user.password),
    blockers: await findDeletionBlockers(userId),
  };
}

type ServiceResult<T> = { code: number; message: string; data: T | null };

export async function requestAccountDeletion(
  userId: string,
  input: { password?: string; confirmation?: string }
): Promise<ServiceResult<{ scheduledFor: Date }>> {
  const user = await User.findById(userId).select('password role deletionScheduledFor deletedAt');
  if (!user || user.deletedAt) return { code: 404, message: 'Account not found', data: null };
  if (user.role !== 'user') {
    return { code: 403, message: 'Staff accounts are removed by the store owner, not from here.', data: null };
  }
  if (user.deletionScheduledFor) {
    return { code: 200, message: 'Deletion is already scheduled', data: { scheduledFor: user.deletionScheduledFor } };
  }
  if ((input.confirmation ?? '').trim().toUpperCase() !== 'DELETE') {
    return { code: 400, message: 'Type DELETE to confirm', data: null };
  }
  // Someone holding an unlocked device should not be able to delete the account on their own.
  if (user.password) {
    const matches = input.password ? await passwordLib.comparePassword(user.password, input.password) : false;
    if (!matches) return { code: 401, message: 'Your password is incorrect', data: null };
  }

  const blockers = await findDeletionBlockers(userId);
  if (blockers.length > 0) {
    return { code: 409, message: `You can delete your account once nothing is in progress: ${blockers.join('; ')}.`, data: null };
  }

  const now = new Date();
  const scheduledFor = new Date(now.getTime() + DELETION_GRACE_DAYS * DAY_MS);
  await User.updateOne(
    { _id: userId, deletionScheduledFor: null },
    { $set: { deletionRequestedAt: now, deletionScheduledFor: scheduledFor } }
  );
  return { code: 200, message: `Your account will be deleted on ${scheduledFor.toDateString()}`, data: { scheduledFor } };
}

export async function cancelAccountDeletion(userId: string): Promise<ServiceResult<null>> {
  const result = await User.updateOne(
    { _id: userId, deletedAt: null },
    { $set: { deletionRequestedAt: null, deletionScheduledFor: null } }
  );
  if (result.matchedCount === 0) return { code: 404, message: 'Account not found', data: null };
  return { code: 200, message: 'Account deletion cancelled', data: null };
}

const SCRUBBED_ADDRESS = {
  firstName: ANONYMOUS_NAME.firstName,
  lastName: ANONYMOUS_NAME.lastName,
  phoneNumber: '',
  address1: '',
  address2: '',
  zipCode: '',
  latitude: null,
  longitude: null,
};

const prefixed = (prefix: string, values: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [`${prefix}.${key}`, value]));

/**
 * Removes everything that identifies the customer. Runs in one transaction so an account is
 * never left half-scrubbed. City, state and country stay on orders (sales-by-region reporting
 * and tax) since on their own they don't identify anyone.
 *
 * `by: 'staff'` skips the open-order check: staff deleting an account take responsibility for
 * anything in progress.
 */
export async function anonymiseUser(
  userId: string,
  options: { by: 'self' | 'staff' }
): Promise<ServiceResult<{ ordersScrubbed: number }>> {
  const session = await mongoose.startSession();
  try {
    let ordersScrubbed = 0;
    let outcome: ServiceResult<{ ordersScrubbed: number }> | null = null;

    await session.withTransaction(async () => {
      const user = await User.findById(userId).session(session);
      if (!user || user.deletedAt) {
        outcome = { code: 404, message: 'Account not found or already deleted', data: null };
        return;
      }
      if (options.by === 'self') {
        const blockers = await findDeletionBlockers(userId, session);
        if (blockers.length > 0) {
          outcome = { code: 409, message: blockers.join('; '), data: null };
          return;
        }
      }

      const id = user._id;
      const originalEmail = user.email;

      // Each sub-document is only scrubbed where it exists: writing a blank address onto a pickup
      // order, or guest contact onto a signed-in order, would change what those orders are.
      const orderResult = await Order.updateMany(
        { user: id },
        { $set: { 'paymentResult.email': anonymisedEmail(userId), notes: null } },
        { session }
      );
      await Order.updateMany(
        { user: id, shippingAddress: { $exists: true, $ne: null } },
        { $set: prefixed('shippingAddress', SCRUBBED_ADDRESS) },
        { session }
      );
      await Order.updateMany(
        { user: id, billingAddress: { $exists: true, $ne: null } },
        { $set: prefixed('billingAddress', SCRUBBED_ADDRESS) },
        { session }
      );
      await Order.updateMany(
        { user: id, guestContact: { $exists: true, $ne: null } },
        { $set: prefixed('guestContact', { email: anonymisedEmail(userId), ...ANONYMOUS_NAME, phoneNumber: '' }) },
        { session }
      );
      ordersScrubbed = orderResult.matchedCount;

      const orderIds = await Order.find({ user: id }).distinct('_id').session(session);
      await Shipment.updateMany(
        { orderId: { $in: orderIds } },
        // Shipment addresses are required fields, so they get placeholders rather than blanks.
        { $set: prefixed('shippingAddress', { ...ANONYMOUS_NAME, phoneNumber: '-', address1: 'Removed', address2: '', zipCode: '-' }) },
        { session }
      );

      await Transaction.updateMany(
        { userId: id },
        {
          $set: {
            'customerInfo.email': anonymisedEmail(userId),
            'customerInfo.name': `${ANONYMOUS_NAME.firstName} ${ANONYMOUS_NAME.lastName}`,
            'customerInfo.phone': '',
            'billingAddress.street': '',
          },
          // The raw gateway payload repeats the customer's email, name and card details.
          $unset: { 'gatewayResponse.metadata': '' },
        },
        { session }
      );

      await Return.updateMany({ user: id }, { $set: { customerNotes: '' } }, { session });
      // Reviews stay (ratings other shoppers rely on) under the anonymised name; photos go.
      await Review.updateMany({ reviewBy: id }, { $set: { images: [] } }, { session });

      await Cart.deleteMany({ user: id }, { session });
      await Wishlist.deleteMany({ user: id }, { session });
      await OTP.deleteMany({ user: id }, { session });
      await Account.deleteMany({ userId: id }, { session });
      await Session.deleteMany({ userId: id }, { session });
      await NewsletterSubscriber.deleteMany(
        { $or: [{ user: id }, { email: originalEmail }] },
        { session, collation: EMAIL_COLLATION }
      );

      await User.updateOne(
        { _id: id },
        {
          $set: {
            ...ANONYMOUS_NAME,
            name: `${ANONYMOUS_NAME.firstName} ${ANONYMOUS_NAME.lastName}`,
            email: anonymisedEmail(userId),
            address: [],
            suspended: true,
            isGuest: false,
            notifications: false,
            'emailPreferences.marketing': false,
            'emailPreferences.unsubscribedAt': new Date(),
            deletedAt: new Date(),
            deletionScheduledFor: null,
          },
          $unset: { password: '', image: '', miniImage: '', dob: '', country: '', emailVerified: '', defaultPaymentMethod: '' },
          // Kills every session still holding a token.
          $inc: { tokenVersion: 1 },
        },
        { session }
      );

      outcome = { code: 200, message: 'Account anonymised', data: { ordersScrubbed } };
    });

    return outcome ?? { code: 500, message: 'Account deletion did not complete', data: null };
  } finally {
    await session.endSession();
  }
}

/** Everything we hold about the customer, as they would recognise it (no internal ids beyond references). */
export async function buildDataExport(userId: string): Promise<Record<string, unknown> | null> {
  const user = await User.findById(userId)
    .select('firstName lastName email dob country image address emailPreferences emailVerified isGuest createdAt deletionScheduledFor password')
    .lean();
  if (!user) return null;
  const id = user._id;

  const [orders, returns, reviews, wishlist, subscriber, redemptions, accounts] = await Promise.all([
    Order.find({ user: id })
      .sort({ createdAt: -1 })
      .select('orderNumber status isPaid paidAt deliveredAt cancelledAt createdAt deliveryType total shippingPrice couponDiscount couponCode shippingAddress billingAddress guestContact products.qty products.price products.attributes products.product')
      .populate('products.product', 'name slug')
      .lean(),
    Return.find({ user: id })
      .sort({ createdAt: -1 })
      .select('returnNumber status type items.qty items.reason items.reasonDetails items.product customerNotes totalRefundAmount createdAt')
      .populate('items.product', 'name')
      .lean(),
    Review.find({ reviewBy: id }).select('product rating title review images createdAt').populate('product', 'name').lean(),
    Wishlist.find({ user: id }).populate('product', 'name slug').lean(),
    NewsletterSubscriber.findOne({ email: user.email }).collation(EMAIL_COLLATION).select('status source subscribedAt unsubscribedAt').lean(),
    CouponRedemption.find({ user: id }).select('amountDiscounted createdAt coupon').populate('coupon', 'coupon').lean(),
    Account.find({ userId: id }).select('provider createdAt').lean(),
  ]);

  const productName = (product: unknown) => (product as { name?: string } | null)?.name ?? null;

  return {
    exportedAt: new Date().toISOString(),
    about:
      'A copy of the personal data this store holds about you. Payment card details are held by Paystack, not by us.',
    profile: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      dateOfBirth: user.dob ?? null,
      country: user.country ?? null,
      emailVerifiedAt: user.emailVerified ?? null,
      accountCreatedAt: user.createdAt,
      guestCheckoutAccount: Boolean(user.isGuest),
      signInMethods: [...(user.password ? ['password'] : []), ...accounts.map((a) => a.provider)],
      deletionScheduledFor: user.deletionScheduledFor ?? null,
    },
    savedAddresses: (user.address ?? []).map((a) => ({
      firstName: a.firstName,
      lastName: a.lastName,
      phoneNumber: a.phoneNumber,
      address1: a.address1,
      address2: a.address2,
      city: a.city,
      state: a.state,
      lga: a.lga,
      zipCode: a.zipCode,
      country: a.country,
    })),
    emailPreferences: {
      marketingEmails: user.emailPreferences?.marketing !== false,
      subscribedAt: user.emailPreferences?.subscribedAt ?? null,
      unsubscribedAt: user.emailPreferences?.unsubscribedAt ?? null,
      newsletterSignup: subscriber ?? null,
    },
    orders: orders.map((o) => ({
      orderNumber: o.orderNumber,
      placedAt: o.createdAt,
      status: o.status,
      paid: o.isPaid,
      paidAt: o.paidAt ?? null,
      deliveredAt: o.deliveredAt ?? null,
      cancelledAt: o.cancelledAt ?? null,
      deliveryType: o.deliveryType,
      items: (o.products ?? []).map((line) => ({
        product: productName(line.product),
        quantity: line.qty,
        unitPrice: line.price,
        options: (line.attributes ?? []).map((a) => `${a.name}: ${a.value}`),
      })),
      couponCode: o.couponCode ?? null,
      couponDiscount: o.couponDiscount ?? 0,
      deliveryCost: o.shippingPrice ?? 0,
      total: o.total,
      shippingAddress: o.shippingAddress ?? null,
      billingAddress: o.billingAddress ?? null,
      contactDetails: o.guestContact ?? null,
    })),
    returns: returns.map((r) => ({
      returnNumber: r.returnNumber,
      requestedAt: (r as { createdAt?: Date }).createdAt,
      status: r.status,
      type: r.type,
      refundAmount: r.totalRefundAmount ?? null,
      notes: r.customerNotes ?? null,
      items: (r.items ?? []).map((item) => ({
        product: productName(item.product),
        quantity: item.qty,
        reason: item.reason,
        details: item.reasonDetails ?? null,
      })),
    })),
    reviews: reviews.map((r) => ({
      product: productName(r.product),
      rating: r.rating,
      title: r.title ?? null,
      review: r.review,
      photos: r.images ?? [],
      postedAt: r.createdAt,
    })),
    wishlist: wishlist.map((w) => productName((w as { product?: unknown }).product)).filter(Boolean),
    couponsUsed: redemptions.map((r) => ({
      code: (r.coupon as { coupon?: string } | null)?.coupon ?? null,
      amountDiscounted: r.amountDiscounted,
      usedAt: (r as { createdAt?: Date }).createdAt ?? null,
    })),
  };
}
