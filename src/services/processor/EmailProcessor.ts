import nodemailer from "nodemailer";
import { renderEmailTemplate } from "@/utils/email-template-engine";
import Settings from "@/models/Settings";
import {
  AbandonedCartData,
  CouponData,
  ForgotPasswordData,
  OrderCancelledData,
  OrderConfirmationData,
  OrderDeliveredData,
  OrderRefundedData,
  OrderShippedData,
  RatingRequestData,
  VerificationEmailData,
  WelcomeEmailData,
  WishlistData,
} from "@/types/email-data";
import { logger } from "@/lib/logger";

interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface PaymentReceiptData {
  to: string;
  orderNumber: string;
  amount: number;
  paymentMethod: string;
  customerName: string;
}

class EmailProcessor {
  private static transporter: nodemailer.Transporter;

  static async initialize(): Promise<void> {
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT!!),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await this.transporter.verify();
      logger.info("Email transporter verified successfully");
    } catch (error) {
      console.error("Email transporter verification failed:", error);
      throw error;
    }
  }

  static async sendEmail(emailData: EmailData): Promise<void> {
    try {
      const mailOptions = {
        from: process.env.FROM_EMAIL,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to: ${emailData.to}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Failed to send email to ${emailData.to}:`, errorMessage);
      throw error;
    }
  }

  private static async getLogoUrl(): Promise<string> {
    try {
      const settings = await Settings.findOne();
      return settings?.logoUrl ?? '';
    } catch {
      return '';
    }
  }

  static async sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
    const logoUrl = await this.getLogoUrl();
    const html = renderEmailTemplate('welcome', { ...data, logoUrl });
    
    const emailData: EmailData = {
      to: data.email,
      subject: "Welcome to Our Platform!",
      html,
      text: `Welcome! Thank you for joining our platform. Your account has been successfully created.`,
    };

    await this.sendEmail(emailData);
  }

  static async sendSignupOtpEmail(data: VerificationEmailData): Promise<void> {
    const logoUrl = await this.getLogoUrl();
    const html = renderEmailTemplate('verification-email', { ...data, logoUrl });
    
    const emailData: EmailData = {
      to: data.email,
      subject: "Verify Your Email - OTP Code",
      html,
      text: `Your verification code is: ${data.otpCode}. Please use this code to verify your email.`,
    };

    await this.sendEmail(emailData);
  }

  static async sendOrderConfirmationEmail(data: OrderConfirmationData): Promise<void> {
    const logoUrl = await this.getLogoUrl();
    const html = renderEmailTemplate('order-confirmation', { ...data, logoUrl });
    
    const emailData: EmailData = {
      to: data.email,
      subject: `Order Confirmation - ${data.invoiceNumber}`,
      html,
      text: `Order Confirmation - ${data.invoiceNumber}. Thank you for your order!`,
    };

    await this.sendEmail(emailData);
  }

  static async sendForgotPasswordEmail(data: ForgotPasswordData): Promise<void> {
    const logoUrl = await this.getLogoUrl();
    const html = renderEmailTemplate('forgot-password', { ...data, logoUrl });
    
    const emailData: EmailData = {
      to: data.email,
      subject: "Reset Your Password",
      html,
      text: `Your password reset code is: ${data.otpCode}. Use this code to reset your password.`,
    };

    await this.sendEmail(emailData);
  }

  static async sendAbandonedCartEmail(data: AbandonedCartData): Promise<void> {
    const logoUrl = await this.getLogoUrl();
    const html = renderEmailTemplate('abandoned-cart', { ...data, logoUrl });
    
    const emailData: EmailData = {
      to: data.email,
      subject: "Complete Your Purchase - Items Waiting in Your Cart",
      html,
      text: `You have items waiting in your cart. Complete your purchase now!`,
    };

    await this.sendEmail(emailData);
  }

  static async sendCouponEmail(data: CouponData): Promise<void> {
    const logoUrl = await this.getLogoUrl();
    const html = renderEmailTemplate('coupon', { ...data, logoUrl });
    
    const emailData: EmailData = {
      to: data.email,
      subject: `Special Offer: ${data.discount}% Discount Code Inside!`,
      html,
      text: `Use code ${data.couponCode} for ${data.discount}% off your next purchase!`,
    };

    await this.sendEmail(emailData);
  }

  static async sendOrderShippedEmail(data: OrderShippedData): Promise<void> {
    const logoUrl = await this.getLogoUrl();
    const html = renderEmailTemplate('order-shipped', { ...data, logoUrl });
    
    const emailData: EmailData = {
      to: data.email,
      subject: `Your Order Has Been Shipped - ${data.invoiceNumber}`,
      html,
      text: `Your order ${data.invoiceNumber} has been shipped. Tracking: ${data.trackingNumber}`,
    };

    await this.sendEmail(emailData);
  }

  static async sendOrderDeliveredEmail(data: OrderDeliveredData): Promise<void> {
    const logoUrl = await this.getLogoUrl();
    const html = renderEmailTemplate('order-delivered', { ...data, logoUrl });
    
    const emailData: EmailData = {
      to: data.email,
      subject: `Your Order Has Been Delivered - ${data.orderNumber}`,
      html,
      text: `Your order ${data.orderNumber} has been delivered successfully!`,
    };

    await this.sendEmail(emailData);
  }

  static async sendOrderRefundedEmail(data: OrderRefundedData): Promise<void> {
    const logoUrl = await this.getLogoUrl();
    const html = renderEmailTemplate('order-refunded', { ...data, logoUrl });
    
    const emailData: EmailData = {
      to: data.email,
      subject: `Refund Processed - ${data.returnId}`,
      html,
      text: `Your refund for order ${data.orderId} has been processed.`,
    };

    await this.sendEmail(emailData);
  }
    static async sendOrderCancelledEmail(data: OrderCancelledData): Promise<void> {
    const logoUrl = await this.getLogoUrl();
    const html = renderEmailTemplate('order-cancelled', { ...data, logoUrl });
    
    const emailData: EmailData = {
      to: data.email,
      subject: `Order Cancelled - ${data.orderId}`,
      html,
      text: `Your order ${data.orderId} has been cancelled.`,
    };

    await this.sendEmail(emailData);
  }


  static async sendRatingRequestEmail(data: RatingRequestData): Promise<void> {
    const logoUrl = await this.getLogoUrl();
    const html = renderEmailTemplate('rating', { ...data, logoUrl });
    
    const emailData: EmailData = {
      to: data.email,
      subject: "Rate Your Recent Purchase",
      html,
      text: `We'd love to hear your feedback on your recent purchase!`,
    };

    await this.sendEmail(emailData);
  }

  static async sendWishlistEmail(data: WishlistData): Promise<void> {
    const logoUrl = await this.getLogoUrl();
    const html = renderEmailTemplate('wishlist', { ...data, logoUrl });
    
    const emailData: EmailData = {
      to: data.email,
      subject: "Good News! Wishlist Items Are Back in Stock",
      html,
      text: `Items from your wishlist are now back in stock!`,
    };

    await this.sendEmail(emailData);
  }


  static async sendBulkEmail(emails: string[], subject: string, html: string, text?: string): Promise<void> {
    try {
      const emailPromises = emails.map((email) => this.sendEmail({ to: email, subject, html, text }));

      await Promise.all(emailPromises);
      console.log(`Bulk email sent to ${emails.length} recipients`);
    } catch (error) {
      console.error("Failed to send bulk email:", error);
      throw error;
    }
  }
}

export default EmailProcessor;
