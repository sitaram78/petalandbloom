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
} from 'lucide-react';
import { useProducts } from '@/context/ProductContext';
import { useNotification } from '@/context/NotificationContext';
import { authFetch } from '@/lib/apiClient';
import { formatPrice } from '@/data/products';
import { INDIAN_STATES } from '@/pages/Account';
import { SUPPORTED_CARRIERS, CarrierType } from '@/services/shippingService';

export interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: (newOrder: any) => void;
}

interface OrderItemForm {
  id: string;
  productCode: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  selectedColor: string;
  giftWrap: boolean;
  personalMessage: string;
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

  // Form State: Customer
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  // Form State: Address
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Karnataka');
  const [pincode, setPincode] = useState('');

  // Form State: Items
  const [items, setItems] = useState<OrderItemForm[]>([]);
  const [selectedProductCode, setSelectedProductCode] = useState('');

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
    if (!selectedProductCode) return;
    const prod = products.find((p) => p.code === selectedProductCode);
    if (!prod) return;

    const newItem: OrderItemForm = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      productCode: prod.code,
      productName: prod.name,
      unitPrice: prod.price,
      quantity: 1,
      selectedColor: prod.colors?.[0] || 'Default',
      giftWrap: false,
      personalMessage: '',
      itemImage: prod.images?.[0] || '',
      isCustom: false,
    };

    setItems([...items, newItem]);
    setSelectedProductCode('');
    setFormError(null);
  };

  // Add Custom Bespoke Piece
  const handleAddCustomItem = () => {
    const customItem: OrderItemForm = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      productCode: `BESPOKE-${Date.now().toString().slice(-4)}`,
      productName: 'Bespoke Handmade Floral Arrangement',
      unitPrice: 499,
      quantity: 1,
      selectedColor: 'Custom Palette',
      giftWrap: false,
      personalMessage: '',
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
  const subtotal = items.reduce((sum, it) => sum + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1), 0);
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
      setFormError('Please enter a valid 10-digit Indian mobile phone number.');
      return;
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
      const payload = {
        customer: {
          name: customerName.trim(),
          phone: cleanPhone,
          email: customerEmail.trim() || undefined,
        },
        shippingAddress: {
          recipientName: customerName.trim(),
          phone: cleanPhone,
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || undefined,
          city: city.trim(),
          state: state.trim(),
          pincode: cleanPincode,
        },
        items: items.map((it) => ({
          productCode: it.productCode,
          productName: it.productName,
          unitPriceInRupees: Number(it.unitPrice) || 0,
          quantity: Number(it.quantity) || 1,
          selectedColor: it.selectedColor || undefined,
          giftWrap: it.giftWrap,
          personalMessage: it.personalMessage || undefined,
          itemImage: it.itemImage || undefined,
        })),
        discountInRupees: discountVal,
        shippingFeeInRupees: shippingVal,
        orderStatus,
        paymentStatus,
        paymentMethod,
        orderDate: isHistoricalDate && customDate ? new Date(customDate).toISOString() : undefined,
        adminNote: adminNote.trim() || undefined,
        shipment:
          awbNumber.trim() || orderStatus === 'SHIPPED' || orderStatus === 'DELIVERED'
            ? {
                carrier,
                awbNumber: awbNumber.trim() || undefined,
              }
            : undefined,
      };

      const res = await authFetch('/api/admin/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to create order on server.');
      }

      showNotification(`Order #${data.order.orderNumber} successfully recorded!`, 'success');
      onOrderCreated(data.order);
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
            <h4 className="text-xs uppercase tracking-wider font-bold text-bark flex items-center gap-2 border-b border-canvas-line pb-2">
              <MapPin size={14} className="text-rose" />
              <span>1. Customer &amp; Shipping Details</span>
            </h4>

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

            {/* Quick Catalog Selector */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 bg-canvas/40 border border-canvas-line rounded-sm">
              <div className="flex-1">
                <select
                  value={selectedProductCode}
                  onChange={(e) => setSelectedProductCode(e.target.value)}
                  className="w-full px-3 py-2 bg-linen border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                >
                  <option value="">-- Choose from Botanical Catalog --</option>
                  {products.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name} ({p.code}) — {formatPrice(p.price)}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleAddCatalogProduct}
                disabled={!selectedProductCode}
                className="px-4 py-2 bg-bark text-linen hover:bg-rose-deep text-xs uppercase tracking-wider font-medium rounded-sm disabled:opacity-40 transition-colors shrink-0"
              >
                Add Item
              </button>
            </div>

            {/* Added Items List */}
            {items.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-canvas-line rounded-sm text-xs text-ink-light">
                <Package size={28} className="mx-auto mb-2 text-rose/60" />
                <p className="font-medium text-bark">No items added yet</p>
                <p className="text-[11px] mt-0.5">Select a catalog piece above or click "+ Custom Bouquet" to add bespoke offline orders.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((it, idx) => (
                  <div
                    key={it.id}
                    className="p-3.5 bg-canvas/20 border border-canvas-line rounded-sm space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-rose/15 text-rose text-[11px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
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
                          <span className="text-[10px] font-mono bg-canvas px-1.5 py-0.5 rounded text-ink-light">
                            {it.productCode}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-ink-light">Price (₹):</span>
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

                        <span className="font-serif font-semibold text-bark text-sm w-20 text-right">
                          {formatPrice(it.unitPrice * it.quantity)}
                        </span>

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

                    {/* Secondary Item Options (Color, Gift wrap, Message) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-canvas-line/50 text-xs">
                      <div>
                        <input
                          type="text"
                          value={it.selectedColor}
                          onChange={(e) => handleUpdateItem(it.id, { selectedColor: e.target.value })}
                          placeholder="Color / Variant (e.g. Blush Pink)"
                          className="w-full px-2.5 py-1 bg-white border border-canvas-line rounded-sm text-[11px] text-ink"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-[11px] text-ink cursor-pointer">
                          <input
                            type="checkbox"
                            checked={it.giftWrap}
                            onChange={(e) => handleUpdateItem(it.id, { giftWrap: e.target.checked })}
                            className="rounded text-rose accent-rose"
                          />
                          <span>🎁 Gift Wrap Included</span>
                        </label>
                      </div>

                      <div>
                        <input
                          type="text"
                          value={it.personalMessage}
                          onChange={(e) => handleUpdateItem(it.id, { personalMessage: e.target.value })}
                          placeholder="Gift card message (optional)"
                          className="w-full px-2.5 py-1 bg-white border border-canvas-line rounded-sm text-[11px] text-ink"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Financials & Payment Settlement */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-wider font-bold text-bark flex items-center gap-2 border-b border-canvas-line pb-2">
              <DollarSign size={14} className="text-emerald-700" />
              <span>3. Pricing &amp; Payment Details</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                  Items Subtotal
                </label>
                <div className="px-3 py-2 bg-canvas/40 border border-canvas-line rounded-sm font-serif font-bold text-bark text-sm">
                  {formatPrice(subtotal)}
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

          {/* Section 4: Order Status, Historical Date & Delhivery Tracking */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-wider font-bold text-bark flex items-center gap-2 border-b border-canvas-line pb-2">
              <Calendar size={14} className="text-rose" />
              <span>4. Fulfillment, Date &amp; Courier Tracking</span>
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
