import { CustomResponseType } from '@/types';
import Order, { type OrderType } from '@/models/Order';
import { Types } from 'mongoose';
import Settings from '@/models/Settings';

export type InvoiceItem = {
  productId: string;
  name?: string;
  quantity: number;
  unitPrice: number;
  attributes?: Array<{ name: string; value: string }>;
  lineTotal: number;
};

export type InvoiceData = {
  invoiceId: string; // same as orderId for simplicity
  orderId: string;
  user: { id: string; firstname?: string; lastname?: string; email?: string };
  shippingAddress: OrderType['shippingAddress'];
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  paymentMethod?: string;
  couponApplied?: string;
  paid: boolean;
  paidAt?: string | null;
  createdAt: string;
  store?: {
    storeName?: string;
    companyName?: string;
    logoUrl?: string;
    websiteUrl?: string;
    supportEmail?: string;
    supportPhone?: string;
    address?: { line1?: string; line2?: string; city?: string; state?: string; zip?: string; country?: string };
    taxId?: string;
    currency?: string;
  };
};

// Helpers to handle possibly populated refs without using any
const toIdString = (value: unknown): string => {
  if (value && typeof value === 'object' && '_id' in value) {
    const v = (value as { _id: unknown })._id;
    return typeof v === 'string' ? v : (v as Types.ObjectId).toString();
  }
  if (typeof value === 'string') return value;
  if (value instanceof Types.ObjectId) return value.toString();
  return '';
};

const getNameIfPresent = (value: unknown): string | undefined => {
  if (value && typeof value === 'object' && 'name' in value) {
    const n = (value as { name?: unknown }).name;
    return typeof n === 'string' ? n : undefined;
  }
  return undefined;
};

const getUserInfo = (user: unknown) => {
  const id = toIdString(user);
  let firstname: string | undefined;
  let lastname: string | undefined;
  let email: string | undefined;
  if (user && typeof user === 'object') {
    const u = user as Record<string, unknown>;
    firstname = typeof u.firstname === 'string' ? u.firstname : undefined;
    lastname = typeof u.lastname === 'string' ? u.lastname : undefined;
    email = typeof u.email === 'string' ? u.email : undefined;
  }
  return { id, firstname, lastname, email };
};

const getInvoiceData = async (orderId: string): Promise<CustomResponseType<InvoiceData>> => {
  try {
    const order = await Order.findById(orderId)
      .populate('user', 'firstname lastname email')
      .populate('products.product', 'name');

    if (!order) {
      return { message: 'Order not found', data: null, code: 404 };
    }

    const items: InvoiceItem[] = (order.products || []).map((p: NonNullable<OrderType['products']>[number]) => {
      const po = p as unknown as {
        qty?: number;
        price?: number;
        product?: unknown;
        attributes?: Array<{ name: string; value: string }>;
      };
      const qty = Number(po.qty ?? 0);
      const price = Number(po.price ?? 0);
      const productRef = po.product;
      const productId = toIdString(productRef);
      const name = getNameIfPresent(productRef);
      const attributes = po.attributes;
      return {
        productId,
        name,
        quantity: qty,
        unitPrice: price,
        attributes,
        lineTotal: qty * price,
      };
    });

    const subtotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
    const shipping = Number(order.shippingPrice || 0);
    const tax = Number(order.taxPrice || 0);
    const total = Number(order.total || 0);

    const totalBeforeDiscount = order.totalBeforeDiscount != null ? Number(order.totalBeforeDiscount) : subtotal;
    const discount = Math.max(0, Number(totalBeforeDiscount) + shipping + tax - total);

    // Pull latest settings for store metadata
    const settings = await Settings.findOne().sort({ createdAt: -1 });

    const data: InvoiceData = {
      invoiceId: order._id.toString(),
      orderId: order._id.toString(),
      user: getUserInfo(order.user),
      shippingAddress: order.shippingAddress,
      items,
      subtotal,
      discount,
      shipping,
      tax,
      total,
      paymentMethod: order.paymentMethod ?? undefined,
      couponApplied: order.couponApplied ?? undefined,
      paid: Boolean(order.isPaid),
      paidAt: order.paidAt ? new Date(order.paidAt).toISOString() : null,
      createdAt: new Date(order.createdAt!).toISOString(),
      store: settings
        ? {
            storeName: settings.storeName ?? undefined,
            companyName: settings.companyName ?? undefined,
            logoUrl: settings.logoUrl ?? undefined,
            websiteUrl: settings.websiteUrl ?? undefined,
            supportEmail: settings.supportEmail ?? undefined,
            supportPhone: settings.supportPhone ?? undefined,
            address: settings.address
              ? {
                  line1: settings.address.line1 ?? undefined,
                  line2: settings.address.line2 ?? undefined,
                  city: settings.address.city ?? undefined,
                  state: settings.address.state ?? undefined,
                  zip: settings.address.zip ?? undefined,
                  country: settings.address.country ?? undefined,
                }
              : undefined,
            taxId: settings.taxId ?? undefined,
            currency: settings.currency ?? undefined,
          }
        : undefined,
    };

    return { message: 'Invoice data generated', data, code: 200 };
  } catch (error) {
    console.error('Error generating invoice data:', error);
    return { message: 'Failed to generate invoice data', data: null, code: 500 };
  }
};

const InvoiceService = { getInvoiceData };
export default InvoiceService;
