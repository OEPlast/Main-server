import Order from '../models/Order';
import { CustomResponseType } from '../types';

/**
 * Fetches all orders for a user.
 * @param userId - The ID of the user.
 */
const getUserOrders = async (userId: string): Promise<CustomResponseType<any>> => {
  try {
    const orders = await Order.find({ user: userId });
    return {
      message: 'Orders retrieved successfully',
      data: orders,
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching user orders:', error);
    return {
      message: 'Failed to fetch orders',
      data: null,
      code: 500,
    };
  }
};

/**
 * Places a new order.
 * @param orderData - The data for the new order.
 */
const createOrder = async (orderData: any): Promise<CustomResponseType<any>> => {
  try {
    const order = new Order(orderData);
    await order.save();
    return {
      message: 'Order placed successfully',
      data: order,
      code: 201,
    };
  } catch (error) {
    console.error('Error creating order:', error);
    return {
      message: 'Failed to place order',
      data: null,
      code: 500,
    };
  }
};

export { getUserOrders, createOrder };
