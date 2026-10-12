import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Package,
  Truck,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Search,
  Gift,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  FileText,
  Sparkles,
  Flower2,
} from 'lucide-react';
import { useProducts } from '@/context/ProductContext';
import { useNotification } from '@/context/NotificationContext';
import { authFetch } from '@/lib/apiClient';
import { formatPrice } from '@/data/products';
import { INDIAN_STATES } from '@/pages/Account';
import { SUPPORTED_CARRIERS, CarrierType, generateTrackingUrl } from '@/services/shippingService';
import { supabase } from '@/lib/supabaseClient';
import { logAudit, AUDIT_ACTIONS } from '@/lib/auditClient';
import { useStoreSettings } from '@/context/StoreSettingsContext';

export interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: (newOrder: any) => void;
}

interface OrderItemForm {
  id: string;
  productCode: string;
  productName: string;
  category?: string;
  unitPrice: number;
  quantity: number;
  selectedColor: string;
  packagingType: 'standard' | 'silk_wrap';
  packagingFee: number;
  packagingLabel: string;
  itemImage?: string;
  isCustom?: boolean;
}

export default function CreateOrderModal({
  isOpen,
  onClose,
  onOrderCreated,
}: CreateOrderModalProps) {
  const { products } = useProducts();
  const { showNotification } = useNotification();
  const { settings } = useStoreSettings();

  // Dynamic packaging & gift fees from store settings
  const greetingCardFee = (settings.businessRules?.greetingCardFeePaise ?? 4900) / 100;
  const personalisedMessageFee = (settings.businessRules?.personalisedMessageFeePaise ?? 3900) / 100;
  const bouquetLuxuryWrapUpgradeFee = (settings.businessRules?.bouquetLuxuryWrapUpgradeFeePaise ?? 5900) / 100;
  const stemBouquetWrapFee = (settings.businessRules?.stemBouquetWrapFeePaise ?? 7900) / 100;
  const luxuryGiftBoxFee = (settings.businessRules?.luxuryGiftBoxFeePaise ?? 14900) / 100;

  // Form State: Customer
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  // Form State: Gifting
  const [isGiftOrder, setIsGiftOrder] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [giftCardMessage, setGiftCardMessage] = useState('');

  // Form State: Address
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Karnataka');
  const [pincode, setPincode] = useState('');

  // Form State: Items
  const [items, setItems] = useState<OrderItemForm[]>([]);
  const [selectedProductCode, setSelectedProductCode] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');

  // Tier 2: Floral Assembly (Order-Level when stems are present)
  const [bundleStemsIntoBouquet, setBundleStemsIntoBouquet] = useState(false);

  // Tier 1: Master Parcel Presentation & Gift Notes (Order-Level)
  const [masterPackaging, setMasterPackaging] = useState<'standard' | 'gift_box'>('standard');
  const [masterBoxCount, setMasterBoxCount] = useState<number>(1);
  const [addGreetingCard, setAddGreetingCard] = useState(false);
  const [greetingCardText, setGreetingCardText] = useState('');
  const [addPersonalNote, setAddPersonalNote] = useState(false);
  const [personalNoteText, setPersonalNoteText] = useState('');

  // Live filter catalog pieces by SKU / code or name
  const filteredProducts = products.filter((p) => {
    if (!catalogSearch.trim()) return true;
    const q = catalogSearch.toLowerCase().trim();
    return p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
  });

  const isBouquetItem = (it: { category?: string; name?: string; productName?: string; code?: string; productCode?: string }) => {
    const category = (it.category || '').toLowerCase();
    const name = (it.productName || it.name || '').toLowerCase();
    const code = (it.productCode || it.code || '').toUpperCase();
    return category === 'bouquets' || name.includes('bouquet') || code.includes('BOUQ');
  };

  const isStemItem = (it: { category?: string; name?: string; productName?: string; code?: string; productCode?: string }) => {
    const category = (it.category || '').toLowerCase();
    const name = (it.productName || it.name || '').toLowerCase();
    const code = (it.productCode || it.code || '').toUpperCase();
    return category === 'flowers' || category === 'stems' || name.includes('stem') || code.includes('STEM');
  };

  const stemsInOrder = items.filter(isStemItem);
  const totalStemCount = stemsInOrder.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const hasStems = totalStemCount > 0;

  const getItemEffectiveUnitPrice = (it: OrderItemForm) => {
    const base = Number(it.unitPrice) || 0;
    const isBouq = isBouquetItem(it);
    const silkWrap = isBouq && it.packagingType === 'silk_wrap' ? bouquetLuxuryWrapUpgradeFee : 0;
    return base + silkWrap;
  };

  // Form State: Financials
  const [discountRupees, setDiscountRupees] = useState<number | ''>('');
  const [shippingFeeRupees, setShippingFeeRupees] = useState<number | ''>(0);
  const [paymentStatus, setPaymentStatus] = useState<'SUCCESS' | 'PENDING'>('SUCCESS');
  const [paymentMethod, setPaymentMethod] = useState('MANUAL_UPI');

  // Form State: Order Status & Date
  const [orderStatus, setOrderStatus] = useState('PAYMENT_CONFIRMED');
  const [isHistoricalDate, setIsHistoricalDate] = useState(false);
  const [customDate, setCustomDate] = useState(new Date().toISOString().slice(0, 10));

  // Form State: Courier / Delhivery
  const [carrier, setCarrier] = useState<CarrierType>('DELHIVERY');
  const [awbNumber, setAwbNumber] = useState('');
  const [adminNote, setAdminNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Add Product from Catalog
  const handleAddCatalogProduct = () => {
    const codeToUse = selectedProductCode || (filteredProducts.length === 1 ? filteredProducts[0].code : '');
    if (!codeToUse) {
      if (filteredProducts.length > 1) {
        setFormError('Please select a piece from the dropdown list.');
      } else {
        setFormError('Please search or choose a piece from the catalog.');
      }
      return;
    }
    const prod = products.find((p) => p.code === codeToUse);
    if (!prod) return;

    const isBouquet = isBouquetItem(prod);
    const isFlower = isStemItem(prod);
    const defaultLabel = isBouquet ? 'Standard Floral Wrap' : isFlower ? 'Individual Stem Sleeves' : 'Standard Studio Packaging';

    const newItem: OrderItemForm = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      productCode: prod.code,
      productName: prod.name,
      category: prod.category,
      unitPrice: prod.price,
      quantity: 1,
      selectedColor: prod.colors?.[0] || 'Default',
      packagingType: 'standard',
      packagingFee: 0,
      packagingLabel: defaultLabel,
      itemImage: prod.images?.[0] || '',
      isCustom: false,
    };

    setItems([...items, newItem]);
    setSelectedProductCode('');
    setCatalogSearch('');
    setFormError(null);
  };

  // Add Custom Bespoke Piece
  const handleAddCustomItem = () => {
    const customItem: OrderItemForm = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      productCode: `BESPOKE-${Date.now().toString().slice(-4)}`,
      productName: 'Bespoke Handmade Floral Arrangement',
      category: 'bouquets',
      unitPrice: 499,
      quantity: 1,
      selectedColor: 'Custom Palette',
      packagingType: 'standard',
      packagingFee: 0,
      packagingLabel: 'Standard Floral Wrap',
      isCustom: true,
    };

    setItems([...items, customItem]);
    setFormError(null);
  };

  // Update item field
  const handleUpdateItem = (id: string, updates: Partial<OrderItemForm>) => {
    setItems(items.map((it) => (it.id === id ? { ...it, ...updates } : it)));
  };

  // Remove item
  const handleRemoveItem = (id: string) => {
    setItems(items.filter((it) => it.id !== id));
  };

  // Calculation totals
  const baseItemsSubtotal = items.reduce(
    (sum, it) => sum + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1),
    0
  );

  // Bouquet Silk Wrap upgrades: multiplies with bouquet quantity
  const bouquetSilkWrapsTotal = items.reduce((sum, it) => {
    if (isBouquetItem(it) && it.packagingType === 'silk_wrap') {
      return sum + bouquetLuxuryWrapUpgradeFee * (Number(it.quantity) || 1);
    }
    return sum;
  }, 0);

  // Stem assembly fee: flat fee once for all stems combined
  const stemBundleTotal = hasStems && bundleStemsIntoBouquet ? stemBouquetWrapFee : 0;

  // Master Keepsake Gift Box: flat fee once (or * boxCount) housing all items
  const masterGiftBoxTotal = masterPackaging === 'gift_box' ? luxuryGiftBoxFee * Math.max(1, masterBoxCount) : 0;

  // Greeting card & personal note: flat once per parcel
  const effectiveGreetingCard = addGreetingCard || (isGiftOrder && Boolean(giftCardMessage.trim()));
  const greetingCardTotal = effectiveGreetingCard ? greetingCardFee : 0;
  const personalNoteTotal = addPersonalNote ? personalisedMessageFee : 0;

  const totalPackagingAndGifting =
    bouquetSilkWrapsTotal + stemBundleTotal + masterGiftBoxTotal + greetingCardTotal + personalNoteTotal;

  const subtotal = baseItemsSubtotal + totalPackagingAndGifting;
  const discountVal = Number(discountRupees) || 0;
  const shippingVal = Number(shippingFeeRupees) || 0;
  const netTotal = Math.max(0, subtotal - discountVal + shippingVal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!customerName.trim()) {
      setFormError('Please enter the customer full name.');
      return;
    }

    const cleanPhone = customerPhone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      setFormError('Please enter a valid 10-digit Indian mobile phone number for the buyer.');
      return;
    }

    // Gift Recipient Validation
    let finalRecipientName = customerName.trim();
    let finalRecipientPhone = cleanPhone;

    if (isGiftOrder) {
      if (!recipientName.trim()) {
        setFormError('Please enter the gift recipient full name.');
        return;
      }
      const cleanRecipPhone = recipientPhone.replace(/\D/g, '').slice(-10);
      if (cleanRecipPhone.length !== 10) {
        setFormError('Please enter a valid 10-digit mobile number for the gift recipient (for courier delivery call).');
        return;
      }
      finalRecipientName = recipientName.trim();
      finalRecipientPhone = cleanRecipPhone;
    }

    if (!addressLine1.trim() || !city.trim() || !state.trim()) {
      setFormError('Please enter complete delivery address details.');
      return;
    }

    const cleanPincode = pincode.replace(/\D/g, '');
    if (cleanPincode.length !== 6) {
      setFormError('Please enter a valid 6-digit postal PIN code.');
      return;
    }

    if (items.length === 0) {
      setFormError('Please add at least one purchased item to this order.');
      return;
    }

    setSubmitting(true);

    try {
      // 1. Compile Botanical Line Items
      const constructedItems: Array<{
        productCode: string;
        productName: string;
        unitPriceInRupees: number;
        baseUnitPriceInRupees?: number;
        quantity: number;
        selectedColor?: string;
        giftWrap?: boolean;
        personalMessage?: string;
        itemImage?: string;
      }> = [];

      for (const it of items) {
        const isBouq = isBouquetItem(it);
        const isStem = isStemItem(it);
        const isSilk = isBouq && it.packagingType === 'silk_wrap';
        const effectiveUnit = (Number(it.unitPrice) || 0) + (isSilk ? bouquetLuxuryWrapUpgradeFee : 0);

        let note = '';
        if (isBouq && isSilk) {
          note = `Packaging: Luxury Silk Wrap Upgrade (+₹${bouquetLuxuryWrapUpgradeFee}/ea)`;
        } else if (isStem && bundleStemsIntoBouquet) {
          note = `Stem Arrangement: Bundled with order stems into 1 custom bouquet`;
        } else if (isStem) {
          note = `Stem Arrangement: Individual protective stem sleeve`;
        }

        constructedItems.push({
          productCode: it.productCode,
          productName: it.productName,
          unitPriceInRupees: effectiveUnit,
          baseUnitPriceInRupees: Number(it.unitPrice) || 0,
          quantity: Number(it.quantity) || 1,
          selectedColor: it.selectedColor || undefined,
          giftWrap: isSilk || (isStem && bundleStemsIntoBouquet),
          personalMessage: note || undefined,
          itemImage: it.itemImage || undefined,
        });
      }

      // 2. Loose Stems Bouquet Assembly (Flat fee for all loose stems combined)
      if (hasStems && bundleStemsIntoBouquet) {
        constructedItems.push({
          productCode: 'PKG-BOUQ-WRAP',
          productName: 'Artisan Bouquet Assembly & Wrap (Loose Stems)',
          unitPriceInRupees: stemBouquetWrapFee,
          quantity: 1,
          giftWrap: true,
          personalMessage: `Assembled ${totalStemCount} loose flower stems into 1 unified bouquet with satin ribbon`,
        });
      }

      // 3. Master Keepsake Packaging Box (Flat fee for the entire parcel)
      if (masterPackaging === 'gift_box') {
        constructedItems.push({
          productCode: 'PKG-RIGID-BOX',
          productName: 'Luxury Rigid Keepsake Gift Box & Ribbon',
          unitPriceInRupees: luxuryGiftBoxFee,
          quantity: Math.max(1, masterBoxCount),
          giftWrap: true,
          personalMessage: 'Master keepsake presentation box housing all order items',
        });
      }

      // 4. Handwritten Greeting Card (Flat fee for the parcel)
      const finalCardText = (greetingCardText.trim() || giftCardMessage.trim());
      if (effectiveGreetingCard) {
        constructedItems.push({
          productCode: 'GIFT-CARD-NOTE',
          productName: 'Handwritten Premium Greeting Card',
          unitPriceInRupees: greetingCardFee,
          quantity: 1,
          giftWrap: false,
          personalMessage: finalCardText ? `Card Note: "${finalCardText}"` : 'Handwritten Greeting Card',
        });
      }

      // 5. Artisan Wax-Sealed Personal Note (Flat fee for the parcel)
      if (addPersonalNote) {
        constructedItems.push({
          productCode: 'GIFT-ARTISAN-NOTE',
          productName: 'Artisan Wax-Sealed Personal Note',
          unitPriceInRupees: personalisedMessageFee,
          quantity: 1,
          giftWrap: false,
          personalMessage: personalNoteText.trim() ? `Personal Note: "${personalNoteText.trim()}"` : 'Artisan Personal Note',
        });
      }

      // 6. Structured Order Packaging Header
      const presentationNotes = [
        masterPackaging === 'gift_box'
          ? `Master Box: Luxury Rigid Keepsake Box (${masterBoxCount > 1 ? `${masterBoxCount} boxes` : '1 box'} +₹${masterGiftBoxTotal})`
          : 'Master Box: Standard Studio Parcel (₹0)',
        hasStems
          ? (bundleStemsIntoBouquet ? `Stem Assembly: Bundled ${totalStemCount} stems into 1 Bouquet (+₹${stemBouquetWrapFee})` : `Stem Assembly: ${totalStemCount} stems in individual sleeves (₹0)`)
          : null,
        effectiveGreetingCard ? `Card: "${finalCardText}" (+₹${greetingCardFee})` : null,
        addPersonalNote ? `Note: "${personalNoteText.trim()}" (+₹${personalisedMessageFee})` : null,
      ].filter(Boolean).join(' | ');

      const cardCallout = finalCardText ? ` [GIFT CARD MESSAGE]: "${finalCardText}"` : '';

      let finalAdminNote = adminNote.trim();
      if (isGiftOrder) {
        const giftHeader = `[GIFT ORDER - Recipient: ${finalRecipientName} | Phone: +91 ${finalRecipientPhone}]`;
        finalAdminNote = `${giftHeader} [PACKAGING: ${presentationNotes}]${cardCallout}${finalAdminNote ? ` | ${finalAdminNote}` : ''}`;
      } else {
        finalAdminNote = `[PACKAGING: ${presentationNotes}]${cardCallout}${finalAdminNote ? ` | ${finalAdminNote}` : ''}`;
      }

      const payload = {
        customer: {
          name: customerName.trim(),
          phone: cleanPhone,
          email: customerEmail.trim() || undefined,
        },
        shippingAddress: {
          recipientName: finalRecipientName,
          phone: finalRecipientPhone,
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || undefined,
          city: city.trim(),
          state: state.trim(),
          pincode: cleanPincode,
        },
        items: constructedItems,
        discountInRupees: discountVal,
        shippingFeeInRupees: shippingVal,
        orderStatus,
        paymentStatus,
        paymentMethod,
        orderDate: isHistoricalDate && customDate ? new Date(customDate).toISOString() : undefined,
        adminNote: finalAdminNote || undefined,
        shipment:
          awbNumber.trim() || orderStatus === 'SHIPPED' || orderStatus === 'DELIVERED'
            ? {
                carrier,
                awbNumber: awbNumber.trim() || undefined,
              }
            : undefined,
      };

      let orderRecord: any = null;

      // 1. Attempt authoritative server endpoint (runs in production on Vercel)
      try {
        const res = await authFetch('/api/admin/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => null);

        if (res.ok && data?.success && data?.order) {
          orderRecord = data.order;
        } else if (res.status === 400 && data?.message) {
          // Explicit form validation error returned by server
          throw new Error(data.message);
        } else {
          console.warn('[CreateOrderModal] Server endpoint returned non-OK status, falling back to direct client insertion:', data?.message || res.statusText);
        }
      } catch (apiErr: any) {
        if (
          apiErr.message &&
          !apiErr.message.toLowerCase().includes('fetch') &&
          !apiErr.message.toLowerCase().includes('internal server error') &&
          !apiErr.message.toLowerCase().includes('network')
        ) {
          throw apiErr;
        }
        console.warn('[CreateOrderModal] API request threw, trying direct Supabase client fallback:', apiErr?.message);
      }

      // 2. Direct Supabase client insertion fallback (guarantees orders save reliably in local dev sandbox and flaky network)
      if (!orderRecord) {
        const subtotalInPaise = constructedItems.reduce((acc, it) => {
          const unitPaise = Math.round(Number(it.unitPriceInRupees) * 100);
          return acc + unitPaise * Number(it.quantity);
        }, 0);
        const discountInPaise = Math.max(0, Math.round(Number(discountVal) * 100));
        const shippingFeeInPaise = Math.max(0, Math.round(Number(shippingVal) * 100));
        const totalInPaise = Math.max(0, subtotalInPaise - discountInPaise + shippingFeeInPaise);

        const orderNumber = `TPB-ADM-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const createdAt = isHistoricalDate && customDate ? new Date(customDate).toISOString() : new Date().toISOString();

        let finalOrderStatus = orderStatus;
        if (!finalOrderStatus) {
          finalOrderStatus = paymentStatus === 'SUCCESS' ? 'PAYMENT_CONFIRMED' : 'PENDING_PAYMENT';
        }

        const addressSnapshot = {
          recipientName: finalRecipientName,
          phone: finalRecipientPhone,
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || undefined,
          city: city.trim(),
          state: state.trim(),
          pincode: cleanPincode,
        };

        // Try to link customer ID if available
        let linkedCustomerId: string | null = null;
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .or(`phone.eq.${cleanPhone}${customerEmail.trim() ? `,email.eq.${customerEmail.trim().toLowerCase()}` : ''}`)
            .maybeSingle();
          if (profile?.id) linkedCustomerId = profile.id;
        } catch (profileErr) {
          console.warn('[CreateOrderModal] Customer profile lookup warning:', profileErr);
        }

        const { data: newOrder, error: orderErr } = await supabase
          .from('orders')
          .insert({
            order_number: orderNumber,
            customer_id: linkedCustomerId,
            guest_name: customerName.trim(),
            guest_phone: cleanPhone,
            guest_email: customerEmail.trim() || null,
            shipping_address_snapshot: addressSnapshot,
            subtotal_in_paise: subtotalInPaise,
            discount_in_paise: discountInPaise,
            loyalty_points_redeemed: 0,
            loyalty_discount_in_paise: 0,
            shipping_fee_in_paise: shippingFeeInPaise,
            total_in_paise: totalInPaise,
            order_status: finalOrderStatus,
            payment_status: paymentStatus,
            customer_note: finalAdminNote || 'Recorded manually from offline studio purchase.',
            created_at: createdAt,
          })
          .select('id, order_number, order_status, payment_status, total_in_paise, created_at')
          .single();

        if (orderErr || !newOrder) {
          throw new Error(orderErr?.message || 'Failed to record manual order in Supabase database.');
        }

        const itemsPayload = constructedItems.map((it, idx) => {
          const unitPaise = Math.round(Number(it.unitPriceInRupees) * 100);
          const totalPaise = unitPaise * Number(it.quantity);
          const code = it.productCode?.trim() || `BESPOKE-${Date.now().toString(36).toUpperCase()}-${idx + 1}`;

          return {
            order_id: newOrder.id,
            product_code: code,
            product_name: it.productName.trim(),
            unit_price_in_paise: unitPaise,
            quantity: Number(it.quantity),
            total_price_in_paise: totalPaise,
            selected_color: it.selectedColor?.trim() || null,
            gift_wrap: Boolean(it.giftWrap),
            personal_message: it.personalMessage?.trim() || null,
            item_image: it.itemImage || null,
          };
        });

        const { error: itemsErr } = await supabase.from('order_items').insert(itemsPayload);
        if (itemsErr) {
          console.error('[CreateOrderModal] Order items insertion warning:', itemsErr);
        }

        // Status history
        try {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from('order_status_history').insert({
            order_id: newOrder.id,
            previous_status: null,
            new_status: finalOrderStatus,
            note: `Order recorded manually by ${user?.email || 'admin'}. ${adminNote.trim() ? `Note: ${adminNote.trim()}` : ''}`.trim(),
            created_by: user?.email || 'admin',
            created_at: createdAt,
          });
        } catch (histErr) {
          console.warn('[CreateOrderModal] Status history warning:', histErr);
        }

        // Courier & Shipment
        const cleanAwb = awbNumber.trim();
        if (cleanAwb || finalOrderStatus === 'SHIPPED' || finalOrderStatus === 'DELIVERED') {
          try {
            const trackingUrl =
              generateTrackingUrl(carrier as CarrierType, cleanAwb) ||
              (cleanAwb ? `https://www.delhivery.com/track/package/${encodeURIComponent(cleanAwb)}` : null);

            await supabase.from('shipments').insert({
              order_id: newOrder.id,
              carrier,
              awb_number: cleanAwb || null,
              tracking_url: trackingUrl,
              status: finalOrderStatus === 'DELIVERED' ? 'DELIVERED' : 'IN_TRANSIT',
              created_at: createdAt,
            });
          } catch (shipErr) {
            console.warn('[CreateOrderModal] Shipment insertion warning:', shipErr);
          }
        }

        // Payments (non-blocking)
        try {
          await supabase.from('payments').insert({
            order_id: newOrder.id,
            amount_in_paise: totalInPaise,
            status: paymentStatus,
            payment_method: paymentMethod || 'MANUAL_UPI',
            created_at: createdAt,
          });
        } catch (payErr) {
          console.warn('[CreateOrderModal] Payment record warning:', payErr);
        }

        // Client-side audit event (fire-and-forget)
        try {
          const { data: { user } } = await supabase.auth.getUser();
          logAudit({
            actor_id: user?.id,
            actor_email: user?.email,
            action: AUDIT_ACTIONS.ORDER_STATUS_TRANSITION,
            entity: 'orders',
            entity_id: newOrder.order_number,
            new_values: {
              order_number: newOrder.order_number,
              total_in_rupees: totalInPaise / 100,
              customer_name: customerName.trim(),
              order_status: finalOrderStatus,
              payment_status: paymentStatus,
            },
            reason: adminNote.trim() || 'Manual offline sale recorded by studio admin',
          });
        } catch (auditErr) {
          console.warn('[CreateOrderModal] Audit warning:', auditErr);
        }

        orderRecord = {
          id: newOrder.id,
          orderNumber: newOrder.order_number,
          order_number: newOrder.order_number,
          orderStatus: newOrder.order_status,
          order_status: newOrder.order_status,
          paymentStatus: newOrder.payment_status,
          payment_status: newOrder.payment_status,
          totalInRupees: newOrder.total_in_paise / 100,
          total_in_paise: newOrder.total_in_paise,
          createdAt: newOrder.created_at,
          created_at: newOrder.created_at,
        };
      }

      showNotification(`Order #${orderRecord.orderNumber || orderRecord.order_number} successfully recorded!`, 'success');
      onOrderCreated(orderRecord);
      onClose();
    } catch (err: any) {
      console.error('[Create Order Error]:', err);
      setFormError(err.message || 'An unexpected error occurred while saving the order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-bark/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-linen w-full max-w-4xl rounded-atelier-panel shadow-2xl border border-canvas-line max-h-[92vh] flex flex-col overflow-hidden animate-slide-up">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-canvas-line bg-canvas/40 flex items-center justify-between shrink-0">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-rose font-semibold mb-0.5">
              Studio Registry
            </p>
            <h3 className="heading-serif text-xl sm:text-2xl text-bark">
              Record Customer Order
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-ink-light hover:text-bark hover:bg-canvas transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-7">
          {formError && (
            <div className="p-4 rounded-sm bg-rose/10 border border-rose/30 text-rose text-xs flex items-center gap-2.5">
              <AlertCircle size={16} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Section 1: Customer & Delivery Address */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-wider font-bold text-bark flex items-center justify-between border-b border-canvas-line pb-2">
              <span className="flex items-center gap-2">
                <MapPin size={14} className="text-rose" />
                <span>1. Customer &amp; Shipping Details</span>
              </span>
              {isGiftOrder && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose/15 text-rose-deep border border-rose/30 flex items-center gap-1">
                  <Gift size={11} className="text-rose" /> Gift Order Active
                </span>
              )}
            </h4>

            {/* Gifting Toggle Card */}
            <div
              className={`p-3.5 rounded-sm border transition-all ${
                isGiftOrder
                  ? 'bg-rose/10 border-rose/30 shadow-2xs'
                  : 'bg-canvas/30 border-canvas-line hover:border-canvas-line-hover'
              }`}
            >
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                      isGiftOrder ? 'bg-rose text-linen shadow-xs' : 'bg-linen border border-canvas-line text-rose'
                    }`}
                  >
                    <Gift size={14} />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-bark block">
                      Mark as a Gift Delivery
                    </span>
                    <span className="text-[11px] text-ink-light block">
                      Deliver directly to recipient with a complimentary handwritten card (omit price tags &amp; invoices)
                    </span>
                  </div>
                </div>
                <input
                  id="adminIsGiftOrder"
                  type="checkbox"
                  checked={isGiftOrder}
                  onChange={(e) => setIsGiftOrder(e.target.checked)}
                  className="w-4 h-4 accent-rose rounded cursor-pointer"
                />
              </label>

              {isGiftOrder && (
                <div className="mt-3.5 pt-3.5 border-t border-rose/20 space-y-3 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-bark font-semibold mb-1">
                        Recipient Full Name <span className="text-rose">*</span>
                      </label>
                      <input
                        required={isGiftOrder}
                        type="text"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="e.g. Ananya Sharma"
                        className="w-full px-3 py-2 bg-linen border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-bark font-semibold mb-1 flex items-center justify-between">
                        <span>Recipient Mobile <span className="text-rose">*</span></span>
                        <span className="text-[10px] text-rose font-normal">For courier call</span>
                      </label>
                      <input
                        required={isGiftOrder}
                        type="tel"
                        maxLength={10}
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="10-digit mobile"
                        className="w-full px-3 py-2 bg-linen border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-bark font-semibold mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sparkles size={12} className="text-rose" />
                        Handwritten Card Note
                      </span>
                      <span className="text-[10px] text-ink-light font-normal">{giftCardMessage.length}/250 chars</span>
                    </label>
                    <textarea
                      rows={2}
                      maxLength={250}
                      value={giftCardMessage}
                      onChange={(e) => setGiftCardMessage(e.target.value)}
                      placeholder="e.g. Wishing you a wonderful birthday! May your year bloom with joy and happiness."
                      className="w-full px-3 py-2 bg-linen border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Buyer Contact Details Subheader */}
            <div className="pt-1">
              <p className="text-[11px] uppercase tracking-wider text-bark font-semibold flex items-center justify-between">
                <span>{isGiftOrder ? 'Buyer / Sender Details (Payment & Receipt Contact)' : 'Customer Contact Details'}</span>
                {isGiftOrder && (
                  <span className="text-[10px] text-ink-light font-normal">invoice &amp; receipts sent here</span>
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                  Full Name <span className="text-rose">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Radhika Sen"
                  className="w-full px-3 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                  Mobile Number (10 Digits) <span className="text-rose">*</span>
                </label>
                <input
                  required
                  type="tel"
                  maxLength={10}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  className="w-full px-3 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark font-mono"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                  Email Address <span className="text-[10px] text-ink-light">(Optional)</span>
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="radhika@example.com"
                  className="w-full px-3 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                />
              </div>
            </div>

            {/* Destination Address Subheader */}
            <div className="pt-2">
              <p className="text-[11px] uppercase tracking-wider text-bark font-semibold flex items-center justify-between">
                <span>{isGiftOrder ? "Recipient's Delivery Address (Courier Destination)" : 'Delivery Address'}</span>
                {isGiftOrder && (
                  <span className="text-[10px] text-rose font-medium">destination for gift parcel</span>
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                  Address Line 1 <span className="text-rose">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="Flat / House No., Apartment, Street"
                  className="w-full px-3 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                  Address Line 2 <span className="text-[10px] text-ink-light">(Landmark / Area)</span>
                </label>
                <input
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="Near City Park"
                  className="w-full px-3 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                  City <span className="text-rose">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Bengaluru"
                  className="w-full px-3 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                  State <span className="text-rose">*</span>
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                >
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                  PIN Code <span className="text-rose">*</span>
                </label>
                <input
                  required
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="560001"
                  className="w-full px-3 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Purchased Items */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-canvas-line pb-2">
              <h4 className="text-xs uppercase tracking-wider font-bold text-bark flex items-center gap-2">
                <Package size={14} className="text-rose" />
                <span>2. Purchased Items ({items.length})</span>
              </h4>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddCustomItem}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-atelier-btn border border-rose/40 text-rose hover:bg-rose/5 text-xs font-medium transition-colors"
                >
                  <Plus size={13} />
                  <span>+ Custom Bouquet</span>
                </button>
              </div>
            </div>

            {/* Quick Catalog Selector with SKU Search & Code-First Dropdown */}
            <div className="p-3 bg-canvas/40 border border-canvas-line rounded-sm space-y-2.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {/* Live SKU / Name Search Box */}
                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-light pointer-events-none" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCatalogSearch(val);
                      const q = val.toLowerCase().trim();
                      if (q) {
                        const matches = products.filter((p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
                        if (matches.length === 1) {
                          setSelectedProductCode(matches[0].code);
                        } else if (!matches.some((p) => p.code === selectedProductCode)) {
                          setSelectedProductCode('');
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCatalogProduct();
                      }
                    }}
                    placeholder="Search Code / SKU (e.g. K008)..."
                    className="w-full pl-8 pr-7 py-2 bg-white border border-canvas-line rounded-sm text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-bark font-mono"
                  />
                  {catalogSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setCatalogSearch('');
                        setSelectedProductCode('');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-bark p-0.5"
                      title="Clear search"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Dropdown with [Product Code] prominently FIRST */}
                <div className="flex-1">
                  <select
                    value={selectedProductCode}
                    onChange={(e) => setSelectedProductCode(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark font-mono"
                  >
                    <option value="">
                      {filteredProducts.length === 0
                        ? `-- No pieces matching "${catalogSearch}" --`
                        : `-- Choose Piece ([Code] Name — Price) (${filteredProducts.length} pieces) --`}
                    </option>
                    {filteredProducts.map((p) => (
                      <option key={p.code} value={p.code}>
                        [{p.code}] {p.name} — {formatPrice(p.price)}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleAddCatalogProduct}
                  disabled={!selectedProductCode && filteredProducts.length !== 1}
                  className="px-4 py-2 bg-bark text-linen hover:bg-rose-deep text-xs uppercase tracking-wider font-medium rounded-sm disabled:opacity-40 transition-colors shrink-0"
                >
                  Add Item
                </button>
              </div>

              {catalogSearch && (
                <div className="text-[11px] text-ink-light flex items-center justify-between px-1">
                  <span>Found <strong>{filteredProducts.length}</strong> matching piece(s)</span>
                  <span className="font-mono text-[10px] text-rose">SKU / Code is listed first in dropdown</span>
                </div>
              )}
            </div>

            {/* Added Items List */}
            {items.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-canvas-line rounded-sm text-xs text-ink-light">
                <Package size={28} className="mx-auto mb-2 text-rose/60" />
                <p className="font-medium text-bark">No items added yet</p>
                <p className="text-[11px] mt-0.5">Filter by product code above or click "+ Custom Bouquet" to add bespoke offline orders.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((it, idx) => {
                  const effectiveUnit = getItemEffectiveUnitPrice(it);

                  return (
                    <div
                      key={it.id}
                      className="p-3.5 bg-canvas/20 border border-canvas-line rounded-sm space-y-3"
                    >
                      {/* Item Header */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="w-5 h-5 rounded-full bg-rose/15 text-rose text-[11px] font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-[11px] font-mono font-bold bg-bark text-linen px-2 py-0.5 rounded shrink-0 shadow-2xs">
                              [{it.productCode}]
                            </span>
                            {it.isCustom ? (
                              <input
                                type="text"
                                value={it.productName}
                                onChange={(e) => handleUpdateItem(it.id, { productName: e.target.value })}
                                placeholder="Custom Item Name"
                                className="font-medium text-sm text-bark bg-white px-2 py-1 border border-canvas-line rounded-sm w-full max-w-sm"
                              />
                            ) : (
                              <span className="font-medium text-sm text-bark">{it.productName}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-ink-light">Base (₹):</span>
                            <input
                              type="number"
                              min={0}
                              value={it.unitPrice}
                              onChange={(e) =>
                                handleUpdateItem(it.id, { unitPrice: Math.max(0, Number(e.target.value)) })
                              }
                              className="w-20 px-2 py-1 bg-white border border-canvas-line rounded-sm text-xs font-mono font-medium text-bark"
                            />
                          </div>

                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-ink-light">Qty:</span>
                            <input
                              type="number"
                              min={1}
                              value={it.quantity}
                              onChange={(e) =>
                                handleUpdateItem(it.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })
                              }
                              className="w-14 px-2 py-1 bg-white border border-canvas-line rounded-sm text-xs font-mono font-medium text-bark"
                            />
                          </div>

                          <div className="text-right min-w-[80px]">
                            <span className="font-serif font-bold text-bark text-sm block">
                              {formatPrice(effectiveUnit * it.quantity)}
                            </span>
                            {isBouquetItem(it) && it.packagingType === 'silk_wrap' && (
                              <span className="text-[10px] text-rose font-mono">
                                {formatPrice(effectiveUnit)}/ea
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(it.id)}
                            className="p-1.5 text-ink-light hover:text-rose rounded transition-colors"
                            title="Remove item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Bouquet Silk Wrap Upgrade Callout */}
                      {isBouquetItem(it) && it.packagingType === 'silk_wrap' && (
                        <div className="text-[11px] text-ink-light bg-rose/5 px-2.5 py-1 rounded border border-rose/20 flex items-center justify-between flex-wrap gap-2">
                          <span className="font-medium text-rose">
                            ✨ Luxury Silk Wrap Upgrade: +₹{bouquetLuxuryWrapUpgradeFee} × {it.quantity} bouquet(s) = +₹{bouquetLuxuryWrapUpgradeFee * it.quantity}
                          </span>
                          <span className="text-ink-muted text-[10px]">
                            Line Total: {formatPrice(effectiveUnit * it.quantity)}
                          </span>
                        </div>
                      )}

                      {/* Item Configuration (Hue Variant & Wrap Tier) */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-canvas-line/50 text-xs">
                        {/* Hue Variant */}
                        <div className="md:col-span-4">
                          <label className="block text-[10px] uppercase tracking-wider text-ink-light font-semibold mb-1">
                            Hue / Color Variant
                          </label>
                          <input
                            type="text"
                            value={it.selectedColor}
                            onChange={(e) => handleUpdateItem(it.id, { selectedColor: e.target.value })}
                            placeholder="e.g. Blush Pink"
                            className="w-full px-2.5 py-1.5 bg-white border border-canvas-line rounded-sm text-xs text-ink"
                          />
                        </div>

                        {/* Wrap Tier */}
                        <div className="md:col-span-8">
                          {isBouquetItem(it) ? (
                            <div>
                              <label className="block text-[10px] uppercase tracking-wider text-ink-light font-semibold mb-1 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                  <Gift size={11} className="text-rose" />
                                  <span>Bouquet Wrap Tier</span>
                                </span>
                                {it.packagingType === 'silk_wrap' && (
                                  <span className="text-rose font-mono font-semibold">
                                    +₹{bouquetLuxuryWrapUpgradeFee} / bouquet
                                  </span>
                                )}
                              </label>
                              <select
                                value={it.packagingType}
                                onChange={(e) => {
                                  const isSilk = e.target.value === 'silk_wrap';
                                  handleUpdateItem(it.id, {
                                    packagingType: isSilk ? 'silk_wrap' : 'standard',
                                    packagingFee: isSilk ? bouquetLuxuryWrapUpgradeFee : 0,
                                    packagingLabel: isSilk ? 'Luxury Silk Wrap Upgrade' : 'Standard Floral Wrap',
                                  });
                                }}
                                className="w-full px-2.5 py-1.5 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark font-medium"
                              >
                                <option value="standard">Standard Floral Wrap (Included - ₹0)</option>
                                <option value="silk_wrap">
                                  Upgrade to Luxury Silk Wrap (+₹{bouquetLuxuryWrapUpgradeFee} / unit)
                                </option>
                              </select>
                            </div>
                          ) : isStemItem(it) ? (
                            <div>
                              <label className="block text-[10px] uppercase tracking-wider text-ink-light font-semibold mb-1 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                  <Flower2 size={11} className="text-emerald-700" />
                                  <span>Stem Packaging</span>
                                </span>
                                <span className="text-emerald-700 font-mono text-[10px]">Included (₹0)</span>
                              </label>
                              <div className="px-2.5 py-1.5 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-ink flex items-center justify-between">
                                <span className="text-ink">Individual Stem Sleeves</span>
                                <span className="text-[10px] text-ink-light font-mono">₹0 (Included)</span>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label className="block text-[10px] uppercase tracking-wider text-ink-light font-semibold mb-1 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                  <Gift size={11} className="text-ink-light" />
                                  <span>Packaging Tier</span>
                                </span>
                                <span className="text-ink-light font-mono text-[10px]">Included (₹0)</span>
                              </label>
                              <div className="px-2.5 py-1.5 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-ink flex items-center justify-between">
                                <span className="text-ink">Standard Studio Packaging</span>
                                <span className="text-[10px] text-ink-light font-mono">₹0 (Included)</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Loose Stems Bouquet Assembly Banner (Only when loose stems are added) */}
            {hasStems && (
              <div className="p-3.5 bg-linen/80 border border-bark/20 rounded-sm space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-bark flex items-center gap-1.5">
                    <Flower2 size={13} className="text-rose" />
                    Loose Stems Arrangement ({totalStemCount} stem{totalStemCount === 1 ? '' : 's'} in order)
                  </span>
                  <span className="text-[10px] text-ink-light font-mono">Artisan Florist Assembly</span>
                </div>
                <p className="text-[11px] text-ink-light leading-relaxed">
                  Choose whether to keep these loose stems in individual protective sleeves, or bundle and wrap all of them together into 1 custom finished bouquet.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                  <label
                    className={`p-2.5 rounded-sm border cursor-pointer flex items-center justify-between transition-colors ${
                      !bundleStemsIntoBouquet
                        ? 'border-bark bg-white font-medium shadow-2xs'
                        : 'border-canvas-line bg-canvas/30 text-ink-light hover:bg-white/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="stemAssembly"
                        checked={!bundleStemsIntoBouquet}
                        onChange={() => setBundleStemsIntoBouquet(false)}
                        className="accent-bark cursor-pointer"
                      />
                      <span>Keep in Individual Stem Sleeves</span>
                    </div>
                    <span className="font-mono text-[10px] text-ink-muted">Included (₹0)</span>
                  </label>
                  <label
                    className={`p-2.5 rounded-sm border cursor-pointer flex items-center justify-between transition-colors ${
                      bundleStemsIntoBouquet
                        ? 'border-rose bg-rose/5 font-medium text-bark shadow-2xs'
                        : 'border-canvas-line bg-canvas/30 text-ink-light hover:bg-white/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="stemAssembly"
                        checked={bundleStemsIntoBouquet}
                        onChange={() => setBundleStemsIntoBouquet(true)}
                        className="accent-rose cursor-pointer"
                      />
                      <span>Bundle all stems into 1 Bouquet Wrap</span>
                    </div>
                    <span className="font-mono text-xs text-rose font-bold">+₹{stemBouquetWrapFee} Flat</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Master Parcel Presentation & Keepsake Packaging (Order-Level) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-canvas-line pb-2">
              <h4 className="text-xs uppercase tracking-wider font-bold text-bark flex items-center gap-2">
                <Gift size={14} className="text-rose" />
                <span>3. Master Parcel Presentation &amp; Keepsake Packaging</span>
              </h4>
              <span className="text-[11px] text-ink-light font-normal">encloses entire order in one parcel</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Standard Studio Parcel */}
              <label
                className={`p-3 rounded-sm border cursor-pointer flex flex-col justify-between transition-colors ${
                  masterPackaging === 'standard'
                    ? 'border-bark bg-white shadow-2xs'
                    : 'border-canvas-line bg-canvas/30 text-ink-light hover:bg-white/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="masterPackaging"
                        checked={masterPackaging === 'standard'}
                        onChange={() => setMasterPackaging('standard')}
                        className="accent-bark cursor-pointer"
                      />
                      <span className="font-semibold text-bark">Standard Studio Parcel</span>
                    </div>
                    <span className="font-mono text-[10px] text-ink-muted">Included (₹0)</span>
                  </div>
                  <p className="text-[11px] text-ink-light pl-5 leading-relaxed">
                    Signature studio floral wrapping paper &amp; secure kraft parcel shipping box.
                  </p>
                </div>
              </label>

              {/* Luxury Rigid Keepsake Box */}
              <label
                className={`p-3 rounded-sm border cursor-pointer flex flex-col justify-between transition-colors ${
                  masterPackaging === 'gift_box'
                    ? 'border-rose bg-rose/5 shadow-2xs'
                    : 'border-canvas-line bg-canvas/30 text-ink-light hover:bg-white/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="masterPackaging"
                        checked={masterPackaging === 'gift_box'}
                        onChange={() => setMasterPackaging('gift_box')}
                        className="accent-rose cursor-pointer"
                      />
                      <span className="font-semibold text-bark">Luxury Rigid Gift Box &amp; Ribbon</span>
                    </div>
                    <span className="font-mono text-xs text-rose font-bold">
                      +₹{luxuryGiftBoxFee} {masterBoxCount > 1 ? `× ${masterBoxCount} = ₹${masterGiftBoxTotal}` : 'Flat'}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-light pl-5 leading-relaxed">
                    Premium rigid keepsake hardboard box with satin bow. All bouquets, stems, and gifts come within it.
                  </p>
                </div>
                {masterPackaging === 'gift_box' && (
                  <div className="mt-2.5 pl-5 pt-2 border-t border-rose/20 flex items-center gap-2 text-[11px] text-ink">
                    <span className="text-ink-light font-medium">Box Quantity:</span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={masterBoxCount}
                      onChange={(e) => setMasterBoxCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-14 px-2 py-0.5 bg-white border border-canvas-line rounded text-xs font-mono font-medium text-bark"
                    />
                    <span className="text-[10px] text-ink-light">(default 1 box contains entire order)</span>
                  </div>
                )}
              </label>
            </div>

            {/* Order Gift Cards & Personal Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Handwritten Greeting Card */}
              <div
                className={`p-3 rounded-sm border transition-colors ${
                  effectiveGreetingCard ? 'border-rose/50 bg-white shadow-2xs' : 'border-canvas-line bg-canvas/20'
                }`}
              >
                <label className="flex items-center justify-between cursor-pointer mb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={addGreetingCard || (isGiftOrder && Boolean(giftCardMessage.trim()))}
                      onChange={(e) => {
                        setAddGreetingCard(e.target.checked);
                        if (!e.target.checked && isGiftOrder) {
                          setGiftCardMessage('');
                        }
                      }}
                      className="accent-rose rounded cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-bark">✍️ Handwritten Greeting Card</span>
                  </div>
                  <span className="font-mono text-xs text-rose font-bold">+₹{greetingCardFee} Flat</span>
                </label>
                {(addGreetingCard || isGiftOrder) && (
                  <textarea
                    rows={2}
                    maxLength={250}
                    value={greetingCardText || giftCardMessage}
                    onChange={(e) => {
                      setGreetingCardText(e.target.value);
                      if (isGiftOrder) setGiftCardMessage(e.target.value);
                    }}
                    placeholder="e.g. Wishing you a wonderful birthday filled with warmth and bloom!"
                    className="w-full px-2.5 py-1.5 bg-linen border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark resize-none"
                  />
                )}
              </div>

              {/* Artisan Wax-Sealed Note */}
              <div
                className={`p-3 rounded-sm border transition-colors ${
                  addPersonalNote ? 'border-rose/50 bg-white shadow-2xs' : 'border-canvas-line bg-canvas/20'
                }`}
              >
                <label className="flex items-center justify-between cursor-pointer mb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={addPersonalNote}
                      onChange={(e) => setAddPersonalNote(e.target.checked)}
                      className="accent-rose rounded cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-bark">💌 Artisan Wax-Sealed Note</span>
                  </div>
                  <span className="font-mono text-xs text-rose font-bold">+₹{personalisedMessageFee} Flat</span>
                </label>
                {addPersonalNote && (
                  <textarea
                    rows={2}
                    maxLength={200}
                    value={personalNoteText}
                    onChange={(e) => setPersonalNoteText(e.target.value)}
                    placeholder="e.g. Handcrafted with love and care for your home."
                    className="w-full px-2.5 py-1.5 bg-linen border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark resize-none"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Pricing & Payment Settlement */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-canvas-line pb-2">
              <h4 className="text-xs uppercase tracking-wider font-bold text-bark flex items-center gap-2">
                <DollarSign size={14} className="text-emerald-700" />
                <span>4. Pricing &amp; Payment Details</span>
              </h4>
              {totalPackagingAndGifting > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                  {bouquetSilkWrapsTotal > 0 && (
                    <span className="bg-rose/10 text-rose px-1.5 py-0.5 rounded font-mono">
                      Silk Wrap: +₹{bouquetSilkWrapsTotal}
                    </span>
                  )}
                  {stemBundleTotal > 0 && (
                    <span className="bg-rose/10 text-rose px-1.5 py-0.5 rounded font-mono">
                      Stem Bouquet: +₹{stemBundleTotal}
                    </span>
                  )}
                  {masterGiftBoxTotal > 0 && (
                    <span className="bg-rose/10 text-rose px-1.5 py-0.5 rounded font-mono">
                      Rigid Box: +₹{masterGiftBoxTotal}
                    </span>
                  )}
                  {greetingCardTotal > 0 && (
                    <span className="bg-rose/10 text-rose px-1.5 py-0.5 rounded font-mono">
                      Card: +₹{greetingCardTotal}
                    </span>
                  )}
                  {personalNoteTotal > 0 && (
                    <span className="bg-rose/10 text-rose px-1.5 py-0.5 rounded font-mono">
                      Note: +₹{personalNoteTotal}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                  Base Subtotal
                </label>
                <div className="px-3 py-2 bg-canvas/40 border border-canvas-line rounded-sm font-serif font-bold text-bark text-sm">
                  {formatPrice(baseItemsSubtotal)}
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1 flex items-center justify-between">
                  <span>Packaging &amp; Notes</span>
                </label>
                <div className="px-3 py-2 bg-rose/5 border border-rose/20 rounded-sm font-mono font-bold text-rose text-sm">
                  +{formatPrice(totalPackagingAndGifting)}
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                  Discount (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={discountRupees}
                  onChange={(e) =>
                    setDiscountRupees(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))
                  }
                  placeholder="0"
                  className="w-full px-3 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark font-mono"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                  Shipping Fee (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={shippingFeeRupees}
                  onChange={(e) =>
                    setShippingFeeRupees(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))
                  }
                  placeholder="0"
                  className="w-full px-3 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark font-mono"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                  Net Total (Payable)
                </label>
                <div className="px-3 py-2 bg-[#F0F5EE] border border-[#D1E0CD] rounded-sm font-serif font-bold text-[#2D5A27] text-base">
                  {formatPrice(netTotal)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                  Payment Status
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                >
                  <option value="SUCCESS">SUCCESS (Paid in Full)</option>
                  <option value="PENDING">PENDING (Awaiting Payment)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                >
                  <option value="MANUAL_UPI">Studio UPI (Google Pay, PhonePe, Paytm)</option>
                  <option value="CASH">Cash at Studio / Cash on Delivery</option>
                  <option value="BANK_TRANSFER">Direct Bank Transfer (NEFT / IMPS)</option>
                  <option value="ONLINE">Online Payment Gateway</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 5: Order Status, Historical Date & Delhivery Tracking */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-wider font-bold text-bark flex items-center gap-2 border-b border-canvas-line pb-2">
              <Calendar size={14} className="text-rose" />
              <span>5. Fulfillment, Date &amp; Courier Tracking</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                  Initial Order Status
                </label>
                <select
                  value={orderStatus}
                  onChange={(e) => setOrderStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                >
                  <option value="PAYMENT_CONFIRMED">PAYMENT_CONFIRMED (Paid &amp; Queued)</option>
                  <option value="PENDING_PAYMENT">PENDING_PAYMENT (Awaiting UPI)</option>
                  <option value="PROCESSING">PROCESSING (In Handcrafting)</option>
                  <option value="PACKED">PACKED (Packed &amp; Ready)</option>
                  <option value="SHIPPED">SHIPPED (Handed to Carrier)</option>
                  <option value="DELIVERED">DELIVERED (Already Delivered to Patron)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                  Purchase Date
                </label>
                <div className="space-y-2">
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="dateMode"
                        checked={!isHistoricalDate}
                        onChange={() => setIsHistoricalDate(false)}
                        className="text-rose accent-rose"
                      />
                      <span>Today (Current Time)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="dateMode"
                        checked={isHistoricalDate}
                        onChange={() => setIsHistoricalDate(true)}
                        className="text-rose accent-rose"
                      />
                      <span>Specific Past Date</span>
                    </label>
                  </div>
                  {isHistoricalDate && (
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-canvas-line rounded-sm text-xs text-ink font-mono"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Courier Tracking Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                  Courier Partner
                </label>
                <select
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value as CarrierType)}
                  className="w-full px-3 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                >
                  {SUPPORTED_CARRIERS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                  Waybill (AWB) Number <span className="text-[10px] text-ink-light">(Delhivery tracking)</span>
                </label>
                <input
                  type="text"
                  value={awbNumber}
                  onChange={(e) => setAwbNumber(e.target.value)}
                  placeholder="e.g. 148291049281"
                  className="w-full px-3 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                Internal Studio Memo / Note
              </label>
              <input
                type="text"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="e.g. Offline order from studio patron via WhatsApp · GPay confirmed"
                className="w-full px-3 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
              />
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-4 border-t border-canvas-line flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-canvas-line text-xs uppercase tracking-wider font-medium text-ink hover:bg-canvas/40 rounded-sm transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || items.length === 0}
              className="px-7 py-2.5 bg-bark text-linen hover:bg-rose-deep text-xs uppercase tracking-wider font-medium rounded-sm flex items-center gap-2 transition-all disabled:opacity-50 shadow-md"
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Recording Order...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  <span>Record Order in Archive</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
