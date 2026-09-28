/**
 * The Petal & Bloom — Atelier Email Service
 * Luxury transactional email notifications for order confirmation and dispatch.
 * Uses Resend API with resilient error handling and graceful fallbacks.
 */

interface OrderConfirmationEmailParams {
  to: string;
  name: string;
  orderNumber: string;
  items: Array<{
    product_name: string;
    product_code?: string;
    quantity: number;
    unit_price_in_paise: number;
    selected_color?: string | null;
    gift_wrap?: boolean;
    personal_message?: string | null;
  }>;
  subtotalInPaise: number;
  discountInPaise: number;
  loyaltyDiscountInPaise?: number;
  shippingFeeInPaise: number;
  totalInPaise: number;
  shippingAddress: {
    recipientName?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    phone?: string;
  };
  trackUrl: string;
}

interface DispatchEmailParams {
  to: string;
  name: string;
  orderNumber: string;
  carrier: string;
  awbNumber: string;
  trackingUrl: string;
  estimatedDelivery?: string;
  shippingAddress: {
    recipientName?: string;
    addressLine1: string;
    city: string;
    state: string;
    pincode: string;
  };
}

const BRAND_STYLES = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background-color: #FAF6EF;
  color: #4A4238;
  margin: 0;
  padding: 40px 20px;
`;

const CONTAINER_STYLES = `
  max-width: 600px;
  margin: 0 auto;
  background-color: #FFFFFF;
  border: 1px solid #E5DFD5;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(74, 66, 56, 0.05);
`;

const HEADER_STYLES = `
  background-color: #4A4238;
  color: #FAF6EF;
  padding: 32px 24px;
  text-align: center;
`;

const CONTENT_STYLES = `
  padding: 32px 28px;
`;

const FOOTER_STYLES = `
  background-color: #F5EFE6;
  padding: 24px;
  text-align: center;
  font-size: 12px;
  color: #8C8275;
  border-top: 1px solid #E5DFD5;
`;

const BUTTON_STYLES = `
  display: inline-block;
  background-color: #A36B67;
  color: #FAF6EF;
  padding: 14px 32px;
  text-decoration: none;
  border-radius: 4px;
  font-weight: 500;
  font-size: 14px;
  letter-spacing: 0.05em;
  margin: 20px 0;
`;

function formatCurrency(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

async function sendEmailViaResend(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || 'The Petal & Bloom Studio <orders@thepetalandbloom.in>';

  if (!apiKey) {
    console.log(`[Email Service Simulation] API Key not set. Would have sent email to ${to}: "${subject}"`);
    return true;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[Resend Email Error]', data);
      return false;
    }

    console.log(`[Email Sent] Successfully delivered to ${to} (ID: ${data.id})`);
    return true;
  } catch (error) {
    console.error('[Resend Email Exception]', error);
    return false;
  }
}

export async function sendOrderConfirmationEmail(params: OrderConfirmationEmailParams): Promise<boolean> {
  const itemsHtml = params.items.map(item => `
    <tr style="border-bottom: 1px solid #F5EFE6;">
      <td style="padding: 12px 0;">
        <strong style="color: #4A4238; font-size: 14px;">${item.product_name}</strong>
        ${item.selected_color ? `<br/><span style="font-size: 12px; color: #8C8275;">Yarn Shade: ${item.selected_color}</span>` : ''}
        ${item.gift_wrap ? `<br/><span style="font-size: 11px; color: #A36B67;">✨ Atelier Gift Wrapped</span>` : ''}
        ${item.personal_message ? `<br/><span style="font-size: 11px; color: #8C8275; font-style: italic;">“${item.personal_message}”</span>` : ''}
      </td>
      <td style="padding: 12px 0; text-align: center; color: #6E6457; font-size: 14px;">
        ${item.quantity}
      </td>
      <td style="padding: 12px 0; text-align: right; color: #4A4238; font-size: 14px; font-weight: 500;">
        ${formatCurrency(item.unit_price_in_paise * item.quantity)}
      </td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"/><title>Order Confirmed</title></head>
      <body style="${BRAND_STYLES}">
        <div style="${CONTAINER_STYLES}">
          <div style="${HEADER_STYLES}">
            <p style="margin: 0; font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: #E5DFD5;">The Petal & Bloom Studio</p>
            <h1 style="margin: 8px 0 0 0; font-family: Georgia, serif; font-size: 26px; font-weight: normal; color: #FAF6EF;">Flowers that never fade.</h1>
          </div>
          <div style="${CONTENT_STYLES}">
            <h2 style="font-family: Georgia, serif; font-size: 20px; color: #4A4238; margin-top: 0;">Thank you, ${params.name}.</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #6E6457;">
              Your order <strong>${params.orderNumber}</strong> has been received and scheduled with our studio artisans. Each bloom is hand-sculpted stitch-by-stitch from archival cotton yarn.
            </p>

            <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
              <thead>
                <tr style="border-bottom: 2px solid #4A4238; text-align: left; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #8C8275;">
                  <th style="padding-bottom: 8px;">Arrangement</th>
                  <th style="padding-bottom: 8px; text-align: center;">Qty</th>
                  <th style="padding-bottom: 8px; text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div style="background-color: #FAF6EF; padding: 16px; border-radius: 6px; margin: 20px 0;">
              <table style="width: 100%; font-size: 13px; color: #6E6457;">
                <tr>
                  <td>Subtotal:</td>
                  <td style="text-align: right;">${formatCurrency(params.subtotalInPaise)}</td>
                </tr>
                ${params.discountInPaise > 0 ? `
                <tr style="color: #A36B67;">
                  <td>Coupon Savings:</td>
                  <td style="text-align: right;">-${formatCurrency(params.discountInPaise)}</td>
                </tr>` : ''}
                ${(params.loyaltyDiscountInPaise || 0) > 0 ? `
                <tr style="color: #A36B67;">
                  <td>Petal Points Redeemed:</td>
                  <td style="text-align: right;">-${formatCurrency(params.loyaltyDiscountInPaise || 0)}</td>
                </tr>` : ''}
                <tr>
                  <td>Delivery:</td>
                  <td style="text-align: right;">${params.shippingFeeInPaise === 0 ? 'Complimentary' : formatCurrency(params.shippingFeeInPaise)}</td>
                </tr>
                <tr style="font-size: 15px; font-weight: bold; color: #4A4238; border-top: 1px solid #E5DFD5;">
                  <td style="padding-top: 8px;">Total:</td>
                  <td style="padding-top: 8px; text-align: right;">${formatCurrency(params.totalInPaise)}</td>
                </tr>
              </table>
            </div>

            <div style="margin: 20px 0; font-size: 13px; color: #6E6457;">
              <strong style="color: #4A4238;">Delivery Address:</strong><br/>
              ${params.shippingAddress.recipientName || params.name}<br/>
              ${params.shippingAddress.addressLine1}${params.shippingAddress.addressLine2 ? `, ${params.shippingAddress.addressLine2}` : ''}<br/>
              ${params.shippingAddress.city}, ${params.shippingAddress.state} - ${params.shippingAddress.pincode}
            </div>

            <div style="text-align: center; margin: 30px 0 10px 0;">
              <a href="${params.trackUrl}" style="${BUTTON_STYLES}">Track Studio Progress</a>
            </div>
          </div>
          <div style="${FOOTER_STYLES}">
            <p style="margin: 0 0 8px 0;">The Petal & Bloom • Handcrafted Floral Atelier • India</p>
            <p style="margin: 0;">Questions? Reach our Studio Concierge on WhatsApp: +91 9931653303</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmailViaResend(params.to, `Order Confirmed: ${params.orderNumber} — The Petal & Bloom`, html);
}

