import Product, { ProductType } from '@/models/Product';
import { CustomResponseType } from '@/types';
import eventPublisher from '@/events/eventPublisher';

type InventoryChild = { name: string; stock: number };
type InventoryAttribute = { name: string; children: InventoryChild[] };
type InventoryListItem = { _id: string; stock: number; lowStockThreshold: number; attributes?: InventoryAttribute[] };

const list = async (
  page = 1,
  limit = 20,
  filters?: { q?: string; status?: string; lowOnly?: boolean }
): Promise<CustomResponseType<{ products: InventoryListItem[]; total: number; page: number; limit: number }>> => {
  try {
    const query: Record<string, unknown> = {};
    if (filters?.q) {
      query.$or = [
        { name: { $regex: filters.q, $options: 'i' } },
        { brand: { $regex: filters.q, $options: 'i' } },
        { tags: { $elemMatch: { $regex: filters.q, $options: 'i' } } },
      ];
    }
    if (filters?.status) query.status = filters.status;
    if (filters?.lowOnly) query.$expr = { $lte: ['$stock', '$lowStockThreshold'] };

    const [products, total] = await Promise.all([
      Product.find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ updatedAt: -1 })
        .select('stock lowStockThreshold attributes.name attributes.children.name attributes.children.stock'),
      Product.countDocuments(query),
    ]);

    const mapped: InventoryListItem[] = products.map((p) => ({
      _id: (p as unknown as { _id: string })._id,
      stock: p.stock,
      lowStockThreshold: p.lowStockThreshold,
      attributes:
        p.attributes && p.attributes.length > 0
          ? p.attributes.map((a) => ({
              name: a.name,
              children: (a.children || []).map((c) => ({ name: c.name, stock: c.stock }) as InventoryChild),
            }))
          : undefined,
    }));

    return { message: 'Inventory list', data: { products: mapped, total, page, limit }, code: 200 };
  } catch (error) {
    return { message: 'Failed to list inventory', data: null, code: 500 };
  }
};

const setLowStockThreshold = async (
  productId: string,
  threshold: number
): Promise<CustomResponseType<{ lowStockThreshold: number }>> => {
  try {
    const product = await Product.findByIdAndUpdate(productId, { lowStockThreshold: threshold }, { new: true }).select(
      'lowStockThreshold'
    );

    if (!product) return { message: 'Product not found', data: null, code: 404 };

    return { message: 'Threshold updated', data: { lowStockThreshold: product.lowStockThreshold }, code: 200 };
  } catch (error) {
    return { message: 'Failed to update threshold', data: null, code: 500 };
  }
};

type VariantStockUpdate = { attributeName: string; childName: string; stock: number };

const sumAttributeStocks = (product: Pick<ProductType, 'attributes'>): number => {
  if (!product.attributes || product.attributes.length === 0) return 0;
  return product.attributes.reduce((accAttr, attr) => {
    const children = attr?.children || [];
    const attrSum = children.reduce((acc, c) => acc + (typeof c.stock === 'number' ? c.stock : 0), 0);
    return accAttr + attrSum;
  }, 0);
};

const setStock = async (
  productId: string,
  payload: { stock?: number; variants?: VariantStockUpdate[] }
): Promise<CustomResponseType<{ stock: number }>> => {
  try {
    const { stock, variants } = payload;

    const product = await Product.findById(productId).select(
      'name price stock lowStockThreshold attributes.name attributes.children.name attributes.children.stock'
    );
    if (!product) return { message: 'Product not found', data: null, code: 404 };

    const hasAttributeChildren = (product.attributes || []).some((a) => (a.children || []).length > 0);

    // If variant updates are provided, apply them and enforce totals
    if (variants && variants.length > 0) {
      // Validate inputs are non-negative
      const invalid = variants.find((v) => v.stock < 0 || !v.attributeName || !v.childName);
      if (invalid) return { message: 'Invalid variant stock payload', data: null, code: 400 };

      const notFound: Array<{ attributeName: string; childName: string }> = [];
      for (const v of variants) {
        const attr = (product.attributes || []).find((a) => a.name === v.attributeName);
        const child = attr?.children?.find((c) => c.name === v.childName);
        if (!attr || !child) {
          notFound.push({ attributeName: v.attributeName, childName: v.childName });
        } else {
          child.stock = v.stock;
        }
      }

      if (notFound.length > 0) {
        return {
          message: `Variant(s) not found: ${notFound.map((n) => `${n.attributeName}:${n.childName}`).join(', ')}`,
          data: null,
          code: 400,
        };
      }

      // After updates, compute sum and validate against provided stock (if any)
      const computedSum = sumAttributeStocks(product as unknown as ProductType);
      if (typeof stock === 'number' && stock !== computedSum) {
        return {
          message: `Total stock (${stock}) must equal sum of variant stocks (${computedSum})`,
          data: null,
          code: 400,
        };
      }

      product.stock = typeof stock === 'number' ? stock : computedSum;
      await product.save();

      if (product.stock <= product.lowStockThreshold) {
        await eventPublisher.publishInventoryLow(productId, product.stock, product.lowStockThreshold, product.name);
      }

      await eventPublisher.publishProductUpdated(productId, product.name, (product as any).price ?? 0, product.stock);
      return { message: 'Stock updated', data: { stock: product.stock }, code: 200 };
    }

    // No variants provided
    if (typeof stock !== 'number') {
      return { message: 'Provide either stock or variants to update', data: null, code: 400 };
    }

    if (hasAttributeChildren) {
      const currentSum = sumAttributeStocks(product as unknown as ProductType);
      if (stock !== currentSum) {
        return {
          message:
            'Product has attribute-level stock. Provide variants so that their sum equals the desired total stock.',
          data: null,
          code: 400,
        };
      }
      // Stock matches the current sum: just persist total stock for consistency
      product.stock = stock;
      await product.save();
    } else {
      // Simple product without attribute-level stock
      product.stock = stock;
      await product.save();
    }

    if (product.stock <= product.lowStockThreshold) {
      await eventPublisher.publishInventoryLow(productId, product.stock, product.lowStockThreshold, product.name);
    }

    await eventPublisher.publishProductUpdated(productId, product.name, (product as any).price ?? 0, product.stock);
    return { message: 'Stock updated', data: { stock: product.stock }, code: 200 };
  } catch (error) {
    return { message: 'Failed to update stock', data: null, code: 500 };
  }
};

const AdminInventoryService = { list, setLowStockThreshold, setStock };
export default AdminInventoryService;
