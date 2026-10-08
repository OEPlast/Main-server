import LogisticsService from '@/services/LogisticsService';
import GIGService from '@/services/GIGService';
import { applyFreeDelivery, priceCart } from '@/services/pricing';
import PickupLocation from '@/models/PickupLocation';
import { CustomResponseType } from '@/types';

/**
 * The delivery methods a cart can use for an address, each with the price checkout will charge.
 *
 * "shipping" uses the same steps as `CheckoutService.secureCheckout` (progressive logistics rate,
 * then the configured discount, then free delivery over the threshold on the server-priced
 * subtotal), so the quote shown here is the one /checkout/secure accepts. GIG needs the street
 * address and coordinates, so it is listed with `requiresQuote` and priced by /gig/calculate-shipping.
 */

export type ShippingOption = {
  id: 'shipping' | 'gig' | 'pickup';
  name: string;
  eta: string;
  /** null when it has to be quoted separately (GIG) or the address is incomplete. */
  price: number | null;
  requiresQuote?: boolean;
};

const getShippingOptions = async (input: {
  items: Array<{ productId: string; qty: number; selectedAttributes?: Array<{ name: string; value: string }> }>;
  address?: { country?: string; state?: string; city?: string; lga?: string };
}): Promise<
  CustomResponseType<{ options: ShippingOption[]; itemsSubtotal: number; freeShippingThreshold: number | null }>
> => {
  try {
    const [{ data: config }, priced] = await Promise.all([
      GIGService.getPublicCheckoutConfig(),
      priceCart(input.items.map((i) => ({ product: i.productId, qty: i.qty, selectedAttributes: i.selectedAttributes }))),
    ]);
    if (priced.missingProductIds.length) {
      return { message: 'Some products in the cart no longer exist', data: null, code: 400 };
    }
    const { enabledDeliveryMethods, shippingDiscountAmountOff, freeShippingThreshold, shippingWindow } = config;
    const options: ShippingOption[] = [];

    if (enabledDeliveryMethods.includes('shipping')) {
      let price: number | null = null;
      if (input.address?.state) {
        const raw = await LogisticsService.calculateProgressiveShipping(
          input.items.map((i) => ({ productId: i.productId, quantity: i.qty })),
          {
            countryName: input.address.country || 'Nigeria',
            stateName: input.address.state,
            cityName: input.address.city || undefined,
            lgaName: input.address.lga || undefined,
          }
        );
        const discounted = Math.round(GIGService.applyDeliveryDiscount(raw, shippingDiscountAmountOff).finalAmount * 100) / 100;
        price = applyFreeDelivery(discounted, priced.itemsSubtotal, freeShippingThreshold).amount;
      }
      options.push({ id: 'shipping', name: 'Standard delivery', eta: shippingWindow.label, price });
    }

    if (enabledDeliveryMethods.includes('gig')) {
      options.push({ id: 'gig', name: 'GIG Logistics', eta: shippingWindow.label, price: null, requiresQuote: true });
    }

    if (enabledDeliveryMethods.includes('pickup')) {
      const first = await PickupLocation.findOne({ active: true }).sort({ order: 1 }).select('readyIn').lean();
      options.push({ id: 'pickup', name: 'Pick up', eta: first?.readyIn || 'Collect from our store', price: 0 });
    }

    return {
      message: 'Shipping options retrieved successfully',
      data: { options, itemsSubtotal: priced.itemsSubtotal, freeShippingThreshold },
      code: 200,
    };
  } catch (error) {
    console.error('Error building shipping options:', error);
    return { message: 'Failed to calculate shipping options', data: null, code: 500 };
  }
};

export default getShippingOptions;
