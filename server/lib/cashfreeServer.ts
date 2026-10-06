import crypto from 'node:crypto';

function getCashfreeConfig() {
  const appId = process.env.CASHFREE_APP_ID || '';
  const secretKey = process.env.CASHFREE_SECRET_KEY || '';
  const env = (process.env.CASHFREE_ENVIRONMENT || 'SANDBOX').toUpperCase();
  const apiVersion = process.env.CASHFREE_API_VERSION || '2023-08-01';
  const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET || secretKey;
  const baseUrl = env === 'PRODUCTION'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

  return { appId, secretKey, env, apiVersion, webhookSecret, baseUrl };
}

export interface CreateOrderParams {
  orderId: string;
  orderAmount: number; // in Rupees with 2 decimal precision, e.g. 349.00
  customerDetails: {
    customerId: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
  };
  returnUrl: string;
}

export interface CashfreeOrderResponse {
  cfOrderId: string;
  paymentSessionId: string;
  orderStatus: string;
  isSimulated: boolean;
}

/**
 * Creates an order on Cashfree Payments Gateway.
 * If credentials are not set, runs in Developer Sandbox Simulator mode.
 */
export async function createCashfreePGOrder(params: CreateOrderParams): Promise<CashfreeOrderResponse> {
  const config = getCashfreeConfig();
  const isCredentialsConfigured = Boolean(config.appId && config.secretKey);

  if (!isCredentialsConfigured) {
    console.log(`[Cashfree Simulator] Emulating payment session for order: ${params.orderId}`);
    return {
      cfOrderId: `cf_sim_${params.orderId}`,
      paymentSessionId: `session_sim_${params.orderId}_${Date.now()}`,
      orderStatus: 'ACTIVE',
      isSimulated: true,
    };
  }

  const endpoint = `${config.baseUrl}/orders`;
  const body = {
    order_id: params.orderId,
    order_amount: Number(params.orderAmount.toFixed(2)),
    order_currency: 'INR',
    customer_details: {
      customer_id: params.customerDetails.customerId,
      customer_name: params.customerDetails.customerName,
      customer_phone: params.customerDetails.customerPhone,
      customer_email: params.customerDetails.customerEmail || `${params.customerDetails.customerPhone}@thepetalandbloom.in`,
    },
    order_meta: {
      return_url: params.returnUrl,
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-client-id': config.appId,
        'x-client-secret': config.secretKey,
        'x-api-version': config.apiVersion,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.warn('[Cashfree Sandbox Notice]', data);
      // If test credentials return an issue (e.g., dormant account), fallback to Developer Simulator
      console.warn('[Cashfree Fallback] Automatically utilizing Developer Sandbox Simulator.');
      return {
        cfOrderId: `cf_sim_${params.orderId}`,
        paymentSessionId: `session_sim_${params.orderId}_${Date.now()}`,
        orderStatus: 'ACTIVE',
        isSimulated: true,
      };
    }

    return {
      cfOrderId: data.order_id || String(data.cf_order_id),
      paymentSessionId: data.payment_session_id,
      orderStatus: data.order_status,
      isSimulated: false,
    };
  } catch (err: any) {
    console.warn('[Cashfree Fetch Error, fallback to simulator]:', err.message);
    return {
      cfOrderId: `cf_sim_${params.orderId}`,
      paymentSessionId: `session_sim_${params.orderId}_${Date.now()}`,
      orderStatus: 'ACTIVE',
      isSimulated: true,
    };
  }
}

/**
 * Cryptographically verifies the Cashfree webhook signature using HMAC-SHA256.
 * Official Cashfree Webhook Signature Algorithm:
 * signature = Base64(HMAC-SHA256(timestamp + rawBody, webhookSecret))
 */
export function verifyCashfreeSignature(signature: string, timestamp: string, rawBody: string): boolean {
  const config = getCashfreeConfig();
  if (!config.webhookSecret) {
    console.error('[Cashfree Security] Webhook rejected: CASHFREE_WEBHOOK_SECRET is not configured on server.');
    return false;
  }

  if (!signature || !timestamp) {
    return false;
  }

  try {
    const payload = `${timestamp}${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', config.webhookSecret)
      .update(payload)
      .digest('base64');

    const sigBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch (err) {
    console.error('[Signature Verification Failed]', err);
    return false;
  }
}

/**
 * Fetches order details directly from Cashfree Payment Gateway.
 */
export async function fetchCashfreeOrder(orderId: string): Promise<any> {
  const config = getCashfreeConfig();
  if (!config.appId || !config.secretKey) {
    return null;
  }

  const endpoint = `${config.baseUrl}/orders/${encodeURIComponent(orderId)}`;
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'x-client-id': config.appId,
        'x-client-secret': config.secretKey,
        'x-api-version': config.apiVersion,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[Cashfree fetchCashfreeOrder] ${orderId} returned HTTP ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (err: any) {
    console.error(`[Cashfree fetchCashfreeOrder Error] for ${orderId}:`, err.message);
    return null;
  }
}

/**
 * Fetches payment attempts for an order from Cashfree Payment Gateway.
 */
export async function fetchCashfreePayments(orderId: string): Promise<any[]> {
  const config = getCashfreeConfig();
  if (!config.appId || !config.secretKey) {
    return [];
  }

  const endpoint = `${config.baseUrl}/orders/${encodeURIComponent(orderId)}/payments`;
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'x-client-id': config.appId,
        'x-client-secret': config.secretKey,
        'x-api-version': config.apiVersion,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[Cashfree fetchCashfreePayments] ${orderId} returned HTTP ${response.status}`);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (err: any) {
    console.error(`[Cashfree fetchCashfreePayments Error] for ${orderId}:`, err.message);
    return [];
  }
}
