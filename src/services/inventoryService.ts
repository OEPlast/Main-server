import Product from '@/models/Product';
import { CustomResponseType } from '@/types';
import eventPublisher from '@/events/eventPublisher';

/**
 * Get product availability and variant-level stock if attributes exist
 */
const getAvailability = async (
  productId: string
): Promise<CustomResponseType<{ inStock: boolean; stock: number; lowStock: boolean }>> => {
  try {
    const product = await Product.findById(productId).select('name stock lowStockThreshold');
    if (!product) {
      return { message: 'Product not found', data: null, code: 404 };
    }

    const lowStock = product.stock <= product.lowStockThreshold;
    return {
      message: 'Availability retrieved',
      data: { inStock: product.stock > 0, stock: product.stock, lowStock },
      code: 200,
    };
  } catch (error) {
    return { message: 'Failed to get availability', data: null, code: 500 };
  }
};

/**
 * Adjust stock atomically, emit low stock events
 */
const adjustStock = async (productId: string, delta: number): Promise<CustomResponseType<{ stock: number }>> => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: productId },
      { $inc: { stock: delta } },
      { new: true }
    ).select('name stock lowStockThreshold');

    if (!product) {
      return { message: 'Product not found', data: null, code: 404 };
    }

    if (product.stock <= product.lowStockThreshold) {
      await eventPublisher.publishInventoryLow(productId, product.stock, product.lowStockThreshold, product.name);
    }

    return { message: 'Stock updated', data: { stock: product.stock }, code: 200 };
  } catch (error) {
    return { message: 'Failed to update stock', data: null, code: 500 };
  }
};

/**
 * Reserve stock before checkout (simple hold). For demo, we just validate.
 */
const validateReservation = async (
  productId: string,
  quantity: number
): Promise<CustomResponseType<{ ok: boolean }>> => {
  try {
    const product = await Product.findById(productId).select('stock');
    if (!product) return { message: 'Product not found', data: null, code: 404 };
    if (product.stock < quantity) return { message: 'Insufficient stock', data: null, code: 400 };
    return { message: 'Reservation valid', data: { ok: true }, code: 200 };
  } catch (error) {
    return { message: 'Failed to validate reservation', data: null, code: 500 };
  }
};

const InventoryService = { getAvailability, adjustStock, validateReservation };
export default InventoryService;
