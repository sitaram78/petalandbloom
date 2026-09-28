import { brandInfo } from '@/data/site';

const WHATSAPP_NUMBER = brandInfo.whatsappNumber || '';

export function buildWhatsAppLink(message: string): string {
  const encoded = encodeURIComponent(message);
  if (WHATSAPP_NUMBER) {
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}

export function generalEnquiryMessage(): string {
  return "Hi The Petal & Bloom! I'd like to know more about your handmade crochet blooms and gifts.";
}

export function productOrderMessage(product: { name: string; code: string; price: number; priceLabel?: string }): string {
  const price = product.priceLabel || `₹${product.price}`;
  return `Hi The Petal & Bloom! I'm interested in the ${product.name} (${product.code}), ${price}. I'd like to know the available colours and delivery timeline.`;
}

export function productEnquiryMessage(product: { name: string; code: string }): string {
  return `Hi The Petal & Bloom! I have a question about the ${product.name} (${product.code}). Can you help me?`;
}

export function customOrderMessage(): string {
  return "Hi The Petal & Bloom! I'd like to create a custom bouquet. Can you help me choose the right flowers, colours, and size?";
}

export function cartEnquiryMessage(
  items: { name: string; code: string; price: string; quantity: number }[],
  details?: { name: string; pinCode: string; subtotal: number; shipping: number; discount: number; total: number; couponCode?: string }
): string {
  const itemList = items.map((i) => `  • ${i.name} (${i.code}) — ${i.price} × ${i.quantity}`).join('\n');
  if (!details) {
    return `Hi The Petal & Bloom! I'd like to place an enquiry for the following items:\n\n${itemList}\n\nPlease confirm availability and delivery timeline.`;
  }

  const couponLine = details.couponCode ? `\nCoupon: ${details.couponCode} (-₹${details.discount})` : '';
  return `Hi The Petal & Bloom! I'd like to place an order:\n\nCustomer name: ${details.name}\nPIN code: ${details.pinCode}\n\n${itemList}${couponLine}\n\nSubtotal: ₹${details.subtotal}\nShipping: ${details.shipping === 0 ? 'Complimentary' : `₹${details.shipping}`}\nTotal: ₹${details.total}\n\nPlease confirm availability and delivery timeline.`;
}

export function giftFinderMessage(selections: { occasion: string; recipient: string; budget: string }): string {
  return `Hi The Petal & Bloom! I'm looking for a gift.\n\nOccasion: ${selections.occasion}\nFor: ${selections.recipient}\nBudget: ${selections.budget}\n\nCan you help me choose the right bloom?`;
}

export function customBouquetBuilderMessage(config: {
  size: string;
  flowers: string[];
  colors: string[];
  wrapping: string;
  message: string;
  estimatedPrice: number;
}): string {
  const parts: string[] = ["Hi The Petal & Bloom! I'd like to create a custom bouquet with the following details:"];
  parts.push(`Bouquet size: ${config.size}`);
  if (config.flowers.length) parts.push(`Flowers: ${config.flowers.join(', ')}`);
  if (config.colors.length) parts.push(`Colours: ${config.colors.join(', ')}`);
  parts.push(`Wrapping: ${config.wrapping}`);
  if (config.message) parts.push(`Message: ${config.message}`);
  parts.push(`Estimated price: ₹${config.estimatedPrice}`);
  parts.push("Please confirm availability and final pricing.");
  return parts.join('\n');
}
