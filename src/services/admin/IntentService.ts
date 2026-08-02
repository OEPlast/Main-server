import Intent, { IIntent } from '@/models/Intent';
import { CustomResponseType } from '@/types';
import { Types } from 'mongoose';

/**
 * Admin CRUD for intent shops (curated SEO landing pages).
 * Public reads live in `services/IntentService.ts`.
 *
 * Note: every write goes through `document.save()` rather than
 * `findByIdAndUpdate`, because the model's publish/thin-page rules live in a
 * `pre('validate')` document hook — query middleware would skip it entirely.
 */

export type CreateIntentInput = {
  slug: string;
  heading: string;
  title: string;
  description: string;
  keywords?: string[];
  intro?: string;
  /** Ordered product ids — array order is the storefront display order. */
  products: string[];
  faqs?: Array<{ question: string; answer: string }>;
  status?: 'active' | 'inactive' | 'draft';
};

export type UpdateIntentInput = Partial<CreateIntentInput>;

const DUPLICATE_KEY = 11000;

/** Product fields the admin table/form needs when echoing an intent back. */
const PRODUCT_FIELDS = 'name slug price stock status description_images images';

const populateProducts = <T>(q: T) =>
  (q as unknown as { populate: (o: unknown) => T }).populate({
    path: 'products',
    select: PRODUCT_FIELDS,
  });

const failure = (error: unknown, fallback: string): CustomResponseType<never> => {
  if ((error as { code?: number })?.code === DUPLICATE_KEY) {
    return { code: 409, message: 'Slug already in use', data: null };
  }
  // Mongoose validation errors carry a usable message — surface it to the admin UI.
  return { code: 400, message: (error as Error).message || fallback, data: null };
};

const createIntent = async (input: CreateIntentInput): Promise<CustomResponseType<IIntent>> => {
  try {
    const existing = await Intent.findOne({ slug: input.slug }).lean();
    if (existing) {
      return { code: 409, message: `An intent with slug "${input.slug}" already exists`, data: null };
    }

    const intent = await Intent.create(input);
    await intent.populate({ path: 'products', select: PRODUCT_FIELDS });

    return { code: 201, message: 'Intent created successfully', data: intent.toObject() as IIntent };
  } catch (error) {
    return failure(error, 'Failed to create intent');
  }
};

/**
 * List intents for the admin table. Returns full documents — the collection is
 * curated and small by design, so pagination is intentionally omitted.
 */
const getAllIntents = async (
  status?: string
): Promise<CustomResponseType<{ intents: IIntent[]; total: number }>> => {
  const filter: Record<string, unknown> = {};
  if (status && ['active', 'inactive', 'draft'].includes(status)) {
    filter.status = status;
  }

  const intents = (await populateProducts(Intent.find(filter).sort({ updatedAt: -1 })).lean()) as IIntent[];

  return {
    code: 200,
    message: 'Intents fetched successfully',
    data: { intents, total: intents.length },
  };
};

const getIntentById = async (intentId: string): Promise<CustomResponseType<IIntent>> => {
  if (!Types.ObjectId.isValid(intentId)) {
    return { code: 400, message: 'Invalid intent id', data: null };
  }

  const intent = (await populateProducts(Intent.findById(intentId)).lean()) as IIntent | null;
  if (!intent) {
    return { code: 404, message: 'Intent not found', data: null };
  }

  return { code: 200, message: 'Intent fetched successfully', data: intent };
};

const updateIntent = async (
  intentId: string,
  updates: UpdateIntentInput
): Promise<CustomResponseType<IIntent>> => {
  if (!Types.ObjectId.isValid(intentId)) {
    return { code: 400, message: 'Invalid intent id', data: null };
  }

  try {
    if (updates.slug) {
      const clash = await Intent.findOne({ slug: updates.slug, _id: { $ne: intentId } }).lean();
      if (clash) {
        return { code: 409, message: `An intent with slug "${updates.slug}" already exists`, data: null };
      }
    }

    const intent = await Intent.findById(intentId);
    if (!intent) {
      return { code: 404, message: 'Intent not found', data: null };
    }

    intent.set(updates);
    await intent.save();
    await intent.populate({ path: 'products', select: PRODUCT_FIELDS });

    return { code: 200, message: 'Intent updated successfully', data: intent.toObject() as IIntent };
  } catch (error) {
    return failure(error, 'Failed to update intent');
  }
};

const deleteIntent = async (intentId: string): Promise<CustomResponseType> => {
  if (!Types.ObjectId.isValid(intentId)) {
    return { code: 400, message: 'Invalid intent id', data: null };
  }

  const deleted = await Intent.findByIdAndDelete(intentId).lean();
  if (!deleted) {
    return { code: 404, message: 'Intent not found', data: null };
  }

  return { code: 200, message: 'Intent deleted successfully', data: null };
};

/**
 * Publish / unpublish. Goes through save() so that publishing an intent with
 * too few products is rejected by the model rather than silently allowed.
 */
const toggleIntentStatus = async (
  intentId: string,
  status: 'active' | 'inactive' | 'draft'
): Promise<CustomResponseType<IIntent>> => {
  if (!Types.ObjectId.isValid(intentId)) {
    return { code: 400, message: 'Invalid intent id', data: null };
  }

  try {
    const intent = await Intent.findById(intentId);
    if (!intent) {
      return { code: 404, message: 'Intent not found', data: null };
    }

    intent.status = status;
    await intent.save();
    await intent.populate({ path: 'products', select: PRODUCT_FIELDS });

    return { code: 200, message: 'Intent status updated successfully', data: intent.toObject() as IIntent };
  } catch (error) {
    return failure(error, 'Failed to update intent status');
  }
};

const checkSlugAvailability = async (
  slug: string,
  excludeId?: string
): Promise<CustomResponseType<{ available: boolean }>> => {
  const filter: Record<string, unknown> = { slug: slug.toLowerCase() };
  if (excludeId && Types.ObjectId.isValid(excludeId)) {
    filter._id = { $ne: excludeId };
  }

  const existing = await Intent.findOne(filter).lean();

  return {
    code: 200,
    message: existing ? 'Slug is already taken' : 'Slug is available',
    data: { available: !existing },
  };
};

export default {
  createIntent,
  getAllIntents,
  getIntentById,
  updateIntent,
  deleteIntent,
  toggleIntentStatus,
  checkSlugAvailability,
};
