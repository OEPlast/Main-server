/**
 * Email Template Data Types
 * TypeScript interfaces for all email templates
 */

/**
 * Base user information for all emails
 */
export interface EmailUser extends Record<string, unknown> {
  firstName?: string;
  lastName?: string;
  email: string;
}

/**
 * Product information for emails
 */
export interface EmailProduct {
  name: string;
  imagePath: string;
  price?: number;
  discountPrice?: number;
  category?: string;
  quantity?: number;
  subtotal?: number;
  reviewLink?: string;
}

/**
 * Shipping information
 */
export interface ShippingInfo {
  courier: string;
  address: string;
  _id?: string;
}

/**
 * Payment details
 */
export interface PaymentDetails {
  totalShopping: number;
  shipping: number;
  tax: number;
  discount: number;
  subtotal: number;
}

/**
 * 1. Abandoned Cart Email
 * Reminds users about items left in shopping cart
 */
export interface AbandonedCartData extends EmailUser {
  cartItems: EmailProduct[];
  cartLink: string;
}

/**
 * 2. Coupon/Discount Email
 * Promotional coupon or discount notifications
 */
export interface CouponData extends EmailUser {
  discount: number;
  couponCode: string;
  expiryDate: Date;
  productCount: number;
  useCouponLink: string;
}

/**
 * 3. Forgot Password Email
 * Password reset with OTP code
 */
export interface ForgotPasswordData extends EmailUser {
  otpCode: string;
}

/**
 * 4. Order Confirmation Email
 * Order purchase confirmation with full details
 */
export interface OrderConfirmationData extends EmailUser {
  purchaseDate: Date;
  orderId: string;
  shipping: ShippingInfo;
  products: EmailProduct[];
  payment: PaymentDetails;
  orderStatusLink: string;
  deliveryType: string;
}

/**
 * 5. Order Delivered Email
 * Delivery confirmation notification
 */
export interface OrderDeliveredData extends EmailUser {
  trackingNumber?: string;
  purchaseDate: Date;
  orderNumber: string;
  products: EmailProduct[];
  viewOrderLink: string;

  orderId: string;
  shipmentId: string;
  courierName: string;
  deliveredAt: string;
  deliveryAddress: string;
}

/**
 * 6. Order Refunded Email
 * Refund/return processed notification
 */
export interface OrderRefundedData extends EmailUser {
  purchaseDate: Date;
  orderId: string;
  returnId: string;
  shipping: ShippingInfo;
  returnedProducts: EmailProduct[];
  refundAmount: number;
  checkRefundLink: string;
}

/**
 * 7. Order Cancelled Email
 * Order cancellation notification
 */
export interface OrderCancelledData extends EmailUser {
  orderId: string;
  products: EmailProduct[];
}

/**
 * 8. Order Shipped Email
 * Shipping notification with tracking
 */
export interface OrderShippedData extends EmailUser {
  trackingNumber: string;
  orderStatus: string;
  purchaseDate: Date;
  orderNumber: string;
  shipping: ShippingInfo;
  manageOrderLink: string;
}

/**
 * 9. Rating Request Email
 * Request product reviews after purchase
 */
export interface RatingRequestData extends EmailUser {
  products: EmailProduct[];
}

/**
 * 10. Verification Email
 * Email verification with OTP
 */
export interface VerificationEmailData extends EmailUser {
  otpCode: string;
  expiresInMinutes: number;
}

/**
 * 11. Welcome Email
 * New user welcome email
 */
export interface WelcomeEmailData extends EmailUser {
  companyName: string;
  welcomeImageUrl?: string;
  startShoppingLink: string;
}

/**
 * 12. Wishlist Email
 * Wishlist items back in stock notification
 */
export interface WishlistData extends EmailUser {
  products: EmailProduct[];
  viewWishlistLink: string;
}
