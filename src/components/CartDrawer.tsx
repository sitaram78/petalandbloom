import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ShoppingBag, Trash2, Plus, Minus, MessageCircle, Check, CheckCircle2, Truck, Lock, Loader2, ShieldCheck, Sparkles, Gift, MapPin, Zap, ChevronDown, ChevronUp, Tag } from 'lucide-react';
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
  const [isExpressCourier, setIsExpressCourier] = useState(false);

  // Collapsible mobile drawer states
  const [showOffersSection, setShowOffersSection] = useState(false);
  const [showPriceBreakdown, setShowPriceBreakdown] = useState(false);

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

  // Gifting Order State
  const [isGiftOrder, setIsGiftOrder] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [giftCardMessage, setGiftCardMessage] = useState('');

  // Customer Saved Addresses State
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('new');
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [saveAddressToProfile, setSaveAddressToProfile] = useState(true);

  const { user, profile, loyalty } = useAuth();
  const [redeemPoints, setRedeemPoints] = useState(false);

  const applyAddress = (addr: CustomerAddress) => {
    const isGiftAddr = addr.recipient_name.toLowerCase().startsWith('gift:');
    if (isGiftAddr) {
      setIsGiftOrder(true);
      const cleanName = addr.recipient_name.replace(/^gift:\s*/i, '');
      setRecipientName(cleanName);
      setRecipientPhone(addr.phone || '');
      // Keep sender/buyer contact from profile
      if (profile?.full_name && !customerName) setCustomerName(profile.full_name);
      if (profile?.phone && !customerPhone) setCustomerPhone(profile.phone);
    } else {
      setCustomerName(addr.recipient_name || profile?.full_name || '');
      setCustomerPhone(addr.phone || profile?.phone || '');
    }
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

  const saveAddressIfNew = async (targetRecipientName: string, targetPhone: string, cleanPin: string) => {
    if (!user || !saveAddressToProfile || !addressLine1.trim() || !city.trim() || !state.trim()) return;
    try {
      const isFirstAddress = savedAddresses.length === 0;
      const alreadyExists = savedAddresses.some(
        (a) =>
          a.address_line1.trim().toLowerCase() === addressLine1.trim().toLowerCase() &&
          a.pincode.replace(/\D/g, '') === cleanPin
      );

      if (!alreadyExists) {
        const displayName = isGiftOrder
          ? (targetRecipientName.trim() ? `Gift: ${targetRecipientName.trim()}` : customerName.trim())
          : targetRecipientName.trim();

        const { data: newAddr } = await supabase
          .from('customer_addresses')
          .insert({
            customer_id: user.id,
            recipient_name: displayName,
            phone: targetPhone,
            address_line1: addressLine1.trim(),
            address_line2: addressLine2.trim() || null,
            city: city.trim(),
            state: state.trim(),
            pincode: cleanPin,
            is_default: isFirstAddress && !isGiftOrder,
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

  const giftWrapFee = (settings.businessRules?.giftWrapFeePaise ?? 7900) / 100;
  const freeThreshold = (settings.businessRules?.freeShippingThresholdPaise ?? 120000) / 100;
  const standardShipping = (settings.businessRules?.standardShippingFeePaise ?? 6900) / 100;
  const expressShipping = (settings.businessRules?.expressShippingFeePaise ?? 4900) / 100;

  const giftWrapTotal = items.reduce((sum, i) => sum + (i.giftWrap ? giftWrapFee * i.quantity : 0), 0);
  const baseShippingCost = totalPrice >= freeThreshold ? 0 : standardShipping;
  const expressSurcharge = isExpressCourier ? expressShipping : 0;
  const shippingCost = baseShippingCost + expressSurcharge;

  const freeShippingProgress = Math.min(100, Math.max(0, Math.round((totalPrice / freeThreshold) * 100)));
  const freeShippingRemaining = Math.max(0, Math.round(freeThreshold - totalPrice));

  // Dynamic 4-Drawer Settings for Loyalty
  const isLoyaltyEnabled = settings.featureFlags?.enableLoyalty ?? true;
  const minPointsThreshold = (settings.businessRules?.minLoyaltyOrderPaise ?? 29900) / 100;
  const pointValue = (settings.businessRules?.loyaltyPointRedemptionPaise ?? 50) / 100;

  const isPointsEligible = isLoyaltyEnabled && totalPrice >= minPointsThreshold;
  const pointsBalance = loyalty?.points_balance || 0;
  const maxDiscountAmount = Math.max(0, totalPrice - discountAmount);
  const maxPointsRedeemable = Math.min(pointsBalance, Math.floor(maxDiscountAmount / (pointValue || 0.5)));
  const pointsToRedeem = isPointsEligible && redeemPoints ? maxPointsRedeemable : 0;
  const loyaltyDiscount = pointsToRedeem * pointValue;
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
    const effectivePhone = customerPhone || profile?.phone || user?.phone;
    const result = await applyCoupon(couponCode, effectivePhone);
    setCouponMessage(result.message);
    if (result.success) setCouponCode('');
    setIsApplyingCoupon(false);
  };

  const handleOnlineCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutMessage('');

    if (!customerName.trim()) {
      setCheckoutMessage('Please enter your full name (Buyer / Sender).');
      return;
    }
    const cleanPhone = customerPhone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      setCheckoutMessage('Please enter your valid 10-digit mobile number for order updates.');
      return;
    }

    // If Gift Order: Validate Recipient Details
    let finalRecipientName = customerName.trim();
    let finalRecipientPhone = cleanPhone;

    if (isGiftOrder) {
      if (!recipientName.trim()) {
        setCheckoutMessage("Please enter the gift recipient's full name.");
        return;
      }
      const cleanRecipPhone = recipientPhone.replace(/\D/g, '').slice(-10);
      if (cleanRecipPhone.length !== 10) {
        setCheckoutMessage("Please enter the recipient's 10-digit mobile number so the courier can deliver.");
        return;
      }
      finalRecipientName = recipientName.trim();
      finalRecipientPhone = cleanRecipPhone;
    }

    if (!addressLine1.trim() || !city.trim() || !state.trim()) {
      setCheckoutMessage(isGiftOrder ? "Please complete the recipient's delivery address." : 'Please complete your delivery address.');
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
    await saveAddressIfNew(finalRecipientName, finalRecipientPhone, cleanPin);

    // Format customer note with gift card message if applicable
    let finalCustomerNote = customerNote.trim();
    if (isGiftOrder && giftCardMessage.trim()) {
      finalCustomerNote = `[GIFT CARD MESSAGE]: "${giftCardMessage.trim()}"${finalCustomerNote ? ` | Additional Note: ${finalCustomerNote}` : ''}`;
    }

    const result = await initiateCheckout({
      customer: {
        name: customerName.trim(),
        phone: cleanPhone,
        email: customerEmail.trim() || undefined,
        customerId: user?.id,
      },
      shippingAddress: {
        recipientName: finalRecipientName,
        phone: finalRecipientPhone,
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim(),
        state: state.trim(),
        pincode: cleanPin,
      },
      redeemPoints: pointsToRedeem > 0 ? pointsToRedeem : undefined,
      customerNote: finalCustomerNote || undefined,
      isExpress: isExpressCourier,
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

    const cleanPhone = customerPhone.replace(/\D/g, '').slice(-10);
    const cleanPin = pinCode.replace(/\D/g, '');

    let finalRecipientName = customerName.trim();
    let finalRecipientPhone = cleanPhone;

    if (isGiftOrder) {
      if (!recipientName.trim()) {
        setCheckoutMessage("Please enter the gift recipient's full name.");
        return;
      }
      const cleanRecipPhone = recipientPhone.replace(/\D/g, '').slice(-10);
      if (cleanRecipPhone.length !== 10) {
        setCheckoutMessage("Please enter the recipient's 10-digit mobile number.");
        return;
      }
      finalRecipientName = recipientName.trim();
      finalRecipientPhone = cleanRecipPhone;
    }

    trackEvent('checkout_started', { total: grandTotal, items: totalItems });
    saveAddressIfNew(finalRecipientName, finalRecipientPhone, cleanPin);

    checkoutWhatsApp({
      name: isGiftOrder ? `${customerName.trim()} (Sending Gift to ${finalRecipientName})` : customerName.trim(),
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
            <div className="flex items-center justify-between px-6 h-16 sm:h-20 border-b border-silk">
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
              <div className="px-5 py-2.5 bg-sage-light border-b border-sage-dark/10 flex items-center gap-2 animate-fade-in">
                <div className="w-5 h-5 rounded-full bg-sage flex items-center justify-center">
                  <Check size={12} className="text-parchment-50" strokeWidth={2.5} />
                </div>
                <p className="text-xs text-sage-dark font-medium">Added to your collection</p>
              </div>
            )}

            {/* Compact Complimentary Studio Shipping Sub-Bar */}
            {items.length > 0 && (
              <div className="relative bg-linen-light/95 border-b border-silk/80 px-5 py-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 truncate pr-2">
                    {freeShippingProgress >= 100 ? (
                      <>
                        <CheckCircle2 size={13} className="text-sage-dark shrink-0" />
                        <span className="font-serif italic text-sage-dark text-[11px] font-medium truncate">
                          Complimentary Studio Shipping Unlocked!
                        </span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} className="text-rose shrink-0" />
                        <span className="text-bark text-[11px] truncate">
                          Add <strong className="text-rose font-semibold">₹{freeShippingRemaining}</strong> for Complimentary Shipping
                        </span>
                      </>
                    )}
                  </div>
                  <span className={`text-[10px] font-mono font-medium shrink-0 ${
                    freeShippingProgress >= 100 ? 'text-sage-dark' : 'text-ink-light'
                  }`}>
                    {freeShippingProgress}%
                  </span>
                </div>
                {/* Thin integrated track directly beneath the bar */}
                <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-silk/40 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ease-out ${
                      freeShippingProgress >= 100
                        ? 'bg-sage-dark'
                        : 'bg-gradient-to-r from-rose to-sage'
                    }`}
                    style={{ width: `${freeShippingProgress}%` }}
                  />
                </div>
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
                        {appliedCoupon && appliedCoupon.eligibleProductCodes?.includes(item.code) && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded-xs mt-1">
                            <Tag size={10} className="text-emerald-700" /> Eligible for {appliedCoupon.code}
                          </span>
                        )}
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
              <div className="border-t border-silk px-5 py-3.5 space-y-2.5 bg-parchment-50/50">
                {/* 1. Offers & Priority Express Delivery Center Flip Toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowOffersSection(!showOffersSection)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3.5 rounded-atelier-btn bg-silk/25 hover:bg-silk/40 transition-colors text-xs text-ink-light group"
                    aria-expanded={showOffersSection}
                  >
                    <Tag size={13} className="text-rose shrink-0" />
                    <span className="font-serif italic text-bark text-xs">
                      {showOffersSection ? 'Hide Offers & Express Delivery' : 'Coupons & Express Delivery'}
                    </span>
                    <span className="p-0.5 rounded-full bg-silk/40 text-ink group-hover:bg-silk/60 transition-transform">
                      {showOffersSection ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </span>
                    {/* Badge indicators when minimized */}
                    {!showOffersSection && (appliedCoupon || isExpressCourier) && (
                      <span className="ml-1 inline-flex items-center gap-1 text-[10px] bg-rose/10 text-rose font-medium px-1.5 py-0.2 rounded-full">
                        {appliedCoupon && `-${formatPrice(appliedCoupon.discountInRupees)}`}
                        {isExpressCourier && '· Express'}
                      </span>
                    )}
                  </button>

                  {/* Smooth Collapsible Offers Body */}
                  {showOffersSection && (
                    <div className="mt-2 space-y-3 p-3.5 rounded-atelier-panel bg-linen-light/70 border border-silk/60 animate-fade-in">
                      {/* Coupon Input */}
                      {settings.featureFlags?.enableCoupons !== false && (
                        <div className="space-y-1.5 text-xs">
                          <div className="flex gap-2">
                            <input
                              value={couponCode}
                              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                              placeholder="Enter coupon code"
                              className="input-field flex-1 text-xs sm:text-sm py-2 px-3.5 bg-parchment-50 h-9"
                              aria-label="Coupon code"
                            />
                            <button
                              type="button"
                              onClick={handleApplyCoupon}
                              disabled={isApplyingCoupon}
                              className="btn-secondary px-4 py-2 text-xs font-medium whitespace-nowrap h-9"
                            >
                              {isApplyingCoupon ? 'Checking...' : 'Apply'}
                            </button>
                          </div>
                          {couponMessage && <p className="text-xs text-rose">{couponMessage}</p>}
                          {appliedCoupon && (
                            <div className="flex flex-col gap-1 text-xs text-sage-dark bg-emerald-50/70 border border-emerald-200/60 p-2.5 rounded-sm">
                              <div className="flex justify-between items-center">
                                <span className="font-semibold text-emerald-900 flex items-center gap-1.5">
                                  <Tag size={12} className="text-emerald-700" />
                                  {appliedCoupon.code} applied (-₹{appliedCoupon.discountInRupees})
                                </span>
                                <button type="button" onClick={removeCoupon} className="underline hover:text-rose text-[11px]">Remove</button>
                              </div>
                              {appliedCoupon.eligibleItemsCount && appliedCoupon.eligibleItemsCount > 0 ? (
                                <p className="text-[10px] text-emerald-700 leading-tight">
                                  Applied to {appliedCoupon.eligibleItemsCount} eligible {appliedCoupon.eligibleItemsCount === 1 ? 'item' : 'items'} in your bag.
                                </p>
                              ) : null}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Priority Express Courier Toggle */}
                      <div className={`p-2.5 rounded-lg border transition-all ${
                        isExpressCourier
                          ? 'bg-rose/5 border-rose/30 shadow-xs'
                          : 'bg-parchment-50 border-canvas-line'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                              isExpressCourier ? 'bg-rose/15 text-rose' : 'bg-canvas text-ink-light'
                            }`}>
                              <Zap size={13} className={isExpressCourier ? 'text-rose' : 'text-ink-light'} />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-bark">Priority Express Courier</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose/10 text-rose font-medium">
                                  +₹{Math.round(expressShipping)}
                                </span>
                              </div>
                              <p className="text-[10px] text-ink-light/70">
                                1–2 day air dispatch with priority studio handling
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isExpressCourier}
                            onClick={() => setIsExpressCourier(!isExpressCourier)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              isExpressCourier ? 'bg-rose' : 'bg-silk'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                isExpressCourier ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Pricing Summary & Collapsible Breakdown */}
                <div className="pt-2 border-t border-silk/80">
                  {/* Expanded Breakdown details */}
                  {showPriceBreakdown && (
                    <div className="space-y-1.5 text-xs pb-2 mb-2 border-b border-silk/60 animate-fade-in text-ink-light">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span className="text-ink font-medium">{formatPrice(totalPrice)}</span>
                      </div>
                      {discountAmount > 0 && (
                        <div className="flex justify-between text-sage-dark">
                          <span>Discount {appliedCoupon?.code ? `(${appliedCoupon.code})` : ''}</span>
                          <span>-{formatPrice(discountAmount)}</span>
                        </div>
                      )}
                      {giftWrapTotal > 0 && (
                        <div className="flex justify-between">
                          <span>Gift Wrapping</span>
                          <span>{formatPrice(giftWrapTotal)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="flex items-center gap-1">
                          <Truck size={12} strokeWidth={1.5} /> Shipping
                          {isExpressCourier && (
                            <span className="text-[10px] text-rose font-medium ml-0.5">(Express Air)</span>
                          )}
                        </span>
                        <span className={shippingCost === 0 ? 'text-sage-dark font-medium' : 'text-ink'}>
                          {shippingCost === 0 ? 'COMPLIMENTARY' : formatPrice(shippingCost)}
                        </span>
                      </div>
                      {shippingCost > 0 && !isExpressCourier && totalPrice < freeThreshold && (
                        <p className="text-[10px] text-ink-light/60">
                          Add ₹{Math.max(0, Math.round(freeThreshold - totalPrice))} more for complimentary shipping
                        </p>
                      )}
                    </div>
                  )}

                  {/* Summary Line with Collapsible Dropdown Toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-ink">Estimated Total</span>
                        <button
                          type="button"
                          onClick={() => setShowPriceBreakdown(!showPriceBreakdown)}
                          className="inline-flex items-center gap-0.5 text-[11px] text-rose hover:text-rose-deep font-medium cursor-pointer transition-colors"
                        >
                          <span>{showPriceBreakdown ? 'Hide breakup' : 'View breakup'}</span>
                          {showPriceBreakdown ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      </div>
                      <span className="text-[10px] text-ink-light/60 block">All taxes & packaging included</span>
                    </div>
                    <span className="font-serif text-2xl font-medium text-ink">
                      {formatPrice(grandTotal)}
                    </span>
                  </div>
                </div>

                {/* 3. Primary Checkout CTA */}
                <button
                  onClick={openCheckout}
                  className="btn-primary w-full py-3.5 text-sm flex items-center justify-center gap-2 shadow-soft mt-1"
                >
                  <Lock size={15} /> Place Order · Settle via UPI
                </button>

                {/* Subtle Support Link */}
                <p className="text-center text-[11px] text-ink-light/60 pt-0.5">
                  Need custom styling advice?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      closeCart();
                      triggerAssistance(
                        `Hi The Petal & Bloom Atelier, I have items in my bag and would like some assistance before placing my order.`
                      );
                    }}
                    className="underline hover:text-ink transition-colors cursor-pointer"
                  >
                    Ask Studio Concierge
                  </button>
                </p>
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
                            {(() => {
                              const isGift = addr.recipient_name.toLowerCase().startsWith('gift:');
                              const cleanName = isGift ? addr.recipient_name.replace(/^gift:\s*/i, '') : addr.recipient_name;
                              return (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-bark truncate">{cleanName}</span>
                                  {isGift && (
                                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-rose/15 text-rose-deep border border-rose/30 flex items-center gap-0.5">
                                      <Gift size={9} className="text-rose" /> Gift
                                    </span>
                                  )}
                                  {addr.is_default && (
                                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-rose/10 text-rose-deep border border-rose/20">
                                      Default
                                    </span>
                                  )}
                                  <span className="text-[11px] text-ink-light truncate">· +91 {addr.phone}</span>
                                </div>
                              );
                            })()}
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

              {/* Gifting Toggle Card */}
              <div
                className={`p-3.5 rounded-sm border transition-all ${
                  isGiftOrder
                    ? 'bg-rose/10 border-rose/30 shadow-xs'
                    : 'bg-canvas/40 border-canvas-line hover:border-canvas-line-hover'
                }`}
              >
                <label htmlFor="isGiftOrder" className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        isGiftOrder ? 'bg-rose text-linen shadow-xs' : 'bg-linen border border-canvas-line text-rose'
                      }`}
                    >
                      <Gift size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-bark block">
                        Sending this as a gift to someone else?
                      </span>
                      <span className="text-[11px] text-ink-light block">
                        Deliver directly to recipient with a complimentary handwritten card
                      </span>
                    </div>
                  </div>
                  <input
                    id="isGiftOrder"
                    type="checkbox"
                    checked={isGiftOrder}
                    onChange={(e) => setIsGiftOrder(e.target.checked)}
                    className="w-4 h-4 accent-rose rounded cursor-pointer"
                  />
                </label>

                {isGiftOrder && (
                  <div className="mt-3.5 pt-3.5 border-t border-rose/20 space-y-3 animate-in fade-in duration-200">
                    {/* Reassurance Guarantee Badge */}
                    <div className="p-2.5 bg-linen/95 border border-rose/25 rounded-sm flex items-start gap-2.5 text-[11px] text-rose-deep leading-relaxed">
                      <ShieldCheck size={16} className="text-rose shrink-0 mt-0.5" />
                      <span>
                        <strong>Atelier Gifting Guarantee:</strong> We <u>never</u> include price tags or invoices in gift deliveries. Your recipient only receives the fresh handcrafted bouquet and your handwritten card.
                      </span>
                    </div>

                    {/* Recipient Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="recipientName" className="block text-xs uppercase tracking-wider text-bark font-semibold mb-1">
                          Recipient's Full Name *
                        </label>
                        <input
                          id="recipientName"
                          required={isGiftOrder}
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          placeholder="e.g. Riya Sharma"
                          className="input-field text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="recipientPhone" className="block text-xs uppercase tracking-wider text-bark font-semibold mb-1 flex items-center justify-between">
                          <span>Recipient's Mobile *</span>
                          <span className="text-[10px] text-ink-light font-normal">For courier call</span>
                        </label>
                        <input
                          id="recipientPhone"
                          required={isGiftOrder}
                          type="tel"
                          maxLength={10}
                          value={recipientPhone}
                          onChange={(e) => setRecipientPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="10-digit mobile"
                          className="input-field text-sm"
                        />
                      </div>
                    </div>

                    {/* Gift Message Card */}
                    <div>
                      <label htmlFor="giftCardMessage" className="block text-xs uppercase tracking-wider text-bark font-semibold mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Sparkles size={12} className="text-rose" />
                          Complimentary Handwritten Card Note
                        </span>
                        <span className="text-[10px] text-ink-light font-normal">{giftCardMessage.length}/250 chars</span>
                      </label>
                      <textarea
                        id="giftCardMessage"
                        rows={2}
                        maxLength={250}
                        value={giftCardMessage}
                        onChange={(e) => setGiftCardMessage(e.target.value)}
                        placeholder="e.g. Happy Birthday Riya! Wishing you the happiest year ahead. With all my love, Ananya"
                        className="input-field text-xs resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Sender / Billing Contact Details */}
              <div className="pt-1">
                <p className="text-[11px] uppercase tracking-wider text-bark font-semibold flex items-center justify-between">
                  <span>{isGiftOrder ? '1. Your Details (Sender / Billing)' : 'Your Contact Details'}</span>
                  {isGiftOrder && (
                    <span className="text-[10px] text-ink-light font-normal lowercase">receipts & tracking sent here</span>
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="customerName" className="block text-xs uppercase tracking-wider text-ink font-semibold mb-1">
                    Your Name *
                  </label>
                  <input
                    id="customerName"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Amrita Rao"
                    className="input-field text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="customerPhone" className="block text-xs uppercase tracking-wider text-ink font-semibold mb-1">
                    Mobile Number *
                  </label>
                  <input
                    id="customerPhone"
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
                <label htmlFor="customerEmail" className="block text-xs uppercase tracking-wider text-ink font-semibold mb-1">
                  Email Address (Optional)
                </label>
                <input
                  id="customerEmail"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="For receipt & tracking updates"
                  className="input-field text-sm"
                />
              </div>

              {/* Delivery Destination Address */}
              <div className="pt-2">
                <p className="text-[11px] uppercase tracking-wider text-bark font-semibold flex items-center justify-between">
                  <span>{isGiftOrder ? "2. Recipient's Delivery Address" : 'Delivery Address'}</span>
                  {isGiftOrder && (
                    <span className="text-[10px] text-rose font-medium">destination for gift parcel</span>
                  )}
                </p>
              </div>

              <div>
                <label htmlFor="addressLine1" className="block text-xs uppercase tracking-wider text-ink font-semibold mb-1">
                  {isGiftOrder ? "Recipient's House / Flat / Street Address *" : 'House / Flat / Street Address *'}
                </label>
                <input
                  id="addressLine1"
                  required
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="Flat 402, Lotus Residency, MG Road"
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label htmlFor="addressLine2" className="block text-xs uppercase tracking-wider text-ink font-semibold mb-1">
                  Landmark / Area (Optional)
                </label>
                <input
                  id="addressLine2"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="Near Botanical Garden"
                  className="input-field text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="city" className="block text-xs uppercase tracking-wider text-ink font-semibold mb-1">
                    City *
                  </label>
                  <input
                    id="city"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Bengaluru"
                    className="input-field text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="state" className="block text-xs uppercase tracking-wider text-ink font-semibold mb-1">
                    State *
                  </label>
                  <input
                    id="state"
                    required
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="Karnataka"
                    className="input-field text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="pinCode" className="block text-xs uppercase tracking-wider text-ink font-semibold mb-1">
                    PIN *
                  </label>
                  <input
                    id="pinCode"
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
                  <span>
                    {isGiftOrder
                      ? "Save recipient's address to my Atelier profile for future gifting"
                      : 'Save this delivery address to my Atelier profile for future orders'}
                  </span>
                </label>
              )}

              <div>
                <label className="block text-xs uppercase tracking-wider text-ink font-semibold mb-1">
                  {isGiftOrder ? 'Additional Studio Instructions (Optional)' : 'Special Note or Gift Message'}
                </label>
                <input
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder={
                    isGiftOrder
                      ? 'e.g. Ring doorbell gently, deliver in evening'
                      : 'Special instructions for the studio'
                  }
                  className="input-field text-sm"
                />
              </div>

              {/* Loyalty Points Redemption (Toggled via Feature Flag) */}
              {settings.featureFlags?.enableLoyalty !== false && user && pointsBalance > 0 && (
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
                            ? `Available: ${pointsBalance} pts (Save up to ₹${Math.floor(maxPointsRedeemable * pointValue)} · 1 pt = ₹${pointValue.toFixed(2)})`
                            : `Available: ${pointsBalance} pts (Redeemable on orders above ₹${minPointsThreshold})`}
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
                      <span className="text-[11px] text-rose font-medium">Min ₹{minPointsThreshold} order</span>
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
                <span className="text-ink-light">Total (Payable via UPI)</span>
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
                    <Loader2 size={18} className="animate-spin" /> Reserving Your Blooms...
                  </>
                ) : (
                  <>
                    <Lock size={18} /> Place Order · Pay {formatPrice(grandTotal)} via UPI
                  </>
                )}
              </button>

              <div className="pt-2 text-center space-y-1">
                <p className="text-[11px] text-ink-light flex items-center justify-center gap-1.5 font-light">
                  <ShieldCheck size={14} className="text-emerald-700" />
                  <span>No card needed · Settle securely via GPay / PhonePe / Paytm / QR</span>
                </p>
                <p className="text-[10px] text-ink-light/70">
                  Our concierge will connect with you via WhatsApp to complete payment and begin crafting.
                </p>
              </div>

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
