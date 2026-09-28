/**
 * Cashfree Payments Web Checkout Client SDK Integration
 * Official Drop-in JS SDK for Cashfree PG (v3)
 */

declare global {
  interface Window {
    Cashfree: any;
  }
}

let cashfreeSdkPromise: Promise<any> | null = null;

export function loadCashfreeSDK(): Promise<any> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.Cashfree) return Promise.resolve(window.Cashfree);

  if (cashfreeSdkPromise) return cashfreeSdkPromise;

  cashfreeSdkPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('cashfree-js-sdk');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Cashfree));
      return;
    }

    const script = document.createElement('script');
    script.id = 'cashfree-js-sdk';
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true;
    script.onload = () => {
      resolve(window.Cashfree);
    };
    script.onerror = (err) => {
      console.error('Failed to load Cashfree JS SDK script:', err);
      reject(new Error('Cashfree SDK could not be loaded'));
    };
    document.body.appendChild(script);
  });

  return cashfreeSdkPromise;
}

export interface CheckoutOptions {
  paymentSessionId: string;
  orderNumber: string;
  isSimulated?: boolean;
  onSuccess?: () => void;
  onFailure?: (error: any) => void;
}

/**
 * Launches the Cashfree checkout modal or simulated test modal.
 */
export async function launchCashfreeCheckout(options: CheckoutOptions): Promise<void> {
  const { paymentSessionId, orderNumber, isSimulated } = options;

  if (isSimulated) {
    // Run Developer Sandbox Simulator
    const confirmed = window.confirm(
      `[Cashfree Developer Sandbox]\n\nOrder: ${orderNumber}\nPayment Session: ${paymentSessionId}\n\nClick "OK" to simulate SUCCESSFUL payment.\nClick "Cancel" to simulate FAILED payment.`
    );

    if (confirmed) {
      // Trigger Webhook simulation
      try {
        await fetch('/api/payments/cashfree-webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-simulated-event': 'true',
          },
          body: JSON.stringify({
            event_type: 'PAYMENT_SUCCESS_WEBHOOK',
            is_simulated: true,
            data: {
              order: { order_id: orderNumber },
              payment: {
                payment_status: 'SUCCESS',
                cf_payment_id: `sim_pay_${Date.now()}`,
                payment_group: 'UPI_SIMULATED',
              },
            },
          }),
        });
      } catch (e) {
        console.error('Simulated webhook error:', e);
      }
      window.location.href = `/order-confirmation?order_id=${encodeURIComponent(orderNumber)}`;
    } else {
      alert('Payment was cancelled or failed.');
      options.onFailure?.({ message: 'User cancelled payment' });
    }
    return;
  }

  // Official Cashfree SDK Drop-in Modal
  const Cashfree = await loadCashfreeSDK();
  const mode = import.meta.env.VITE_CASHFREE_MODE === 'PRODUCTION' ? 'production' : 'sandbox';
  const cashfree = Cashfree({ mode });

  cashfree.checkout({
    paymentSessionId,
    redirectTarget: '_self',
  });
}
