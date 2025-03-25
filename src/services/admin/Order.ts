import Order from '../../models/Order';
import { CustomResponseType } from '../../types';

// Get all orders
const getAllOrders = async (): Promise<CustomResponseType<any>> => {
  try {
    const orders = await Order.find();
    return {
      message: 'Orders retrieved successfully',
      data: orders,
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching orders:', error);
    return {
      message: 'Failed to fetch orders',
      data: null,
      code: 500,
    };
  }
};

// Get order by ID
const getOrderById = async (orderId: string): Promise<CustomResponseType<any>> => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return {
        message: 'Order not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'Order retrieved successfully',
      data: order,
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching order by ID:', error);
    return {
      message: 'Failed to fetch order',
      data: null,
      code: 500,
    };
  }
};

// Update order status
const updateOrderStatus = async (orderId: string, status: string): Promise<CustomResponseType<null>> => {
  try {
    const order = await Order.findByIdAndUpdate(orderId, { status }, { new: true });
    if (!order) {
      return {
        message: 'Order not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'Order status updated successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error updating order status:', error);
    return {
      message: 'Failed to update order status',
      data: null,
      code: 500,
    };
  }
};

// Cancel an order
const cancelOrder = async (orderId: string): Promise<CustomResponseType<null>> => {
  try {
    const order = await Order.findByIdAndDelete(orderId);
    if (!order) {
      return {
        message: 'Order not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'Order canceled successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error canceling order:', error);
    return {
      message: 'Failed to cancel order',
      data: null,
      code: 500,
    };
  }
};

// Update delivery timeline
const updateDeliveryTimeline = async (orderId: string, timeline: string): Promise<CustomResponseType<null>> => {
  try {
    const order = await Order.findByIdAndUpdate(orderId, { timeline }, { new: true });
    if (!order) {
      return {
        message: 'Order not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'Delivery timeline updated successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error updating delivery timeline:', error);
    return {
      message: 'Failed to update delivery timeline',
      data: null,
      code: 500,
    };
  }
};

// Confirm an order
const confirmOrder = async (orderId: string): Promise<CustomResponseType<null>> => {
  try {
    const order = await Order.findByIdAndUpdate(orderId, { status: 'confirmed' }, { new: true });
    if (!order) {
      return {
        message: 'Order not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'Order confirmed successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error confirming order:', error);
    return {
      message: 'Failed to confirm order',
      data: null,
      code: 500,
    };
  }
};

// Reject an order
const rejectOrder = async (orderId: string): Promise<CustomResponseType<null>> => {
  try {
    const order = await Order.findByIdAndUpdate(orderId, { status: 'rejected' }, { new: true });
    if (!order) {
      return {
        message: 'Order not found',
        data: null,
        code: 404,
      };
    }
    return {
      message: 'Order rejected successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error rejecting order:', error);
    return {
      message: 'Failed to reject order',
      data: null,
      code: 500,
    };
  }
};

const OrderService = {
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  updateDeliveryTimeline,
  confirmOrder,
  rejectOrder,
};

export default OrderService;