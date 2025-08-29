import LogisticsConfigModel, { LogisticsConfigType } from '@/models/LogisticsConfig';
import Product from '@/models/Product';
import { QuoteInput, QuoteResult, LocationTree } from '@/types/logistics';
import { CustomResponsePromise } from '@/types';
import mongoose, { PipelineStage } from 'mongoose';
import { duplicateMessage, isDuplicateKeyError } from '@/middleware/mongodb';

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
    const state = config.states.find((s) => s.code.toUpperCase() === (destination.stateCode || '').toUpperCase());

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
                code: '$$s.code',
                cities: {
                  $map: {
                    input: { $ifNull: ['$$s.cities', []] },
                    as: 'c',
                    in: { name: '$$c.name', code: '$$c.code' },
                  },
                },
                lgas: {
                  $map: {
                    input: { $ifNull: ['$$s.lgas', []] },
                    as: 'l',
                    in: { name: '$$l.name', code: '$$l.code' },
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
  stateCode: string;
  lgaName: string;
};

type OrderItem = {
  productId: string;
  quantity: number;
};

// Shipping pricing tuning knobs (change these to adjust growth behavior)
// Progressive shipping constants
const PROG_FIRST_INTERVAL = 3; // first N units at full base shipping (reduced for higher costs)
const PROG_INTERVAL_SIZE = 15; // progressive blocks after first interval (smaller intervals for higher costs)
const PROG_FLOOR_RATIO = 0.15; // min fraction of baseShipping per unit at very large quantities (increased from 0.04)
const PROG_DECAY_RATE = 0.8; // speed of decay per interval towards the floor ratio (slower decay for higher costs)
// Cart-level saturation and cap (to avoid runaway totals)
const PROG_SATURATION_FLOOR = 0.55; // minimum multiplier applied to rawShipping after grouping (increased from 0.18)
const PROG_SATURATION_LN_COEFF = 0.25; // how fast saturation decreases with ln(qty) (slower decrease for higher costs)
const PROG_CAP_BASE = 15; // base term for the cap function (increased)
const PROG_CAP_LN_COEFF = 8; // coefficient of ln(qty) in the cap (increased)
const PROG_CAP_MULTIPLIER = 25; // overall multiplier for the cap (increased)

export async function calculateProgressiveShipping(items: OrderItem[], destination: Destination): Promise<number> {
  if (!items.length) return 0;

  const productIds = items.map((i) => new mongoose.Types.ObjectId(i.productId));

  // Fetch logistics config
  const logisticsConfig: LogisticsConfigType | null = await LogisticsConfigModel.findOne({
    countryName: destination.countryName,
  });

  // If no logistics config found, use reasonable defaults for Nigeria
  let fallbackPrice = 1200; // Default minimum shipping cost (increased from 500)

  if (logisticsConfig) {
    const stateConfig = logisticsConfig.states.find(
      (s) => s.code?.toUpperCase() === destination.stateCode.toUpperCase()
    );
    const lgaConfig = stateConfig?.lgas.find((l) => l.name?.toLowerCase() === destination.lgaName.toLowerCase());

    // Use configured price, or fall back to minimum
    fallbackPrice = lgaConfig?.price ?? stateConfig?.fallbackPrice ?? 1200;
  }

  // Use tuning constants
  const FIRST_INTERVAL = PROG_FIRST_INTERVAL;
  const INTERVAL_SIZE = PROG_INTERVAL_SIZE;
  // New model: per-unit cost factor in interval i is
  // unitFactor(i) = FLOOR_RATIO + (1 - FLOOR_RATIO) / (1 + DECAY_RATE * i)
  // where i starts at 1. This creates a logarithmic decay towards FLOOR_RATIO.
  const FLOOR_RATIO = PROG_FLOOR_RATIO; // minimum fraction at very large quantities
  const DECAY_RATE = PROG_DECAY_RATE; // decay speed

  // Prepare cart quantity mapping
  const qtyMap: Record<string, number> = {};
  for (const i of items) {
    // Use stringified ObjectId as keys to match aggregation $toString("$_id") lookups
    qtyMap[String(i.productId)] = i.quantity;
  }

  const aggregationResult = await Product.aggregate([
    { $match: { _id: { $in: productIds } } },

    // Attach quantity from cart
    {
      $addFields: {
        // Pull quantity from the input items map by matching on product _id string
        qty: {
          $ifNull: [
            {
              $getField: {
                input: { $literal: qtyMap },
                field: { $toString: '$_id' },
              },
            },
            0,
          ],
        },
        // If product has a positive explicit addedCost, use it; otherwise fall back to location price
        baseShipping: {
          $let: {
            vars: { ship: { $ifNull: ['$shipping.addedCost', null] } },
            in: { $cond: [{ $gt: ['$$ship', 0] }, '$$ship', fallbackPrice] },
          },
        },
      },
    },

    // Compute total line shipping with progressive intervals (log-decay model)
    {
      $addFields: {
        totalLineShipping: {
          $let: {
            vars: {
              remainingQty: { $max: [{ $subtract: ['$qty', FIRST_INTERVAL] }, 0] },
            },
            in: {
              $add: [
                // First block at full price (up to FIRST_INTERVAL)
                { $multiply: [{ $min: ['$qty', FIRST_INTERVAL] }, '$baseShipping'] },

                // Remaining intervals with logarithmic decay and floor ratio
                {
                  $sum: {
                    $map: {
                      input: {
                        $range: [
                          1,
                          {
                            $add: [
                              1,
                              {
                                $ceil: {
                                  $divide: ['$$remainingQty', INTERVAL_SIZE],
                                },
                              },
                            ],
                          },
                        ],
                      },
                      as: 'i',
                      in: {
                        $let: {
                          vars: {
                            unitsInInterval: {
                              $min: [
                                INTERVAL_SIZE,
                                {
                                  $max: [
                                    {
                                      $subtract: [
                                        '$$remainingQty',
                                        { $multiply: [{ $subtract: ['$$i', 1] }, INTERVAL_SIZE] },
                                      ],
                                    },
                                    0,
                                  ],
                                },
                              ],
                            },
                            unitFactor: {
                              $add: [
                                FLOOR_RATIO,
                                {
                                  $divide: [
                                    { $subtract: [1, FLOOR_RATIO] },
                                    { $add: [1, { $multiply: [DECAY_RATE, '$$i'] }] },
                                  ],
                                },
                              ],
                            },
                          },
                          in: { $multiply: ['$$unitsInInterval', '$baseShipping', '$$unitFactor'] },
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },

    // Sum across all products and gather total quantity
    {
      $group: {
        _id: null,
        rawShipping: { $sum: '$totalLineShipping' },
        qtyTotal: { $sum: '$qty' },
      },
    },
    // Cart-level saturation and dynamic cap to avoid runaway totals
    {
      $addFields: {
        // Saturation multiplier decreases slowly with cart size but floors at a reasonable value
        saturationMultiplier: {
          $max: [
            PROG_SATURATION_FLOOR,
            {
              $divide: [
                1,
                {
                  $add: [1, { $multiply: [PROG_SATURATION_LN_COEFF, { $ln: { $add: ['$qtyTotal', 1] } }] }],
                },
              ],
            },
          ],
        },
        // Cap grows sublinearly with total qty - ensure reasonable minimum cap
        capLimit: {
          $max: [
            { $multiply: [fallbackPrice, 2] }, // Minimum cap of 2x fallback price
            {
              $multiply: [
                fallbackPrice,
                {
                  $add: [PROG_CAP_BASE, { $multiply: [PROG_CAP_LN_COEFF, { $ln: { $add: ['$qtyTotal', 1] } }] }],
                },
                PROG_CAP_MULTIPLIER,
              ],
            },
          ],
        },
      },
    },
    {
      $addFields: {
        flatShipping: { $min: [{ $multiply: ['$rawShipping', '$saturationMultiplier'] }, '$capLimit'] },
      },
    },
  ]);

  console.log('Shipping calculation details:', {
    destination,
    fallbackPrice,
    itemsCount: items.length,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    aggregationResult: aggregationResult[0],
  });

  return aggregationResult[0]?.flatShipping ?? 0;
}

export default {
  getConfigByCountry,
  createConfig,
  updateConfig,
  listCountries,
  quote,
  listLocationsTree,
  createEmptyCountry,
  deleteCountry,
  updateCountryName,
  calculateProgressiveShipping,
};
