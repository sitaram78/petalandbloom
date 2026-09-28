import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ShoppingBag, Trash2, Plus, Minus, MessageCircle, Check, Truck, Lock, Loader2, ShieldCheck, Sparkles, Gift, MapPin } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useStoreSettings } from '@/context/StoreSettingsContext';
import { supabase } from '@/lib/supabaseClient';
import { formatPrice } from '@/data/products';
import { trackEvent } from '@/utils/analytics';

interface CustomerAddress {
  id: string;
  recipient_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
}

export default function CartDrawer() {
  const navigate = useNavigate();
  const {
    items, isOpen, closeCart, removeItem, updateQuantity, totalItems, totalPrice,
    appliedCoupon, discountAmount, applyCoupon, removeCoupon, initiateCheckout, checkoutWhatsApp,
  } = useCart();
  const { settings, triggerAssistance } = useStoreSettings();

  const [justAdded, setJustAdded] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponMessage, setCouponMessage] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  // Guest discount popup state
  const [showGuestDiscountModal, setShowGuestDiscountModal] = useState(false);

  // Checkout modal form state
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [customerNote, setCustomerNote] = useState('');

  // Customer Saved Addresses State
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('new');
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [saveAddressToProfile, setSaveAddressToProfile] = useState(true);

  const { user, profile, loyalty } = useAuth();
  const [redeemPoints, setRedeemPoints] = useState(false);

  const applyAddress = (addr: CustomerAddress) => {
    setCustomerName(addr.recipient_name || profile?.full_name || '');
    setCustomerPhone(addr.phone || profile?.phone || '');
    setAddressLine1(addr.address_line1 || '');
    setAddressLine2(addr.address_line2 || '');
    setCity(addr.city || '');
    setState(addr.state || '');
    setPinCode(addr.pincode || '');
  };

  const handleSelectAddress = (addressId: string) => {
    setSelectedAddressId(addressId);
    if (addressId === 'new') {
      setCustomerName(profile?.full_name || '');
      setCustomerPhone(profile?.phone || '');
      setAddressLine1('');
      setAddressLine2('');
      setCity('');
      setState('');
      setPinCode('');
    } else {
      const found = savedAddresses.find((a) => a.id === addressId);
      if (found) {
        applyAddress(found);
      }
    }
  };

  const fetchSavedAddresses = async () => {
    if (!user) return;
    setLoadingAddresses(true);
    try {
      const { data, error } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('customer_id', user.id)
        .order('is_default', { ascending: false });

      if (!error && data && data.length > 0) {
        const addressList = data as CustomerAddress[];
        setSavedAddresses(addressList);
        const defaultAddr = addressList.find((a) => a.is_default) || addressList[0];
        setSelectedAddressId(defaultAddr.id);
        applyAddress(defaultAddr);
      } else {
        setSavedAddresses([]);
        setSelectedAddressId('new');
      }
    } catch (err) {
      console.warn('Failed to load saved addresses:', err);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const saveAddressIfNew = async (cleanPhone: string, cleanPin: string) => {
    if (!user || !saveAddressToProfile || !addressLine1.trim() || !city.trim() || !state.trim()) return;
    try {
      const isFirstAddress = savedAddresses.length === 0;
      const alreadyExists = savedAddresses.some(
        (a) =>
          a.address_line1.trim().toLowerCase() === addressLine1.trim().toLowerCase() &&
          a.pincode.replace(/\D/g, '') === cleanPin
      );

      if (!alreadyExists) {
        const { data: newAddr } = await supabase
          .from('customer_addresses')
          .insert({
            customer_id: user.id,
            recipient_name: customerName.trim(),
            phone: cleanPhone,
            address_line1: addressLine1.trim(),
            address_line2: addressLine2.trim() || null,
            city: city.trim(),
            state: state.trim(),
            pincode: cleanPin,
            is_default: isFirstAddress,
          })
          .select()
          .maybeSingle();

        if (newAddr) {
          setSavedAddresses((prev) => [newAddr as CustomerAddress, ...prev]);
        }
      }
    } catch (err) {
      console.warn('Auto-save address error:', err);
    }
  };

  useEffect(() => {
    if (user && isCheckoutOpen) {
      fetchSavedAddresses();
    }
  }, [user, isCheckoutOpen]);

  useEffect(() => {
    if (profile) {
      if (!customerName && profile.full_name) setCustomerName(profile.full_name);
      if (!customerPhone && profile.phone) setCustomerPhone(profile.phone);
      if (!customerEmail && profile.email) setCustomerEmail(profile.email);
    }
  }, [profile]);

  useEffect(() => {
    if (isOpen && totalItems > 0) {
      setJustAdded(true);
      const timer = setTimeout(() => setJustAdded(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, totalItems]);

  const giftWrapTotal = items.reduce((sum, i) => sum + (i.giftWrap ? 79 * i.quantity : 0), 0);
  const baseShippingCost = totalPrice >= 1200 ? 0 : totalPrice >= 799 ? 49 : 69;
  const shippingCost = baseShippingCost;

  // Decision 1: 1 Petal Point = ₹0.50 (2 pts = ₹1), redeemable ONLY on orders > ₹299
  const isPointsEligible = totalPrice >= 299;
  const pointsBalance = loyalty?.points_balance || 0;
  const maxDiscountAmount = Math.max(0, totalPrice - discountAmount);
  const maxPointsRedeemable = Math.min(pointsBalance, Math.floor(maxDiscountAmount * 2));
  const pointsToRedeem = isPointsEligible && redeemPoints ? maxPointsRedeemable : 0;
  const loyaltyDiscount = pointsToRedeem * 0.5;
  const grandTotal = Math.max(0, totalPrice - discountAmount - loyaltyDiscount + shippingCost + giftWrapTotal);

  const openCheckout = () => {
    setCheckoutMessage('');
    if (!user) {
      setShowGuestDiscountModal(true);
      return;
    }
    setIsCheckoutOpen(true);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsApplyingCoupon(true);
    setCouponMessage('');
    const result = await applyCoupon(couponCode);
    setCouponMessage(result.message);
    if (result.success) setCouponCode('');
    setIsApplyingCoupon(false);
  };

  const handleOnlineCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutMessage('');

    if (!customerName.trim()) {
      setCheckoutMessage('Please enter your full name.');
      return;
    }
    const cleanPhone = customerPhone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      setCheckoutMessage('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!addressLine1.trim() || !city.trim() || !state.trim()) {
      setCheckoutMessage('Please complete your delivery address.');
      return;
    }
    const cleanPin = pinCode.replace(/\D/g, '');
    if (cleanPin.length !== 6) {
      setCheckoutMessage('Please enter a valid 6-digit PIN code.');
      return;
    }

    setIsSubmitting(true);
    trackEvent('checkout_started', { total: grandTotal, items: totalItems });

    // Auto-save address to user profile if new
    await saveAddressIfNew(cleanPhone, cleanPin);

    const result = await initiateCheckout({
      customer: {
        name: customerName.trim(),
        phone: cleanPhone,
        email: customerEmail.trim() || undefined,
        customerId: user?.id,
      },
      shippingAddress: {
        recipientName: customerName.trim(),
        phone: cleanPhone,
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim(),
        state: state.trim(),
        pincode: cleanPin,
      },
      redeemPoints: pointsToRedeem > 0 ? pointsToRedeem : undefined,
      customerNote: customerNote.trim() || undefined,
    });

    if (!result.success) {
      setCheckoutMessage(result.message || 'Payment initiation failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleWhatsAppCheckout = () => {
    if (!customerName.trim() || pinCode.length !== 6) {
      setCheckoutMessage('Please enter your name and 6-digit PIN code.');
      return;
    }
    trackEvent('checkout_started', { total: grandTotal, items: totalItems });

    const cleanPhone = customerPhone.replace(/\D/g, '').slice(-10);
    const cleanPin = pinCode.replace(/\D/g, '');
    saveAddressIfNew(cleanPhone, cleanPin);

    checkoutWhatsApp({
      name: customerName.trim(),
      pinCode: pinCode.trim(),
      shipping: shippingCost + giftWrapTotal,
    });
    setIsCheckoutOpen(false);
    closeCart();
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={closeCart} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md glass-panel shadow-2xl animate-slide-in flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 h-20 border-b border-silk">
              <div className="flex items-center gap-3">
                <ShoppingBag size={20} strokeWidth={1.5} className="text-ink-light" />
                <span className="font-serif text-xl font-medium text-ink">Your Collection</span>
                {totalItems > 0 && <span className="text-xs text-ink-light opacity-60">({totalItems})</span>}
              </div>
              <button onClick={closeCart} className="text-ink-light hover:text-ink transition-colors" aria-label="Close cart">
                <X size={24} strokeWidth={1.5} />
              </button>
            </div>

            {/* Added confirmation */}
            {justAdded && (
              <div className="px-5 py-3 bg-sage-light border-b border-sage-dark/10 flex items-center gap-2 animate-fade-in">
                <div className="w-6 h-6 rounded-full bg-sage flex items-center justify-center">
                  <Check size={14} className="text-parchment-50" strokeWidth={2.5} />
                </div>
                <p className="text-sm text-sage-dark font-medium">Added to your collection</p>
              </div>
            )}

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <ShoppingBag size={48} strokeWidth={1} className="text-silk mb-4" />
                  <p className="font-serif text-xl text-ink mb-2">Your collection is empty</p>
                  <p className="text-sm text-ink-light max-w-xs">
                    Begin your journey by selecting a bloom or designing a custom arrangement.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.code + (item.color || '')} className="flex gap-4 pb-6 border-b border-silk/50">
                      <div className="w-16 h-20 flex-shrink-0 overflow-hidden rounded-sm bg-silk/30">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-ink-light/50">No image</div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-serif text-lg text-ink">{item.name}</h4>
                        <p className="text-[10px] uppercase tracking-wider text-ink-light/50 mt-0.5">{item.code}</p>
                        {item.color && <p className="text-xs text-ink-light mt-1">Colour: <span className="text-ink font-medium">{item.color}</span></p>}
                        {item.giftWrap && <p className="text-xs text-sage-dark mt-1">Gift wrapping included (+₹79)</p>}
                        {item.message && <p className="text-xs text-ink-light mt-1">Message: <span className="italic">"{item.message}"</span></p>}
                        <p className="text-sm font-medium text-rose mt-2">
                          {item.priceLabel || formatPrice(item.price)}
                        </p>
                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center border border-silk bg-parchment-50 rounded-sm">
                            <button
                              onClick={() => updateQuantity(item.code, item.quantity - 1)}
                              className="px-2 py-1 text-ink-light hover:text-ink transition-colors"
                              aria-label="Decrease quantity"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="px-2 text-sm text-ink min-w-[24px] text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.code, item.quantity + 1)}
                              className="px-2 py-1 text-ink-light hover:text-ink transition-colors"
                              aria-label="Increase quantity"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <button
                            onClick={() => removeItem(item.code)}
                            className="text-ink-light hover:text-rose transition-colors"
                            aria-label="Remove item"
                          >
                            <Trash2 size={16} strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer with totals & action */}
            {items.length > 0 && (
              <div className="border-t border-silk px-5 py-4 space-y-3">
                {/* Coupon Input */}
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <input
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Coupon code"
                      className="input-field flex-1 text-sm py-2"
                      aria-label="Coupon code"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={isApplyingCoupon}
                      className="btn-secondary px-3 text-xs"
                    >
                      {isApplyingCoupon ? 'Checking...' : 'Apply'}
                    </button>
                  </div>
                  {couponMessage && <p className="text-xs text-rose">{couponMessage}</p>}
                  {appliedCoupon && (
                    <div className="flex justify-between text-xs text-sage-dark bg-sage/10 p-2 rounded-sm">
                      <span>{appliedCoupon.code} applied (-₹{appliedCoupon.discountInRupees})</span>
                      <button type="button" onClick={removeCoupon} className="underline hover:text-rose">Remove</button>
                    </div>
                  )}

                  {/* Pricing Breakdown */}
                  <div className="flex justify-between pt-2">
                    <span className="text-ink-light">Subtotal</span>
                    <span className="text-ink">{formatPrice(totalPrice)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sage-dark">
                      <span>Discount</span>
                      <span>-{formatPrice(discountAmount)}</span>
                    </div>
                  )}
                  {giftWrapTotal > 0 && (
                    <div className="flex justify-between text-ink-light">
                      <span>Gift Wrapping</span>
                      <span>{formatPrice(giftWrapTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-ink-light flex items-center gap-1">
                      <Truck size={12} strokeWidth={1.5} /> Shipping
                    </span>
                    <span className={shippingCost === 0 ? 'text-sage-dark font-medium' : 'text-ink'}>
                      {shippingCost === 0 ? 'COMPLIMENTARY' : formatPrice(shippingCost)}
                    </span>
                  </div>

                  {shippingCost > 0 && (
                    <p className="text-[11px] text-ink-light/60">
                      {totalPrice >= 799 && totalPrice < 1200
                        ? `Add ₹${1200 - totalPrice} more for complimentary shipping`
                        : totalPrice < 799
                        ? `Add ₹${799 - totalPrice} more for reduced shipping`
                        : ''}
                    </p>
                  )}
                  <div className="flex justify-between pt-3 border-t border-silk">
                    <span className="text-sm font-medium text-ink">Estimated Total</span>
                    <span className="font-serif text-2xl text-ink">{formatPrice(grandTotal)}</span>
                  </div>
                </div>

                {/* Primary Checkout CTA */}
                <button
                  onClick={openCheckout}
                  className="btn-primary w-full py-4 text-sm flex items-center justify-center gap-2 shadow-soft"
                >
                  <Lock size={16} /> Proceed to Checkout
                </button>

                {/* Secondary concierge assistance button */}
                <button
                  type="button"
                  onClick={() => {
                    closeCart();
                    triggerAssistance(
                      `Hi The Petal & Bloom Atelier, I have items in my bag and would like some assistance before placing my order.`
                    );
                  }}
                  className={`w-full py-2.5 text-xs flex items-center justify-center gap-2 rounded-atelier-btn transition-all duration-300 cursor-pointer ${
                    settings.conciergeChannelMode === 'IN_SYSTEM'
                      ? 'bg-rose text-linen hover:bg-rose-deep shadow-soft'
                      : 'btn-whatsapp opacity-90 hover:opacity-100'
                  }`}
                >
                  <MessageCircle size={15} />
                  {settings.conciergeChannelMode === 'IN_SYSTEM'
                    ? 'Ask Studio Concierge'
                    : 'Order via WhatsApp Concierge'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Guest Discount Interception Modal */}
      {showGuestDiscountModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowGuestDiscountModal(false)}
          />
          <div
            className="relative z-10 w-full max-w-md bg-linen rounded-atelier-panel shadow-2xl border border-canvas-line p-6 sm:p-8 animate-fade-up"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guest-discount-title"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose/15 text-rose text-xs font-serif italic tracking-wide rounded-full font-medium">
                <Sparkles size={13} className="text-rose" /> Atelier Welcome Gift
              </span>
              <button
                type="button"
                onClick={() => setShowGuestDiscountModal(false)}
                className="text-ink-light hover:text-ink transition-colors p-1"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <h2 id="guest-discount-title" className="font-serif text-3xl text-bark leading-tight mb-2">
              Save ₹20 on orders above ₹299
            </h2>
            <p className="text-sm text-ink-light font-light leading-relaxed mb-6">
              Create your account or sign in to instantly unlock a <strong className="text-bark font-medium">40 Petal Points welcome bonus (₹20 off)</strong> and apply it immediately to your checkout.
            </p>

            <div className="bg-canvas/50 border border-canvas-line rounded-atelier-card p-4 space-y-3 mb-6">
              <div className="flex items-start gap-3 text-xs text-ink-light">
                <div className="w-5 h-5 rounded-full bg-rose/20 text-rose flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  ✓
                </div>
                <span><strong className="text-bark font-medium">Instant ₹20 Off:</strong> 40 welcome points credited immediately to redeem on orders above ₹299.</span>
              </div>
              <div className="flex items-start gap-3 text-xs text-ink-light">
                <div className="w-5 h-5 rounded-full bg-rose/20 text-rose flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  ✓
                </div>
                <span><strong className="text-bark font-medium">Artisan Journey Tracking:</strong> Follow your blooms as they are crafted and wrapped in the studio.</span>
              </div>
              <div className="flex items-start gap-3 text-xs text-ink-light">
                <div className="w-5 h-5 rounded-full bg-rose/20 text-rose flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  ✓
                </div>
                <span><strong className="text-bark font-medium">Atelier Rewards:</strong> Earn 1 point for every ₹20 spent on all future gifting.</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setShowGuestDiscountModal(false);
                  closeCart();
                  navigate('/account', { state: { returnToCheckout: true } });
                }}
                className="btn-primary w-full py-4 text-sm flex items-center justify-center gap-2 shadow-soft"
              >
                <Sparkles size={16} /> Sign In or Create Account (Save ₹50)
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowGuestDiscountModal(false);
                  setIsCheckoutOpen(true);
                }}
                className="w-full text-xs text-ink-light hover:text-ink transition-colors py-2 text-center underline underline-offset-4"
              >
                Continue as Guest without ₹50 off
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Drawer / Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
            onClick={() => !isSubmitting && setIsCheckoutOpen(false)}
            aria-label="Close checkout details"
          />
          <div
            className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-linen p-6 sm:p-8 rounded-atelier-panel shadow-2xl border border-canvas-line"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-details-title"
          >
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-rose mb-1">Prepaid Checkout</p>
                <h2 id="checkout-details-title" className="font-serif text-3xl text-bark">Delivery Details</h2>
                <p className="text-xs text-ink-light mt-1">Please provide your destination address in India.</p>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsCheckoutOpen(false)}
                className="text-ink-light hover:text-ink p-1"
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </div>

            {!user && (
              <div className="mb-5 p-3.5 bg-rose/10 border border-rose/25 rounded-atelier-card flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs text-bark font-light">
                  <Sparkles size={16} className="text-rose shrink-0" />
                  <span>Want <strong>₹50 off</strong> this order? Sign in to claim your welcome bonus.</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsCheckoutOpen(false);
                    closeCart();
                    navigate('/account', { state: { returnToCheckout: true } });
                  }}
                  className="text-xs font-semibold text-rose hover:text-rose-deep underline shrink-0 whitespace-nowrap"
                >
                  Claim ₹50
                </button>
              </div>
            )}

            <form onSubmit={handleOnlineCheckout} className="space-y-4">
              {/* Saved Address Selector for Logged-In Customers */}
              {user && savedAddresses.length > 0 && (
                <div className="p-3.5 bg-canvas/30 rounded-sm border border-canvas-line space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-bark flex items-center gap-1.5">
                      <MapPin size={13} className="text-rose" />
                      Delivery Destination ({savedAddresses.length} Saved)
                    </span>
                    {selectedAddressId !== 'new' && (
                      <button
                        type="button"
                        onClick={() => handleSelectAddress('new')}
                        className="text-[11px] text-rose hover:text-rose-deep font-medium flex items-center gap-1"
                      >
                        <Plus size={12} />
                        Enter New Address
                      </button>
                    )}
                  </div>

                  {/* Address Selection Pills / Cards */}
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {savedAddresses.map((addr) => {
                      const isSelected = selectedAddressId === addr.id;
                      return (
                        <div
                          key={addr.id}
                          onClick={() => handleSelectAddress(addr.id)}
                          className={`p-2.5 rounded-sm border cursor-pointer transition-all text-xs flex items-start justify-between gap-2.5 ${
                            isSelected
                              ? 'border-bark bg-linen shadow-xs ring-1 ring-bark'
                              : 'border-canvas-line bg-linen/70 hover:border-canvas-line-hover opacity-80'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-bark truncate">{addr.recipient_name}</span>
                              {addr.is_default && (
                                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-rose/10 text-rose-deep border border-rose/20">
                                  Default
                                </span>
                              )}
                              <span className="text-[11px] text-ink-light truncate">· +91 {addr.phone}</span>
                            </div>
                            <p className="text-[11px] text-ink-light truncate mt-0.5">
                              {addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ''}
                            </p>
                            <p className="text-[11px] text-ink-light font-mono">
                              {addr.city}, {addr.state} — {addr.pincode}
                            </p>
                          </div>

                          <div className="shrink-0 mt-0.5">
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                isSelected ? 'border-bark bg-bark text-linen' : 'border-canvas-line'
                              }`}
                            >
                              {isSelected && <Check size={10} strokeWidth={3} />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedAddressId === 'new' && (
                    <div className="p-2 bg-rose/10 border border-rose/20 rounded-sm flex items-center justify-between text-[11px] text-rose-deep">
                      <span>Entering a new delivery address below:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const def = savedAddresses.find((a) => a.is_default) || savedAddresses[0];
                          if (def) handleSelectAddress(def.id);
                        }}
                        className="underline font-semibold hover:text-bark"
                      >
                        Back to Saved Address
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-ink font-semibold mb-1">
                    Your Name *
                  </label>
                  <input
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Amrita Rao"
                    className="input-field text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-ink font-semibold mb-1">
                    Mobile Number *
                  </label>
                  <input
                    required
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile"
                    className="input-field text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-ink font-semibold mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="For receipt & tracking updates"
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-ink font-semibold mb-1">
                  House / Flat / Street Address *
                </label>
                <input
                  required
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="Flat 402, Lotus Residency, MG Road"
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-ink font-semibold mb-1">
                  Landmark / Area (Optional)
                </label>
                <input
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="Near Botanical Garden"
                  className="input-field text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-ink font-semibold mb-1">
                    City *
                  </label>
                  <input
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Bengaluru"
                    className="input-field text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-ink font-semibold mb-1">
                    State *
                  </label>
                  <input
                    required
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="Karnataka"
                    className="input-field text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-ink font-semibold mb-1">
                    PIN *
                  </label>
                  <input
                    required
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="560001"
                    className="input-field text-sm"
                  />
                </div>
              </div>

              {/* Auto-save to Profile Option for Logged-In Customers */}
              {user && (
                <label className="flex items-center gap-2 text-xs text-ink cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={saveAddressToProfile}
                    onChange={(e) => setSaveAddressToProfile(e.target.checked)}
                    className="accent-rose rounded cursor-pointer"
                  />
                  <span>Save this delivery address to my Atelier profile for future orders</span>
                </label>
              )}

              <div>
                <label className="block text-xs uppercase tracking-wider text-ink font-semibold mb-1">
                  Special Note or Gift Message
                </label>
                <input
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="Special instructions for the studio"
                  className="input-field text-sm"
                />
              </div>

              {/* Loyalty Points Redemption (if logged-in customer has points) */}
              {user && pointsBalance > 0 && (
                <div className="p-3 bg-parchment-50 border border-canvas-line rounded-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Sparkles size={16} className="text-rose shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-bark">
                          Redeem Atelier Points
                        </p>
                        <p className="text-[11px] text-ink-light">
                          {isPointsEligible
                            ? `Available: ${pointsBalance} pts (Save up to ₹${Math.floor(maxPointsRedeemable * 0.5)} · 2 pts = ₹1)`
                            : `Available: ${pointsBalance} pts (Redeemable on orders above ₹299)`}
                        </p>
                      </div>
                    </div>
                    {isPointsEligible ? (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={redeemPoints}
                          onChange={(e) => setRedeemPoints(e.target.checked)}
                          className="accent-rose w-4 h-4 rounded cursor-pointer"
                        />
                        <span className="text-xs font-semibold text-bark">
                          {redeemPoints ? 'Applied' : 'Redeem'}
                        </span>
                      </label>
                    ) : (
                      <span className="text-[11px] text-rose font-medium">Min ₹299 order</span>
                    )}
                  </div>
                </div>
              )}

              {checkoutMessage && (
                <div className="p-3 bg-rose/10 border border-rose/20 rounded-sm text-xs text-rose">
                  {checkoutMessage}
                </div>
              )}

              {/* Price Breakdown Preview */}
              {pointsToRedeem > 0 && loyaltyDiscount > 0 && (
                <div className="flex justify-between items-center text-xs text-emerald-800">
                  <span>Loyalty Discount ({pointsToRedeem} pts)</span>
                  <span>-{formatPrice(loyaltyDiscount)}</span>
                </div>
              )}

              {/* Summary Strip */}
              <div className="pt-3 border-t border-canvas-line flex justify-between items-center text-sm">
                <span className="text-ink-light">Total to Pay (Prepaid)</span>
                <span className="font-serif text-2xl text-rose font-medium">{formatPrice(grandTotal)}</span>
              </div>

              {/* Payment CTA */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full py-4 text-base font-medium flex items-center justify-center gap-2 shadow-soft mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Securing Order...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} /> Pay {formatPrice(grandTotal)} via Cashfree
                  </>
                )}
              </button>

              {/* WhatsApp Alternative */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleWhatsAppCheckout}
                  className="text-xs text-ink-light hover:text-moss inline-flex items-center gap-1 transition-colors"
                >
                  <MessageCircle size={14} className="text-moss" />
                  Prefer to chat? Complete via WhatsApp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
