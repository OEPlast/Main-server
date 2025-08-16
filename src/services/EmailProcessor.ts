import { logger } from '@/lib/logger';
import nodemailer from 'nodemailer';

interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface WelcomeEmailData {
  to: string;
  firstName: string;
  userId: string;
}

interface OrderConfirmationData {
  to: string;
  orderNumber: string;
  totalAmount: number;
  customerName: string;
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
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await this.transporter.verify();
      logger.info('Email transporter verified successfully');
    } catch (error) {
      console.error('Email transporter verification failed:', error);
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to send email to ${emailData.to}:`, errorMessage);
      throw error;
    }
  }

  static async sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
    const emailData: EmailData = {
      to: data.to,
      subject: 'Welcome to Our Platform!',
      html: `
        <h1>Welcome, ${data.firstName}!</h1>
        <p>Thank you for joining our platform. We're excited to have you on board!</p>
        <p>Your account has been successfully created and you can now start exploring our features.</p>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <br>
        <p>Best regards,<br>The Team</p>
      `,
      text: `Welcome, ${data.firstName}! Thank you for joining our platform. Your account has been successfully created.`,
    };

    await this.sendEmail(emailData);
  }

  static async sendSignupOtpEmail(data: {
    to: string;
    firstName: string;
    otpCode: number;
    expiresInMinutes?: number;
  }): Promise<void> {
    const expirationTime = data.expiresInMinutes || 10;

    const emailData: EmailData = {
      to: data.to,
      subject: 'Verify Your Email - OTP Code',
      html: `
        <h1>Email Verification</h1>
        <p>Hi ${data.firstName},</p>
        <p>Thank you for signing up! To complete your registration, please use the verification code below:</p>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
          <h2 style="color: #333; font-size: 32px; letter-spacing: 2px; margin: 0;">${data.otpCode}</h2>
        </div>
        <p><strong>This code will expire in ${expirationTime} minutes.</strong></p>
        <p>If you didn't request this code, please ignore this email.</p>
        <br>
        <p>Best regards,<br>The Team</p>
      `,
      text: `Hi ${data.firstName}, your verification code is: ${data.otpCode}. This code expires in ${expirationTime} minutes.`,
    };

    await this.sendEmail(emailData);
  }

  static async sendPasswordResetEmail(data: {
    to: string;
    firstName: string;
    resetCode: string;
    expiresInMinutes?: number;
  }): Promise<void> {
    const expirationTime = data.expiresInMinutes || 10;

    const emailData: EmailData = {
      to: data.to,
      subject: 'Password Reset Request',
      html: `
        <h1>Password Reset Request</h1>
        <p>Hi ${data.firstName},</p>
        <p>We received a request to reset your password. Use the code below to reset your password:</p>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
          <h2 style="color: #333; font-size: 32px; letter-spacing: 2px; margin: 0;">${data.resetCode}</h2>
        </div>
        <p><strong>This code will expire in ${expirationTime} minutes.</strong></p>
        <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
        <br>
        <p>Best regards,<br>The Team</p>
      `,
      text: `Hi ${data.firstName}, your password reset code is: ${data.resetCode}. This code expires in ${expirationTime} minutes.`,
    };

    await this.sendEmail(emailData);
  }
  static async sendOrderConfirmationEmail(data: OrderConfirmationData): Promise<void> {
    const emailData: EmailData = {
      to: data.to,
      subject: `Order Confirmation - ${data.orderNumber}`,
      html: `
        <h1>Order Confirmation</h1>
        <p>Hi ${data.customerName},</p>
        <p>Thank you for your order! We have received your order and it is being processed.</p>
        <p><strong>Order Number:</strong> ${data.orderNumber}</p>
        <p><strong>Total Amount:</strong> $${data.totalAmount.toFixed(2)}</p>
        <p>We will send you another email once your order has been shipped with tracking information.</p>
        <br>
        <p>Best regards,<br>The Team</p>
      `,
      text: `Order Confirmation - ${data.orderNumber}. Total: $${data.totalAmount.toFixed(2)}`,
    };

    await this.sendEmail(emailData);
  }

  static async sendPaymentReceiptEmail(data: PaymentReceiptData): Promise<void> {
    const emailData: EmailData = {
      to: data.to,
      subject: `Payment Receipt - ${data.orderNumber}`,
      html: `
        <h1>Payment Receipt</h1>
        <p>Hi ${data.customerName},</p>
        <p>This email confirms that we have received your payment for order ${data.orderNumber}.</p>
        <p><strong>Amount Paid:</strong> $${data.amount.toFixed(2)}</p>
        <p><strong>Payment Method:</strong> ${data.paymentMethod}</p>
        <p><strong>Order Number:</strong> ${data.orderNumber}</p>
        <p>Your order is now being processed and will be shipped soon.</p>
        <br>
        <p>Best regards,<br>The Team</p>
      `,
      text: `Payment Receipt - ${data.orderNumber}. Amount: $${data.amount.toFixed(2)} via ${data.paymentMethod}`,
    };

    await this.sendEmail(emailData);
  }

  static async sendShippingNotificationEmail(data: {
    to: string;
    customerName: string;
    orderNumber: string;
    trackingNumber: string;
    shippingProvider: string;
  }): Promise<void> {
    const emailData: EmailData = {
      to: data.to,
      subject: `Your Order Has Shipped - ${data.orderNumber}`,
      html: `
        <h1>Your Order Has Shipped!</h1>
        <p>Hi ${data.customerName},</p>
        <p>Great news! Your order ${data.orderNumber} has been shipped and is on its way to you.</p>
        <p><strong>Tracking Number:</strong> ${data.trackingNumber}</p>
        <p><strong>Shipping Provider:</strong> ${data.shippingProvider}</p>
        <p>You can track your package using the tracking number above.</p>
        <br>
        <p>Best regards,<br>The Team</p>
      `,
      text: `Your order ${data.orderNumber} has shipped. Tracking: ${data.trackingNumber} via ${data.shippingProvider}`,
    };

    await this.sendEmail(emailData);
  }

  static async sendBulkEmail(emails: string[], subject: string, html: string, text?: string): Promise<void> {
    try {
      const emailPromises = emails.map((email) => this.sendEmail({ to: email, subject, html, text }));

      await Promise.all(emailPromises);
      console.log(`Bulk email sent to ${emails.length} recipients`);
    } catch (error) {
      console.error('Failed to send bulk email:', error);
      throw error;
    }
  }
}

export default EmailProcessor;
