import mongoose from 'mongoose';
import Product from '@/models/Product';
import ProductSource from '@/models/ProductSource';
import { CustomResponseType } from '@/types';

export type SourceLink = { label: string; url: string };

export const MAX_SOURCE_LINKS = 20;

/** Trimmed, deduplicated links; an error message when one is unusable. */
export function normaliseSourceLinks(input: unknown): { links: SourceLink[] } | { error: string } {
  if (!Array.isArray(input)) return { error: 'links must be a list' };
  if (input.length > MAX_SOURCE_LINKS) return { error: `At most ${MAX_SOURCE_LINKS} source links` };
  const links: SourceLink[] = [];
  for (const raw of input as Array<Partial<SourceLink>>) {
    const label = typeof raw?.label === 'string' ? raw.label.trim() : '';
    const url = typeof raw?.url === 'string' ? raw.url.trim() : '';
    if (!label && !url) continue;
    if (!/^https?:\/\/\S+$/i.test(url)) return { error: `"${url || label}" is not a web link (it must start with http:// or https://)` };
    if (label.length > 60) return { error: 'A source label can be at most 60 characters' };
    if (!links.some((l) => l.url === url)) links.push({ label: label || url, url });
  }
  return { links };
}

/** The product's source links (empty when none were recorded). */
const getSources = async (productId: string): Promise<CustomResponseType<SourceLink[]>> => {
  if (!mongoose.isValidObjectId(productId)) return { message: 'Invalid product id', data: null, code: 400 };
  const doc = await ProductSource.findOne({ product: productId }).lean();
  return { message: 'Sources retrieved', data: doc?.links ?? [], code: 200 };
};

/** Replaces the product's source links; an empty list removes them. */
const setSources = async (productId: string, input: unknown): Promise<CustomResponseType<SourceLink[]>> => {
  if (!mongoose.isValidObjectId(productId)) return { message: 'Invalid product id', data: null, code: 400 };
  const checked = normaliseSourceLinks(input);
  if ('error' in checked) return { message: checked.error, data: null, code: 400 };
  if (!(await Product.exists({ _id: productId }))) return { message: 'Product not found', data: null, code: 404 };
  if (!checked.links.length) {
    await ProductSource.deleteOne({ product: productId });
    return { message: 'Sources removed', data: [], code: 200 };
  }
  await ProductSource.updateOne({ product: productId }, { $set: { links: checked.links } }, { upsert: true });
  return { message: 'Sources saved', data: checked.links, code: 200 };
};

const ProductSourcesService = { getSources, setSources };
export default ProductSourcesService;
