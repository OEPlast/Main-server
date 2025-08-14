/* eslint-disable @typescript-eslint/no-explicit-any */
// Verify Transaction Response
export interface PaystackVerifyTransactionResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: string;
    reference: string;
    receipt_number: string | null;
    amount: number;
    message: string | null;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    ip_address: string;
    metadata: any;
    log: {
      start_time: number;
      time_spent: number;
      attempts: number;
      errors: number;
      success: boolean;
      mobile: boolean;
      input: any[];
      history: Array<{
        type: string;
        message: string;
        time: number;
      }>;
    } | null;
    fees: number;
    fees_split: any;
    authorization: {
      authorization_code: string;
      bin: string;
      last4: string;
      exp_month: string | null;
      exp_year: string | null;
      channel: string;
      card_type: string | null;
      bank: string | null;
      country_code: string | null;
      brand: string | null;
      reusable: boolean;
      signature: string | null;
      account_name: string | null;
    } | null;
    customer: {
      id: number;
      first_name: string | null;
      last_name: string | null;
      email: string;
      customer_code: string;
      phone: string | null;
      metadata: any;
      risk_action: string;
      international_format_phone: string | null;
    } | null;
    plan: any;
    split: any;
    order_id: string | null;
    paidAt: string;
    createdAt: string;
    requested_amount: number;
    pos_transaction_data: any;
    source: any;
    fees_breakdown: any;
    connect: any;
    transaction_date: string;
    plan_object: any;
    subaccount: any;
  };
}

// Create Refund Response
export interface PaystackCreateRefundResponse {
  status: boolean;
  message: string;
  data: {
    transaction: {
      id: number;
      domain: string;
      reference: string;
      amount: number;
      paid_at: string;
      channel: string;
      currency: string;
      authorization: {
        exp_month: string | null;
        exp_year: string | null;
        account_name: string | null;
      } | null;
      customer: {
        international_format_phone: string | null;
      } | null;
      plan: any;
      subaccount: {
        currency: string | null;
      } | null;
      split: any;
      order_id: string | null;
      paidAt: string;
      pos_transaction_data: any;
      source: any;
      fees_breakdown: any;
    };
    integration: number;
    deducted_amount: number;
    channel: string | null;
    merchant_note: string;
    customer_note: string;
    status: string;
    refunded_by: string;
    expected_at: string;
    currency: string;
    domain: string;
    amount: number;
    fully_deducted: boolean;
    id: number;
    createdAt: string;
    updatedAt: string;
  };
}

export type PaystackWebhookData = {
  reference: string;
  status: string;
  id: string;
  amount: number;
  fees?: number;
  gateway_response: string;
  channel?: string;
  paid_at?: string;
  customer?: { email?: string };
  metadata?: Record<string, unknown>;
};

// Types for initialize
export interface PaystackInitializeData {
  email: string;
  amount: number; // kobo for NGN
  currency?: string;
  reference: string;
  callback_url?: string;
  metadata?: Record<string, unknown>;
  channels?: string[];
}

export interface PaystackResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}
