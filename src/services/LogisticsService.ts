import LogisticsConfigModel from '@/models/LogisticsConfig';
import Product from '@/models/Product';
import { QuoteInput, QuoteResult, LogisticsConfig as LogisticsConfigType, LocationTree } from '@/types/logistics';
import { CustomResponsePromise } from '@/types';
import { PipelineStage } from 'mongoose';

const getConfigByCountry = async (countryCode: string): CustomResponsePromise<LogisticsConfigType> => {
  try {
    const cfg = await LogisticsConfigModel.findOne({ countryCode: countryCode.toUpperCase() })
      .lean<LogisticsConfigType>()
      .exec();
    if (!cfg) {
      return { message: 'Logistics config not found', data: null, code: 404 };
    }
    return { message: 'Logistics config retrieved successfully', data: cfg, code: 200 };
  } catch (error) {
    console.error('getConfigByCountry error:', error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

const upsertConfig = async (payload: LogisticsConfigType): CustomResponsePromise<LogisticsConfigType> => {
  try {
    const filter = { countryCode: payload.countryCode.toUpperCase() };
    const update = {
      countryCode: payload.countryCode.toUpperCase(),
      countryName: payload.countryName,
      states: payload.states ?? [],
    };
    const opts = { upsert: true, new: true, setDefaultsOnInsert: true } as const;
    const doc = await LogisticsConfigModel.findOneAndUpdate(filter, update, opts).lean<LogisticsConfigType>().exec();
    if (!doc) {
      return { message: 'Failed to upsert logistics config', data: null, code: 500 };
    }
    return { message: 'Logistics config upserted successfully', data: doc, code: 200 };
  } catch (error) {
    console.error('upsertConfig error:', error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

const listCountries = async (): CustomResponsePromise<
  Array<Pick<LogisticsConfigType, 'countryCode' | 'countryName'>>
> => {
  try {
    const docs = await LogisticsConfigModel.find({}, { countryCode: 1, countryName: 1, _id: 0 }).lean().exec();
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

    const product = await Product.findById(productId).lean().exec();
    if (!product) {
      return { message: 'Product not found', data: null, code: 404 };
    }

    const cfgResp = await getConfigByCountry(destination.countryCode);
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
): CustomResponsePromise<Pick<LogisticsConfigType, 'countryCode' | 'countryName' | 'states'>> => {
  try {
    const code = countryCode.toUpperCase();
    const exists = await LogisticsConfigModel.findOne({ countryCode: code }).lean().exec();
    if (exists) {
      return { message: 'Country already exists', data: null, code: 409 };
    }
    const created = await LogisticsConfigModel.create({ countryCode: code, countryName, states: [] });
    return {
      message: 'Country created successfully',
      data: { countryCode: created.countryCode, countryName: created.countryName, states: [] },
      code: 201,
    };
  } catch (error) {
    console.error('createEmptyCountry error:', error);
    return { message: 'Something went wrong', data: null, code: 500 };
  }
};

const deleteCountry = async (countryCode: string): CustomResponsePromise<null> => {
  try {
    const code = countryCode.toUpperCase();
    const res = await LogisticsConfigModel.deleteOne({ countryCode: code }).exec();
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
    )
      .lean<LogisticsConfigType>()
      .exec();
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

export default {
  getConfigByCountry,
  upsertConfig,
  listCountries,
  quote,
  listLocationsTree,
  createEmptyCountry,
  deleteCountry,
  updateCountryName,
};
