import Product, { ProductType } from '@/models/Product';
import { CustomResponseType } from '@/types';

const list = async (
  page = 1,
  limit = 20,
  filters?: { q?: string; status?: string; lowOnly?: boolean }
): Promise<CustomResponseType<{ products: ProductType[]; total: number; page: number; limit: number }>> => {
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
        .sort({ updatedAt: -1 }),
      Product.countDocuments(query),
    ]);

    return { message: 'Inventory list', data: { products, total, page, limit }, code: 200 };
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

const setStock = async (productId: string, stock: number): Promise<CustomResponseType<{ stock: number }>> => {
  try {
    const product = await Product.findByIdAndUpdate(productId, { stock }, { new: true }).select('stock');
    if (!product) return { message: 'Product not found', data: null, code: 404 };
    return { message: 'Stock updated', data: { stock: product.stock }, code: 200 };
  } catch (error) {
    return { message: 'Failed to update stock', data: null, code: 500 };
  }
};

const bulkAdjustStock = async (
  updates: Array<{ productId: string; delta: number }>
): Promise<CustomResponseType<{ updated: number }>> => {
  try {
    const ops = updates.map((u) => ({
      updateOne: { filter: { _id: u.productId }, update: { $inc: { stock: u.delta } } },
    }));
    const result = await Product.bulkWrite(ops);
    return { message: 'Bulk stock adjusted', data: { updated: result.modifiedCount || 0 }, code: 200 };
  } catch (error) {
    return { message: 'Failed bulk adjust', data: null, code: 500 };
  }
};

const AdminInventoryService = { list, setLowStockThreshold, setStock, bulkAdjustStock };
export default AdminInventoryService;