export async function sendDispatchEmail(params: DispatchEmailParams): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"/><title>Your Blooms Have Dispatched</title></head>
      <body style="${BRAND_STYLES}">
        <div style="${CONTAINER_STYLES}">
          <div style="${HEADER_STYLES}">
            <p style="margin: 0; font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: #E5DFD5;">Studio Dispatch Notification</p>
            <h1 style="margin: 8px 0 0 0; font-family: Georgia, serif; font-size: 26px; font-weight: normal; color: #FAF6EF;">Your blooms are on their way.</h1>
          </div>
          <div style="${CONTENT_STYLES}">
            <h2 style="font-family: Georgia, serif; font-size: 20px; color: #4A4238; margin-top: 0;">Greetings, ${params.name}.</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #6E6457;">
              Your order <strong>${params.orderNumber}</strong> has completed hand-sculpting, quality inspection, and has been safely nestled into our archival postal box. It is now with our logistics partner.
            </p>

            <div style="background-color: #FAF6EF; padding: 20px; border-radius: 6px; margin: 24px 0; border: 1px solid #E5DFD5;">
              <table style="width: 100%; font-size: 13px; color: #6E6457;">
                <tr>
                  <td style="padding-bottom: 8px;"><strong>Courier Partner:</strong></td>
                  <td style="text-align: right; padding-bottom: 8px; color: #4A4238;">${params.carrier}</td>
                </tr>
                <tr>
                  <td style="padding-bottom: 8px;"><strong>AWB Tracking Number:</strong></td>
                  <td style="text-align: right; padding-bottom: 8px; font-family: monospace; color: #4A4238; font-weight: bold;">${params.awbNumber}</td>
                </tr>
                ${params.estimatedDelivery ? `
                <tr>
                  <td><strong>Estimated Delivery:</strong></td>
                  <td style="text-align: right; color: #A36B67; font-weight: 500;">${params.estimatedDelivery}</td>
                </tr>` : ''}
              </table>
            </div>

            <div style="margin: 20px 0; font-size: 13px; color: #6E6457;">
              <strong style="color: #4A4238;">Shipping Destination:</strong><br/>
              ${params.shippingAddress.recipientName || params.name}<br/>
              ${params.shippingAddress.addressLine1}<br/>
              ${params.shippingAddress.city}, ${params.shippingAddress.state} - ${params.shippingAddress.pincode}
            </div>

            <div style="text-align: center; margin: 30px 0 10px 0;">
              <a href="${params.trackingUrl}" style="${BUTTON_STYLES}">Track Live Consignment</a>
            </div>
          </div>
          <div style="${FOOTER_STYLES}">
            <p style="margin: 0 0 8px 0;">The Petal & Bloom • Handcrafted Floral Atelier • India</p>
            <p style="margin: 0;">Questions or delivery instructions? WhatsApp: +91 9931653303</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmailViaResend(params.to, `Dispatch Notice: Order ${params.orderNumber} is on its way!`, html);
}
