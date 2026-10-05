export type ProductCategory = 'flowers' | 'bouquets' | 'gifts' | 'bags' | 'decor' | 'giftboxes' | 'custom' | string;

export interface Product {
  code: string;
  name: string;
  category: ProductCategory;
  price: number;
  compareAtPrice?: number;
  priceLabel?: string;
  description: string;
  longDescription?: string;
  colors?: string[];
  preparationDays?: string;
  occasions?: string[];
  recipients?: string[];
  bestseller?: boolean;
  featured?: boolean;
  isNew?: boolean;
  madeToOrder?: boolean;
  customisable?: boolean;
  images: string[];
  bouquetSize?: string;
  whatsIncluded?: string[];
  inventoryCount?: number;
}

export function getDiscountPercent(product: Pick<Product, 'price' | 'compareAtPrice'>): number {
  if (!product.compareAtPrice || product.compareAtPrice <= product.price) return 0;
  return Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100);
}

// Live catalog is loaded dynamically from Supabase database
export const products: Product[] = [];

export function getProductByCode(code: string): Product | undefined {
  return products.find((p) => p.code === code);
}

export function getProductsByCategory(category: ProductCategory): Product[] {
  return products.filter((p) => p.category === category);
}

export function getBestsellers(): Product[] {
  return products.filter((p) => p.bestseller);
}

export function getFeatured(): Product[] {
  return products.filter((p) => p.featured);
}

export function formatPrice(price: any, options?: { showDecimals?: boolean; roundWhole?: boolean }): string {
  const numPrice = typeof price === 'number' ? price : parseFloat(price);
  if (isNaN(numPrice)) return '₹0';

  if (options?.roundWhole) {
    return `₹${Math.round(numPrice).toLocaleString('en-IN')}`;
  }

  // Format with 2 decimals if price has a fractional component, or if explicitly requested
  const hasFraction = Math.abs(numPrice % 1) > 0.001;
  const minimumFractionDigits = options?.showDecimals ? 2 : hasFraction ? 2 : 0;
  const maximumFractionDigits = hasFraction || options?.showDecimals ? 2 : 0;

  return `₹${numPrice.toLocaleString('en-IN', {
    minimumFractionDigits,
    maximumFractionDigits,
  })}`;
}
