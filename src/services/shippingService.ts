export type CarrierType = 'SHIPROCKET' | 'DELHIVERY' | 'INDIA_POST' | 'MANUAL';

export interface ShipmentDetails {
  carrier: CarrierType;
  awbNumber: string;
  trackingUrl?: string;
  status: 'PENDING' | 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'RTO';
  estimatedDelivery?: string;
}

/**
 * Carrier tracking URL generation abstraction.
 * Formats public tracking links based on Indian logistics carriers.
 */
export function generateTrackingUrl(carrier: CarrierType, awbNumber: string): string {
  const cleanAwb = awbNumber.trim();
  if (!cleanAwb) return '';

  switch (carrier) {
    case 'DELHIVERY':
      return `https://www.delhivery.com/track/package/${cleanAwb}`;
    case 'SHIPROCKET':
      return `https://shiprocket.co//tracking/${cleanAwb}`;
    case 'INDIA_POST':
      return `https://www.indiapost.gov.in/_layouts/15/dpt.cept.tracking/trackconsignment.aspx?consignmentNumber=${cleanAwb}`;
    case 'MANUAL':
    default:
      return '';
  }
}

/**
 * Calculates human-readable estimated delivery window based on creation time and crafting days.
 */
export function calculateEstimatedDelivery(createdAt: string | Date, preparationDays = '3–5 days'): {
  minDate: Date;
  maxDate: Date;
  formattedRange: string;
} {
  const baseDate = new Date(createdAt);
  
  // Extract days from string, default 4 days crafting + 3 days transit
  let craftDays = 4;
  const match = preparationDays.match(/\d+/);
  if (match) {
    craftDays = parseInt(match[0], 10);
  }

  const transitDaysMin = 2;
  const transitDaysMax = 5;

  const minDate = new Date(baseDate);
  minDate.setDate(minDate.getDate() + craftDays + transitDaysMin);

  const maxDate = new Date(baseDate);
  maxDate.setDate(maxDate.getDate() + craftDays + transitDaysMax);

  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const formattedRange = `${minDate.toLocaleDateString('en-IN', options)} – ${maxDate.toLocaleDateString('en-IN', options)}`;

  return {
    minDate,
    maxDate,
    formattedRange,
  };
}

/**
 * Validates Indian postal PIN codes (6 numeric digits, starting from 1-9).
 */
export function validateIndianPincode(pincode: string): boolean {
  return /^[1-9][0-9]{5}$/.test(pincode.trim());
}

/**
 * List of supported carriers for selection dropdowns.
 */
export const SUPPORTED_CARRIERS: Array<{ id: CarrierType; name: string; estimatedDays: string }> = [
  { id: 'DELHIVERY', name: 'Delhivery Surface / Express', estimatedDays: '3–5 days' },
  { id: 'SHIPROCKET', name: 'Shiprocket Aggregator', estimatedDays: '3–6 days' },
  { id: 'INDIA_POST', name: 'India Post Speed Post', estimatedDays: '4–7 days' },
  { id: 'MANUAL', name: 'Studio Direct / Local Courier', estimatedDays: '1–2 days' },
];

export interface ShippingRules {
  freeShippingThresholdPaise: number; // e.g. 120000 = ₹1,200
  standardShippingFeePaise: number; // e.g. 6900 = ₹69
  expressShippingFeePaise: number; // e.g. 4900 = ₹49 extra
}

export const DEFAULT_SHIPPING_RULES: ShippingRules = {
  freeShippingThresholdPaise: 120000,
  standardShippingFeePaise: 6900,
  expressShippingFeePaise: 4900,
};

/**
 * Calculates delivery fee based on cart subtotal and active rules.
 */
export function calculateShippingFee(
  subtotalInPaise: number,
  isExpress: boolean = false,
  customRules?: Partial<ShippingRules>
): { shippingFeeInPaise: number; isFreeShipping: boolean } {
  const rules = { ...DEFAULT_SHIPPING_RULES, ...customRules };
  const isFree = subtotalInPaise >= rules.freeShippingThresholdPaise;
  let fee = isFree ? 0 : rules.standardShippingFeePaise;
  if (isExpress) {
    fee += rules.expressShippingFeePaise;
  }
  return {
    shippingFeeInPaise: fee,
    isFreeShipping: isFree,
  };
}

