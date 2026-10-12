import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { Product } from '@/data/products';
import { formatPrice } from '@/data/products';
import { cartEnquiryMessage, buildWhatsAppLink } from '@/utils/whatsapp';
import { useNotification } from '@/context/NotificationContext';
import { addOns } from '@/data/site';
import { launchCashfreeCheckout } from '@/lib/cashfree';

export interface AppliedCoupon {
  code: string;
  discountInRupees: number;
  discountPercent?: number;
  discountType?: 'PERCENT' | 'FLAT';
  description?: string;
  eligibleProductCodes?: string[];
  eligibleItemsCount?: number;
  eligibleSubtotalInRupees?: number;
  qualificationStatus?: 'FULLY_QUALIFIED' | 'PARTIALLY_QUALIFIED' | 'DISQUALIFIED';
}

export interface CartItem {
  id: string;
  code: string;
  name: string;
  image?: string;
  price: number;
  basePrice?: number;
  packagingFee?: number;
  packagingMultiplier?: 'per_unit' | 'flat';
  cardFee?: number;
  noteFee?: number;
  unitPrice?: number;
  priceLabel?: string;
  quantity: number;
  color?: string;
  giftWrap?: boolean;
  message?: string;
  packagingTier?: 'standard' | 'luxury_wrap' | 'bouquet_wrap' | 'gift_box';
  packagingLabel?: string;
  hasGreetingCard?: boolean;
  greetingCardMessage?: string;
  hasPersonalNote?: boolean;
  personalNoteMessage?: string;
}

export interface AddItemOptions {
  color?: string;
  quantity?: number;
  giftWrap?: boolean;
  message?: string;
  packagingTier?: 'standard' | 'luxury_wrap' | 'bouquet_wrap' | 'gift_box';
  packagingLabel?: string;
  hasGreetingCard?: boolean;
  greetingCardMessage?: string;
  hasPersonalNote?: boolean;
  personalNoteMessage?: string;
  basePrice?: number;
  packagingFee?: number;
  packagingMultiplier?: 'per_unit' | 'flat';
  cardFee?: number;
  noteFee?: number;
  unitPrice?: number;
}

export interface CheckoutCustomerInput {
  name: string;
  phone: string;
  email?: string;
  customerId?: string;
}

export interface CheckoutAddressInput {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
}

/**
 * Deterministic fingerprint of an item configuration.
 * Differentiates variations (colors, packaging tiers, custom notes)
 * so upgrading or adding custom notes never overrides or collides with base items.
 */
export function getItemConfigKey(item: {
  code: string;
  color?: string;
  packagingTier?: string;
  hasGreetingCard?: boolean;
  greetingCardMessage?: string;
  hasPersonalNote?: boolean;
  personalNoteMessage?: string;
}): string {
  const code = (item.code || '').trim().toUpperCase();
  const color = (item.color || 'default').trim().toLowerCase();
  const tier = (item.packagingTier || 'standard').trim().toLowerCase();
  const card = item.hasGreetingCard ? (item.greetingCardMessage || '').trim() : '';
  const note = item.hasPersonalNote ? (item.personalNoteMessage || '').trim() : '';
  return `${code}::${color}::${tier}::${card}::${note}`;
}

/**
 * Calculates the exact line-item subtotal accounting for unit base price,
 * packaging multipliers (per-unit for bouquet silk wraps vs flat for stem assembly/boxes),
 * and flat keepsake cards/notes.
 */
export function calculateItemSubtotal(item: CartItem): number {
  const qty = Math.max(1, item.quantity || 1);
  const base = typeof item.basePrice === 'number' ? item.basePrice : item.price;
  const pkgFee = item.packagingFee ?? 0;
  const isPerUnit = item.packagingMultiplier === 'per_unit' || item.packagingTier === 'luxury_wrap';
  const cardFee = item.cardFee ?? (item.hasGreetingCard ? 49 : 0);
  const noteFee = item.noteFee ?? (item.hasPersonalNote ? 39 : 0);

  const packagingTotal = isPerUnit ? pkgFee * qty : pkgFee;
  const flatExtras = cardFee + noteFee;

  return (base * qty) + packagingTotal + flatExtras;
}

