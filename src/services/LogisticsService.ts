import LogisticsConfigModel, { LogisticsConfigType } from '@/models/LogisticsConfig';
import Product from '@/models/Product';
import { QuoteInput, QuoteResult, LocationTree } from '@/types/logistics';
import { CustomResponsePromise } from '@/types';
import mongoose, { PipelineStage } from 'mongoose';
import { duplicateMessage, isDuplicateKeyError } from '@/middleware/mongodb';

// Guardrail to prevent shipping from exceeding a healthy share of cart value
const MAX_SHIPPING_SUBTOTAL_RATIO = 0.055;
const WHOLESALE_BATCH_SIZE = 24;
const SECONDARY_ITEM_RATE = 0.25;

const getConfigByCountry = async (country: string): CustomResponsePromise<LogisticsConfigType> => {
  try {
    const cfg = await LogisticsConfigModel.findOne({ countryName: country }).collation({ locale: 'en', strength: 2 });
    if (!cfg) {
      return { message: 'Logistics config not found', data: null, code: 404 };
    }
    return { message: 'Logistics config retrieved successfully', data: cfg, code: 200 };
  } catch (error) {
    console.error('getConfigByCountry error:', error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

const createConfig = async (payload: LogisticsConfigType): CustomResponsePromise<LogisticsConfigType> => {
  try {
    const code = payload.countryCode?.toUpperCase();
    const name = payload.countryName;
    const existing = await LogisticsConfigModel.findOne({
      $or: [{ countryCode: code }, { countryName: name }],
    });
    if (existing) {
      return { message: 'Logistics config already exists for this country or code', data: null, code: 409 };
    }
    const created = await LogisticsConfigModel.create({
      countryCode: payload.countryCode.toUpperCase(),
      countryName: payload.countryName,
      states: payload.states ?? [],
    });
    return { message: 'Logistics config created successfully', data: created, code: 201 };
  } catch (error) {
    console.error('createConfig error:', error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

const updateConfig = async (
  id: string,
  payload: Partial<LogisticsConfigType>
): CustomResponsePromise<LogisticsConfigType> => {
  try {
    const update: Partial<LogisticsConfigType> = {};
    if (payload.countryCode) update.countryCode = payload.countryCode.toUpperCase();
    if (payload.countryName) update.countryName = payload.countryName;
    if (payload.states) update.states = payload.states;

    const updated = await LogisticsConfigModel.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!updated) {
      return { message: 'Logistics config not found', data: null, code: 404 };
    }
    return { message: 'Logistics config updated successfully', data: updated, code: 200 };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return { message: duplicateMessage(error, 'Config'), data: null, code: 500 };
    }
    console.error('updateConfig error:', error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

const listCountries = async (): CustomResponsePromise<
  Array<Pick<LogisticsConfigType, 'countryCode' | 'countryName'>>
> => {
  try {
    const docs = await LogisticsConfigModel.find({}, { countryCode: 1, countryName: 1, _id: 1 });
    return {
      message: 'Countries retrieved successfully',
      data: docs as Array<Pick<LogisticsConfigType, 'countryCode' | 'countryName'>>,
      code: 200,
    };
  } catch (error) {
    console.error('listCountries error:', error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

const listAllConfigs = async (): CustomResponsePromise<LogisticsConfigType[]> => {
  try {
    const configs = await LogisticsConfigModel.find().sort({ countryName: 1 });
    return {
      message: 'Logistics configurations retrieved successfully',
      data: configs,
      code: 200,
    };
  } catch (error) {
    console.error('listAllConfigs error:', error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

const quote = async (input: QuoteInput): CustomResponsePromise<QuoteResult> => {
  try {
    const { productId, quantity = 1, destination } = input;

    const product = await Product.findById(productId);
    if (!product) {
      return { message: 'Product not found', data: null, code: 404 };
    }

    const cfgResp = await getConfigByCountry(destination.countryName);
    if (cfgResp.code !== 200 || !cfgResp.data) {
      return { message: 'Logistics config not found for country', data: null, code: 404 };
    }
    const config = cfgResp.data;

    // Locate base price and eta based on specificity: city/lga > state fallback > 0
    const state = config.states.find((s) => s.name.toLowerCase() === (destination.stateName || '').toLowerCase());

    let basePrice = 0;
    let etaDays = 0;
    const breakdown: QuoteResult['breakdown'] = {};

    if (state) {
      // check city
      if (destination.cityName && state.cities && state.cities.length > 0) {
        const city = state.cities.find((c) => c.name.toLowerCase() === destination.cityName!.toLowerCase());
        if (city && typeof city.price === 'number') {
          basePrice = city.price;
          breakdown.city = city.price;
        }
        if (city && typeof city.etaDays === 'number') {
          etaDays = city.etaDays;
        }
      }
      // check lga only if not found via city
      if (basePrice === 0 && destination.lgaName && state.lgas && state.lgas.length > 0) {
        const lga = state.lgas.find((l) => l.name.toLowerCase() === destination.lgaName!.toLowerCase());
        if (lga && typeof lga.price === 'number') {
          basePrice = lga.price;
          breakdown.lga = lga.price;
        }
        if (lga && typeof lga.etaDays === 'number') {
          etaDays = lga.etaDays;
        }
      }

      // fallback to state if still 0
      if (basePrice === 0 && typeof state.fallbackPrice === 'number') {
        basePrice = state.fallbackPrice;
        breakdown.state = state.fallbackPrice;
      }
      if (etaDays === 0 && typeof state.fallbackEtaDays === 'number') {
        etaDays = state.fallbackEtaDays;
      }
    }

    // Product shipping influence
    const addedCost = product.shipping?.addedCost ?? 0;
    const increaseCostBy = product.shipping?.increaseCostBy ?? 0;
    const addedDays = product.shipping?.addedDays ?? 0;

    breakdown.productAddedCost = addedCost;
    breakdown.productIncreaseCostBy = increaseCostBy;

    const increased = basePrice * (increaseCostBy / 100);
    const finalPrice = (basePrice + increased + addedCost) * Math.max(1, quantity);
    const finalEta = etaDays + addedDays;

    const result: QuoteResult = {
      currency: 'NGN', // could be derived per country in future
      basePrice,
      productShippingAdjustments: { addedCost, increaseCostBy, addedDays },
      finalPrice,
      etaDays: finalEta,
      breakdown,
    };

    return { message: 'Quote generated successfully', data: result, code: 200 };
  } catch (error) {
    console.error('quote error:', error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

const listLocationsTree = async (): CustomResponsePromise<LocationTree> => {
  try {
    const pipeline: PipelineStage[] = [
      {
        $project: {
          _id: 0,
          countryCode: 1,
          countryName: 1,
          states: {
            $map: {
              input: { $ifNull: ['$states', []] },
              as: 's',
              in: {
                name: '$$s.name',
                cities: {
                  $map: {
                    input: { $ifNull: ['$$s.cities', []] },
                    as: 'c',
                    in: { name: '$$c.name' },
                  },
                },
                lgas: {
                  $map: {
                    input: { $ifNull: ['$$s.lgas', []] },
                    as: 'l',
                    in: { name: '$$l.name' },
                  },
                },
              },
            },
          },
        },
      },
    ];

    const data = (await LogisticsConfigModel.aggregate(pipeline)) as LocationTree;
    return { message: 'Locations retrieved successfully', data, code: 200 };
  } catch (error) {
    console.error('listLocationsTree error:', error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

/**
 * Get location hierarchy for a specific country (for address forms)
 * Returns: Country → States → LGAs & Cities (no pricing info)
 */
const getLocationsByCountry = async (
  countryName: string
): CustomResponsePromise<{
  countryCode: string;
  countryName: string;
  states: Array<{
    name: string;
    cities: Array<{ name: string }>;
    lgas: Array<{ name: string }>;
  }>;
}> => {
  try {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          countryName: { $regex: new RegExp(`^${countryName}$`, 'i') }, // Case-insensitive match
        },
      },
      {
        $project: {
          _id: 0,
          countryCode: 1,
          countryName: 1,
          states: {
            $map: {
              input: { $ifNull: ['$states', []] },
              as: 's',
              in: {
                name: '$$s.name',
                cities: {
                  $map: {
                    input: { $ifNull: ['$$s.cities', []] },
                    as: 'c',
                    in: { name: '$$c.name' },
                  },
                },
                lgas: {
                  $map: {
                    input: { $ifNull: ['$$s.lgas', []] },
                    as: 'l',
                    in: { name: '$$l.name' },
                  },
                },
              },
            },
          },
        },
      },
    ];

    const result = await LogisticsConfigModel.aggregate(pipeline);

    if (!result || result.length === 0) {
      return { message: 'Country not found in logistics config', data: null, code: 404 };
    }

    return { message: 'Location hierarchy retrieved successfully', data: result[0], code: 200 };
  } catch (error) {
    console.error('getLocationsByCountry error:', error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

const createEmptyCountry = async (
  countryCode: string,
  countryName: string
): CustomResponsePromise<LogisticsConfigType> => {
  try {
    const code = countryCode.toUpperCase();
    const exists = await LogisticsConfigModel.findOne({ countryCode: code });
    if (exists) {
      return { message: 'Country already exists', data: null, code: 409 };
    }
    const created = await LogisticsConfigModel.create({ countryCode: code, countryName, states: [] });
    return {
      message: 'Country created successfully',
      data: created,
      code: 201,
    };
  } catch (error) {
    console.error('createEmptyCountry error:', error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

const deleteCountry = async (id: string): CustomResponsePromise<null> => {
  try {
    const res = await LogisticsConfigModel.deleteOne({ _id: id });
    if (res.deletedCount && res.deletedCount > 0) {
      return { message: 'Country deleted successfully', data: null, code: 200 };
    }
    return { message: 'Country not found', data: null, code: 404 };
  } catch (error) {
    console.error('deleteCountry error:', error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

const updateCountryName = async (
  countryCode: string,
  countryName: string
): CustomResponsePromise<Pick<LogisticsConfigType, 'countryCode' | 'countryName'>> => {
  try {
    const code = countryCode.toUpperCase();
    const updated = await LogisticsConfigModel.findOneAndUpdate(
      { countryCode: code },
      { $set: { countryName } },
      { new: true }
    );
    if (!updated) {
      return { message: 'Country not found', data: null, code: 404 };
    }
    return {
      message: 'Country name updated successfully',
      data: { countryCode: updated.countryCode, countryName: updated.countryName },
      code: 200,
    };
  } catch (error) {
    console.error('updateCountryName error:', error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

type Destination = {
  countryName: string;
  stateName: string;
  lgaName?: string;
  cityName?: string;
};

type OrderItem = {
  productId: string;
  quantity: number;
};

/**
 * Calculate shipping cost with fair pricing model
 *
 * Logic:
 * 1. Base Price Lookup (Priority Order):
 *    - City price (if city provided and found)
 *    - LGA price (if LGA provided and city not found)
 *    - State fallback price (if neither city nor LGA found)
 *    - Default fallback (1200 NGN if no config exists)
 *
 * 2. Product-Specific Costs:
 *    - shipping.addedCost: Fixed cost added to base (per item type, not multiplied by quantity)
 *    - shipping.increaseCostBy: Percentage increase on base price (per item type)
 *
 * 3. Quantity Scaling (Fair Model):
 *    - First 5 units: Full shipping cost per unit
 *    - 6-20 units: 70% of shipping cost per unit
 *    - 21-50 units: 50% of shipping cost per unit
 *    - 51+ units: 30% of shipping cost per unit
 *
 * 4. Delivery Time (ETA):
 *    - Use the HIGHEST addedDays from all products (not sum)
 *    - Base ETA from location config (city > lga > state fallback)
 *
 * @param items - Array of cart items with productId and quantity
 * @param destination - Shipping destination with country, state, optional city/lga
 * @returns Total shipping cost in NGN
 */
export async function calculateProgressiveShipping(items: OrderItem[], destination: Destination): Promise<number> {
  if (!items.length) return 0;

  // Step 1: Get base shipping price from logistics config
  const logisticsConfig = await LogisticsConfigModel.findOne({
    countryName: destination.countryName,
  });

  let basePrice = 1200; // Default fallback for Nigeria
  let baseEtaDays = 3; // Default 3 days

  if (logisticsConfig) {
    const stateConfig = logisticsConfig.states.find(
      (s) => s.name?.toLowerCase() === destination.stateName?.toLowerCase()
    );

    if (stateConfig) {
      // Priority 1: Check for city price
      if (destination.cityName && stateConfig.cities?.length) {
        const cityConfig = stateConfig.cities.find(
          (c) => c.name?.toLowerCase() === destination.cityName!.toLowerCase()
        );
        if (cityConfig && cityConfig.price != null) {
          basePrice = cityConfig.price;
          if (cityConfig.etaDays != null) {
            baseEtaDays = cityConfig.etaDays;
          }
        }
      }

      // Priority 2: Check for LGA price (only if city not found)
      if (basePrice === 1200 && destination.lgaName && stateConfig.lgas?.length) {
        const lgaConfig = stateConfig.lgas.find((l) => l.name?.toLowerCase() === destination.lgaName!.toLowerCase());
        if (lgaConfig && lgaConfig.price != null) {
          basePrice = lgaConfig.price;
          if (lgaConfig.etaDays != null) {
            baseEtaDays = lgaConfig.etaDays;
          }
        }
      }

      // Priority 3: Use state fallback (if neither city nor LGA found)
      if (basePrice === 1200) {
        basePrice = stateConfig.fallbackPrice ?? 1200;
        baseEtaDays = stateConfig.fallbackEtaDays ?? 3;
      }
    }
  }

  // Step 2: Fetch products and calculate per-product shipping
  const productIds = items.map((i) => new mongoose.Types.ObjectId(i.productId));
  const products = await Product.find({ _id: { $in: productIds } }).select('shipping price');

  let rawTotalShipping = 0;
  let maxAddedDays = 0;
  let orderSubtotal = 0;
  let highestShipping = 0;

  for (const item of items) {
    const product = products.find((p) => p._id.toString() === item.productId.toString());
    if (!product) continue;

    const qty = item.quantity;

    // Product-specific shipping adjustments (applied once per product type, not per quantity)
    const addedCost = product.shipping?.addedCost ?? 0;
    const increaseCostBy = product.shipping?.increaseCostBy ?? 0;
    const addedDays = product.shipping?.addedDays ?? 0;

    // Track highest delivery days (not sum)
    if (addedDays > maxAddedDays) {
      maxAddedDays = addedDays;
    }

    // Calculate adjusted base price for this product type
    const productBasePrice = basePrice + (basePrice * increaseCostBy) / 100 + addedCost;

    if (typeof product.price === 'number') {
      orderSubtotal += product.price * qty;
    }

    // Apply wholesale batching (per two dozen) with discounted extra batches
    const batches = Math.max(1, Math.ceil(qty / WHOLESALE_BATCH_SIZE));
    const extraBatches = Math.max(0, batches - 1);
    const productShipping = productBasePrice + extraBatches * productBasePrice * SECONDARY_ITEM_RATE;

    rawTotalShipping += productShipping;
    if (productShipping > highestShipping) {
      highestShipping = productShipping;
    }
  }

  if (rawTotalShipping === 0) {
    return 0;
  }

  // Step 3: Blend the cart – most expensive lane fully charged, others discounted
  const ratioCap = orderSubtotal > 0 ? orderSubtotal * MAX_SHIPPING_SUBTOTAL_RATIO : null;
  const highestCapped = ratioCap != null ? Math.min(highestShipping, ratioCap) : highestShipping;
  const othersShipping = Math.max(0, rawTotalShipping - highestShipping);
  const weightedShipping = highestCapped + othersShipping * SECONDARY_ITEM_RATE;

  // Step 4: Apply cart-level cap to avoid runaway totals
  const adjustedShipping = ratioCap != null ? Math.min(weightedShipping, ratioCap) : weightedShipping;

  const finalShipping = Math.round(Math.max(0, adjustedShipping) * 100) / 100;
  const finalEta = baseEtaDays + maxAddedDays;

  console.log('Shipping calculation:', {
    destination: {
      country: destination.countryName,
      state: destination.stateName,
      city: destination.cityName,
      lga: destination.lgaName,
    },
    basePrice,
    baseEtaDays,
    maxAddedDays,
    finalEta,
    itemsCount: items.length,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    orderSubtotal: Math.round(orderSubtotal * 100) / 100,
    rawTotalShipping: Math.round(rawTotalShipping * 100) / 100,
    highestShipping: Math.round(highestShipping * 100) / 100,
    highestCapped: Math.round(highestCapped * 100) / 100,
    weightedShipping: Math.round(weightedShipping * 100) / 100,
    ratioCap: ratioCap != null ? Math.round(ratioCap * 100) / 100 : null,
    finalShipping,
  });

  return finalShipping;
}

export default {
  getConfigByCountry,
  createConfig,
  updateConfig,
  listCountries,
  listAllConfigs,
  quote,
  listLocationsTree,
  getLocationsByCountry,
  createEmptyCountry,
  deleteCountry,
  updateCountryName,
  calculateProgressiveShipping,
};
