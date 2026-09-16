import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Order from '@/models/Order';
import Shipment from '@/models/Shipment';
import RateLimits from '@/middleware/rate';
import { toPublicShipment } from '@/utils/publicShipment';
import { logger } from '@/lib/logger';

const router = Router();

type LookupProduct = {
  product?: { _id?: unknown; name?: string; slug?: string; description_images?: Array<{ url?: string; cover_image?: boolean }> } | null;
  qty?: number | null;
  price?: number | null;
  attributes?: Array<{ name?: string; value?: string }>;
};

/**
 * POST /orders/lookup { orderNumber, email }
 *
 * Lets a customer (guests especially, who have no account to sign in to) check an order with the
 * two things they have: the order number from their confirmation email and the email they ordered
 * with. The public tracking page only accepted a courier tracking number, so an order with no
 * shipment yet, or a pickup order, could not be looked up at all.
 *
 * A wrong email and an unknown order number get the same 404, so the endpoint reveals nothing
 * about which orders exist. The response carries what a customer needs to see and none of the
 * delivery details (no phone, street or postcode), because anyone holding both values can call it.
 */
router.post(
  '/lookup',
  RateLimits.OrderLookup_Limiter,
  body('orderNumber').isString().trim().toUpperCase().isLength({ min: 4, max: 40 }).withMessage('Enter your order number'),
  body('email').isEmail().withMessage('Enter the email you ordered with'),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg, data: null, code: 400 });
    }

    const orderNumber = String(req.body.orderNumber).trim().toUpperCase();
    const email = String(req.body.email).trim().toLowerCase();
    const notFound = () =>
      res.status(404).json({ message: 'We could not find an order with that number and email.', data: null, code: 404 });

    try {
      const order = await Order.findOne({ orderNumber })
        .populate('user', 'email')
        .populate('products.product', 'name slug description_images')
        .lean();
      if (!order) return notFound();

      const accountEmail = (order.user as unknown as { email?: string } | null)?.email?.toLowerCase();
      const guestEmail = order.guestContact?.email?.toLowerCase();
      if (email !== accountEmail && email !== guestEmail) return notFound();

      const shipment = await Shipment.findOne({ orderId: order._id }).lean();
      const address = order.shippingAddress;

      return res.status(200).json({
        message: 'Order found',
        code: 200,
        data: {
          orderNumber: order.orderNumber,
          status: order.status,
          isPaid: order.isPaid,
          deliveryType: order.deliveryType,
          createdAt: (order as { createdAt?: Date }).createdAt,
          paidAt: order.paidAt,
          deliveredAt: order.deliveredAt,
          cancelledAt: order.cancelledAt,
          total: order.total,
          shippingPrice: order.shippingPrice,
          couponDiscount: order.couponDiscount,
          gigWaybill: order.gigWaybill ?? undefined,
          items: (order.products as unknown as LookupProduct[]).map((line) => ({
            name: line.product?.name ?? 'Product',
            slug: line.product?.slug,
            image:
              line.product?.description_images?.find((i) => i.cover_image)?.url ?? line.product?.description_images?.[0]?.url,
            qty: line.qty ?? 0,
            price: line.price ?? 0,
            attributes: (line.attributes ?? []).map((a) => ({ name: a.name, value: a.value })),
          })),
          deliveryArea: address
            ? { firstName: address.firstName, city: address.city, state: address.state, country: address.country }
            : undefined,
          shipment: shipment ? toPublicShipment(shipment as never) : null,
        },
      });
    } catch (error) {
      logger.error('Order lookup failed:', error);
      return res.status(500).json({ message: 'Could not look up the order right now.', data: null, code: 500 });
    }
  }
);

export default router;
