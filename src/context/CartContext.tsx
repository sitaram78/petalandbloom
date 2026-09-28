import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
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
  description?: string;
}

export interface CartItem {
  code: string;
  name: string;
  image?: string;
  price: number;
  priceLabel?: string;
  quantity: number;
  color?: string;
  giftWrap?: boolean;
  message?: string;
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

interface CartContextValue {
  items: CartItem[];
  isOpen: boolean;
  addItem: (product: Product, opts?: { color?: string; quantity?: number; giftWrap?: boolean; message?: string }) => void;
  removeItem: (code: string) => void;
  updateQuantity: (code: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  totalItems: number;
  totalPrice: number;
  appliedCoupon: AppliedCoupon | null;
  discountAmount: number;
  applyCoupon: (code: string) => Promise<{ success: boolean; message: string }>;
  removeCoupon: () => void;
  initiateCheckout: (orderData: {
    customer: CheckoutCustomerInput;
    shippingAddress: CheckoutAddressInput;
    customerNote?: string;
    redeemPoints?: number;
  }) => Promise<{ success: boolean; message?: string; orderNumber?: string }>;
  checkoutWhatsApp: (details: { name: string; pinCode: string; shipping: number }) => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);
const CART_STORAGE_KEY = 'tpb-cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
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
    (product: Product, opts?: { color?: string; quantity?: number; giftWrap?: boolean; message?: string }) => {
      const quantity = opts?.quantity ?? 1;
      setItems((prev) => {
        const existing = prev.find((i) => i.code === product.code && i.color === opts?.color);
        if (existing) {
          return prev.map((i) =>
            i.code === product.code && i.color === opts?.color
              ? { ...i, quantity: i.quantity + quantity }
              : i
          );
        }
        return [
          ...prev,
          {
            code: product.code,
            name: product.name,
            image: product.images?.[0],
            price: product.price,
            priceLabel: product.priceLabel,
            quantity,
            color: opts?.color,
            giftWrap: opts?.giftWrap,
            message: opts?.message,
          },
        ];
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
                  code: addonCode,
                  name: suggestion.name,
                  image: suggestion.image,
                  price: suggestion.price,
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

  const removeItem = useCallback((code: string) => {
    setItems((prev) => prev.filter((i) => i.code !== code));
  }, []);

  const updateQuantity = useCallback((code: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.code !== code));
    } else {
      setItems((prev) => prev.map((i) => (i.code === code ? { ...i, quantity } : i)));
    }
  }, []);

  const clearCart = useCallback(() => setItems([]), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discountAmount = appliedCoupon ? appliedCoupon.discountInRupees : 0;

  // Server-side coupon validation
  const applyCoupon = useCallback(
    async (code: string) => {
      const normalizedCode = code.trim().toUpperCase();
      if (!normalizedCode) return { success: false, message: 'Enter a coupon code.' };

      try {
        const res = await fetch('/api/coupons/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: normalizedCode,
            cartSubtotalInPaise: Math.round(totalPrice * 100),
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
          description: data.description,
        });

        return {
          success: true,
          message: `Coupon ${data.code} applied! (-₹${data.discountInRupees})`,
        };
      } catch (err: any) {
        return { success: false, message: 'Could not validate coupon.' };
      }
    },
    [totalPrice]
  );

  const removeCoupon = useCallback(() => setAppliedCoupon(null), []);

  // Initiate real Cashfree checkout
  const initiateCheckout = useCallback(
    async (orderData: {
      customer: CheckoutCustomerInput;
      shippingAddress: CheckoutAddressInput;
      customerNote?: string;
      redeemPoints?: number;
    }) => {
      try {
        const res = await fetch('/api/checkout/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: items.map((i) => ({
              code: i.code,
              quantity: i.quantity,
              color: i.color,
              giftWrap: i.giftWrap,
              message: i.message,
            })),
            customer: orderData.customer,
            shippingAddress: orderData.shippingAddress,
            couponCode: appliedCoupon?.code,
            redeemPoints: orderData.redeemPoints,
            customerNote: orderData.customerNote,
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