interface CartContextValue {
  items: CartItem[];
  isOpen: boolean;
  addItem: (product: Product, opts?: AddItemOptions) => void;
  removeItem: (idOrCode: string) => void;
  updateQuantity: (idOrCode: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  totalItems: number;
  totalPrice: number;
  appliedCoupon: AppliedCoupon | null;
  discountAmount: number;
  applyCoupon: (code: string, customerPhone?: string) => Promise<{ success: boolean; message: string }>;
  removeCoupon: () => void;
  initiateCheckout: (orderData: {
    customer: CheckoutCustomerInput;
    shippingAddress: CheckoutAddressInput;
    customerNote?: string;
    redeemPoints?: number;
    isExpress?: boolean;
  }) => Promise<{ success: boolean; message?: string; orderNumber?: string }>;
  checkoutWhatsApp: (details: { name: string; pinCode: string; shipping: number }) => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);
const CART_STORAGE_KEY = 'tpb-cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (!stored) return [];
      const parsed: any[] = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item, index) => {
        const id = item.id || `legacy-${item.code || 'item'}-${index}-${Date.now().toString(36)}`;
        const price = typeof item.price === 'number' ? item.price : 0;
        return {
          ...item,
          id,
          price,
          basePrice: typeof item.basePrice === 'number' ? item.basePrice : price,
          packagingFee: typeof item.packagingFee === 'number' ? item.packagingFee : 0,
          cardFee: typeof item.cardFee === 'number' ? item.cardFee : 0,
          noteFee: typeof item.noteFee === 'number' ? item.noteFee : 0,
          packagingTier: item.packagingTier || 'standard',
          quantity: Math.max(1, item.quantity || 1),
        };
      });
    } catch {
      return [];
    }
  });
  const [isOpen, setIsOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const { showNotification } = useNotification();

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage failures
    }
  }, [items]);

  const addItem = useCallback(
    (product: Product, opts?: AddItemOptions) => {
      const quantity = opts?.quantity ?? 1;
      const targetPackagingTier = opts?.packagingTier || 'standard';
      const isPerUnitPackaging = opts?.packagingMultiplier === 'per_unit' || targetPackagingTier === 'luxury_wrap';
      const basePrice = typeof opts?.basePrice === 'number' ? opts.basePrice : product.price;
      const packagingFee = typeof opts?.packagingFee === 'number' ? opts.packagingFee : 0;
      const cardFee = typeof opts?.cardFee === 'number' ? opts.cardFee : (opts?.hasGreetingCard ? 49 : 0);
      const noteFee = typeof opts?.noteFee === 'number' ? opts.noteFee : (opts?.hasPersonalNote ? 39 : 0);
      const unitPrice = typeof opts?.unitPrice === 'number'
        ? opts.unitPrice
        : (isPerUnitPackaging ? basePrice + packagingFee : basePrice);
      const price = isPerUnitPackaging ? (basePrice + packagingFee) : (basePrice + packagingFee + cardFee + noteFee);

      const targetColor = opts?.color || '';
      const targetGreeting = opts?.hasGreetingCard ? (opts?.greetingCardMessage || '') : '';
      const targetPersonalNote = opts?.hasPersonalNote ? (opts?.personalNoteMessage || '') : '';

      const incomingKey = getItemConfigKey({
        code: product.code,
        color: targetColor,
        packagingTier: targetPackagingTier,
        hasGreetingCard: opts?.hasGreetingCard,
        greetingCardMessage: targetGreeting,
        hasPersonalNote: opts?.hasPersonalNote,
        personalNoteMessage: targetPersonalNote,
      });

      setItems((prev) => {
        const existingIndex = prev.findIndex((i) => getItemConfigKey(i) === incomingKey);

        if (existingIndex !== -1) {
          return prev.map((item, idx) =>
            idx === existingIndex
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        }

        const uniqueId = `item-${product.code}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

        const newItem: CartItem = {
          id: uniqueId,
          code: product.code,
          name: product.name,
          image: product.images?.[0],
          basePrice,
          packagingFee,
          packagingMultiplier: isPerUnitPackaging ? 'per_unit' : 'flat',
          cardFee,
          noteFee,
          unitPrice,
          price,
          priceLabel: product.priceLabel,
          quantity,
          color: opts?.color,
          giftWrap: opts?.giftWrap,
          message: opts?.message,
          packagingTier: targetPackagingTier,
          packagingLabel: opts?.packagingLabel,
          hasGreetingCard: opts?.hasGreetingCard,
          greetingCardMessage: opts?.greetingCardMessage,
          hasPersonalNote: opts?.hasPersonalNote,
          personalNoteMessage: opts?.personalNoteMessage,
        };

        return [...prev, newItem];
      });
      setIsOpen(true);

      // Suggest add-ons for flowers/bouquets
      if (product.category === 'flowers' || product.category === 'bouquets') {
        const suggestion = addOns[0];
        showNotification(
          `Complete your ${product.name} with a ${suggestion.name}?`,
          'info',
          'Add Greeting Card',
          () => {
            const addonCode = `ADDON-${suggestion.name.toUpperCase().replace(/\s+/g, '-')}`;
            setItems((prev) => {
              const existing = prev.find((i) => i.code === addonCode);
              if (existing) {
                return prev.map((i) =>
                  i.code === addonCode ? { ...i, quantity: i.quantity + 1 } : i
                );
              }
              return [
                ...prev,
                {
                  id: `addon-${Date.now().toString(36)}`,
                  code: addonCode,
                  name: suggestion.name,
                  image: suggestion.image,
                  price: suggestion.price,
                  basePrice: suggestion.price,
                  packagingFee: 0,
                  cardFee: 0,
                  noteFee: 0,
                  unitPrice: suggestion.price,
                  quantity: 1,
                },
              ];
            });
            showNotification(`Added ${suggestion.name} to your bag!`, 'success');
          }
        );
      }
    },
    [showNotification]
  );

  const removeItem = useCallback((idOrCode: string) => {
    setItems((prev) => {
      const hasIdMatch = prev.some((i) => i.id === idOrCode);
      if (hasIdMatch) {
        return prev.filter((i) => i.id !== idOrCode);
      }
      return prev.filter((i) => i.code !== idOrCode);
    });
  }, []);

  const updateQuantity = useCallback((idOrCode: string, quantity: number) => {
    setItems((prev) => {
      const hasIdMatch = prev.some((i) => i.id === idOrCode);
      if (quantity <= 0) {
        return hasIdMatch ? prev.filter((i) => i.id !== idOrCode) : prev.filter((i) => i.code !== idOrCode);
      }
      return prev.map((i) =>
        (hasIdMatch ? i.id === idOrCode : i.code === idOrCode) ? { ...i, quantity } : i
      );
    });
  }, []);

  const clearCart = useCallback(() => setItems([]), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + calculateItemSubtotal(i), 0);
  const discountAmount = appliedCoupon ? appliedCoupon.discountInRupees : 0;

  // Server-side coupon validation
  const applyCoupon = useCallback(
    async (code: string, customerPhone?: string) => {
      const normalizedCode = code.trim().toUpperCase();
      if (!normalizedCode) return { success: false, message: 'Enter a coupon code.' };

      try {
        const cleanPhone = customerPhone ? customerPhone.replace(/\D/g, '').slice(-10) : undefined;
        const res = await fetch('/api/coupons/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: normalizedCode,
            items: items.map((i) => ({ code: i.code, quantity: i.quantity })),
            cartSubtotalInPaise: Math.round(totalPrice * 100),
            customerPhone: cleanPhone || undefined,
          }),
        });

        const data = await res.json();
        if (!data.success) {
          return { success: false, message: data.message || 'That coupon is not valid.' };
        }

        setAppliedCoupon({
          code: data.code,
          discountInRupees: data.discountInRupees,
          discountPercent: data.discountType === 'PERCENT' ? data.discountValue : undefined,
          discountType: data.discountType,
          description: data.description,
          eligibleProductCodes: data.eligibleProductCodes || [],
          eligibleItemsCount: data.eligibleItemsCount || 0,
          eligibleSubtotalInRupees: data.eligibleSubtotalInPaise ? data.eligibleSubtotalInPaise / 100 : undefined,
          qualificationStatus: data.qualificationStatus,
        });

        const countNote = data.eligibleItemsCount ? ` on ${data.eligibleItemsCount} eligible items` : '';
        return {
          success: true,
          message: `Coupon ${data.code} applied! (-₹${data.discountInRupees}${countNote})`,
        };
      } catch (err: any) {
        return { success: false, message: 'Could not validate coupon.' };
      }
    },
    [items, totalPrice]
  );

  const removeCoupon = useCallback(() => setAppliedCoupon(null), []);

  // Auto-revalidate applied coupon when cart items mutate (item removal, quantity changes)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!appliedCoupon) return;
    if (items.length === 0) {
      setAppliedCoupon(null);
      return;
    }

    let isMounted = true;
    const revalidate = async () => {
      try {
        const res = await fetch('/api/coupons/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: appliedCoupon.code,
            items: items.map((i) => ({ code: i.code, quantity: i.quantity })),
            cartSubtotalInPaise: Math.round(totalPrice * 100),
          }),
        });

        const data = await res.json();
        if (!isMounted) return;

        if (!data.success) {
          setAppliedCoupon(null);
          showNotification(
            `Coupon ${appliedCoupon.code} was removed: ${data.message || 'Cart no longer meets promotion criteria.'}`,
            'warning'
          );
        } else {
          setAppliedCoupon({
            code: data.code,
            discountInRupees: data.discountInRupees,
            discountPercent: data.discountType === 'PERCENT' ? data.discountValue : undefined,
            discountType: data.discountType,
            description: data.description,
            eligibleProductCodes: data.eligibleProductCodes || [],
            eligibleItemsCount: data.eligibleItemsCount || 0,
            eligibleSubtotalInRupees: data.eligibleSubtotalInPaise ? data.eligibleSubtotalInPaise / 100 : undefined,
            qualificationStatus: data.qualificationStatus,
          });
        }
      } catch (err) {
        // Silently preserve on transient network error
      }
    };

    revalidate();

    return () => {
      isMounted = false;
    };
  }, [items, totalPrice, showNotification]);

  // Initiate real Cashfree checkout
  const initiateCheckout = useCallback(
    async (orderData: {
      customer: CheckoutCustomerInput;
      shippingAddress: CheckoutAddressInput;
      customerNote?: string;
      redeemPoints?: number;
      isExpress?: boolean;
    }) => {
      try {
        const res = await fetch('/api/checkout/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: items.map((i) => ({
              code: i.code,
              name: i.name,
              price: i.price,
              image: i.image,
              quantity: i.quantity,
              color: i.color,
              giftWrap: i.giftWrap,
              message: i.message,
              packagingTier: i.packagingTier,
              packagingLabel: i.packagingLabel,
              hasGreetingCard: i.hasGreetingCard,
              greetingCardMessage: i.greetingCardMessage,
              hasPersonalNote: i.hasPersonalNote,
              personalNoteMessage: i.personalNoteMessage,
            })),
            customer: orderData.customer,
            shippingAddress: orderData.shippingAddress,
            couponCode: appliedCoupon?.code,
            redeemPoints: orderData.redeemPoints,
            customerNote: orderData.customerNote,
            isExpress: orderData.isExpress,
          }),
        });

        const result = await res.json();
        if (!result.success) {
          throw new Error(result.message || 'Failed to initialize order');
        }

        // Close cart and clear items before launch
        clearCart();
        removeCoupon();
        closeCart();

        // If Manual UPI / WhatsApp settlement, redirect straight to confirmation page
        if (result.paymentMethod === 'MANUAL_UPI' || !result.paymentSessionId) {
          window.location.href = `/order-confirmation?order_id=${encodeURIComponent(result.orderNumber)}`;
          return { success: true, orderNumber: result.orderNumber };
        }

        // Launch Cashfree PG checkout
        await launchCashfreeCheckout({
          paymentSessionId: result.paymentSessionId,
          orderNumber: result.orderNumber,
          isSimulated: result.isSimulated,
        });

        return { success: true, orderNumber: result.orderNumber };
      } catch (err: any) {
        console.error('[Checkout Error]', err);
        return { success: false, message: err.message || 'Checkout failed' };
      }
    },
    [items, appliedCoupon, clearCart, removeCoupon, closeCart]
  );

  const checkoutWhatsApp = useCallback(
    (details: { name: string; pinCode: string; shipping: number }) => {
      const messageItems = items.map((i) => ({
        name: i.name,
        code: i.code,
        price: i.priceLabel || formatPrice(i.price),
        quantity: i.quantity,
        color: i.color,
        packaging: i.packagingLabel || (i.packagingTier === 'luxury_wrap' ? 'Luxury Silk Wrap' : i.packagingTier === 'bouquet_wrap' ? 'Finished Bouquet Wrap' : i.packagingTier === 'gift_box' ? 'Luxury Rigid Gift Box' : undefined),
        message: i.greetingCardMessage ? `Card: "${i.greetingCardMessage}"` : i.personalNoteMessage ? `Personal Note: "${i.personalNoteMessage}"` : i.message,
      }));
      const link = buildWhatsAppLink(
        cartEnquiryMessage(messageItems, {
          ...details,
          subtotal: totalPrice,
          discount: discountAmount,
          total: totalPrice - discountAmount + details.shipping,
          couponCode: appliedCoupon?.code,
        })
      );
      window.open(link, '_blank');
    },
    [items, totalPrice, discountAmount, appliedCoupon]
  );

  return (
    <CartContext.Provider
      value={{
        items,
        isOpen,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        openCart,
        closeCart,
        totalItems,
        totalPrice,
        appliedCoupon,
        discountAmount,
        applyCoupon,
        removeCoupon,
        initiateCheckout,
        checkoutWhatsApp,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}
