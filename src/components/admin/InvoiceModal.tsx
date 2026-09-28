import React from 'react';
import { Printer, X, Download } from 'lucide-react';
import { formatPrice } from '@/data/products';
import { useStoreSettings } from '@/context/StoreSettingsContext';

export interface InvoiceOrderData {
  order_number: string;
  created_at: string;
  guest_name: string;
  guest_phone: string;
  guest_email?: string;
  shipping_address_snapshot: {
    recipientName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  subtotal_in_paise: number;
  discount_in_paise: number;
  loyalty_discount_in_paise: number;
  loyalty_points_redeemed?: number;
  shipping_fee_in_paise: number;
  total_in_paise: number;
  payment_status: string;
  applied_coupon_code?: string;
  order_items: Array<{
    id: string;
    product_name: string;
    product_code: string;
    quantity: number;
    unit_price_in_paise: number;
    selected_color?: string | null;
    gift_wrap?: boolean;
    personal_message?: string | null;
  }>;
}

interface InvoiceModalProps {
  order: InvoiceOrderData;
  onClose: () => void;
}

// Configurable Business & Tax Placeholders (Configured easily by store owner)
export const INVOICE_STORE_CONFIG = {
  legalBusinessName: 'The Petal & Bloom Studio',
  gstin: 'GSTIN-PENDING-UNREGISTERED', // Replace with valid GSTIN once registered (e.g. 19AAAAA0000A1Z5)
  pan: 'PAN-ON-FILE',
  studioAddress: 'Handmade Floral Craft Studio, India',
  phone: '+91 9931653303',
  email: 'concierge@thepetalandbloom.com',
  website: 'https://thepetalandbloom.com',
  hsnSacCode: '56090090', // HSN code for handcrafted textile/yarn articles & decorative florals
  stateCode: 'Pan-India',
};

export default function InvoiceModal({ order, onClose }: InvoiceModalProps) {
  const { settings } = useStoreSettings();
  const storeConfig = {
    legalBusinessName: settings.legalBusinessName || INVOICE_STORE_CONFIG.legalBusinessName,
    gstin: settings.gstin || INVOICE_STORE_CONFIG.gstin,
    pan: INVOICE_STORE_CONFIG.pan,
    studioAddress: settings.studioAddress || INVOICE_STORE_CONFIG.studioAddress,
    phone: settings.whatsappNumber || INVOICE_STORE_CONFIG.phone,
    email: settings.supportEmail || INVOICE_STORE_CONFIG.email,
    website: INVOICE_STORE_CONFIG.website,
    hsnSacCode: INVOICE_STORE_CONFIG.hsnSacCode,
    stateCode: INVOICE_STORE_CONFIG.stateCode,
  };

  const handlePrint = () => {
    window.print();
  };

  const invoiceDate = new Date(order.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const addr = order.shipping_address_snapshot;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bark/70 backdrop-blur-sm print:p-0 print:bg-white">
      <div className="bg-white text-ink w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-sm shadow-xl flex flex-col print:max-h-none print:shadow-none print:overflow-visible">
        {/* Modal Controls (Hidden in Print) */}
        <div className="p-4 bg-linen border-b border-canvas-line flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-serif font-semibold text-bark">Tax Invoice Preview</span>
            <span className="text-xs text-ink-light font-mono">({order.order_number})</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-bark text-linen text-xs uppercase tracking-wider font-medium rounded-sm flex items-center gap-1.5 hover:bg-rose-deep transition-all"
            >
              <Printer size={15} />
              Print / Save as PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-ink-light hover:text-bark rounded-sm border border-canvas-line"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div id="tax-invoice-printable" className="p-8 sm:p-12 print:p-8 space-y-8 font-sans text-xs">
          {/* Header & Seller Metadata */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-gray-300 pb-6">
            <div>
              <h1 className="font-serif text-3xl font-bold text-bark tracking-tight">THE PETAL &amp; BLOOM</h1>
              <p className="text-xs uppercase tracking-[0.2em] text-rose font-medium mt-1">Bespoke Handcrafted Florals &amp; Gifts</p>
              <div className="mt-3 text-[11px] text-gray-600 space-y-0.5">
                <p className="font-medium text-gray-900">{storeConfig.legalBusinessName}</p>
                <p>{storeConfig.studioAddress}</p>
                <p>Phone: {storeConfig.phone} · Email: {storeConfig.email}</p>
                <p className="font-mono text-[10px] text-gray-500 pt-1">
                  GSTIN: <span className="font-semibold text-gray-800">{storeConfig.gstin}</span>
                </p>
              </div>
            </div>

            <div className="text-right sm:text-right w-full sm:w-auto">
              <span className="inline-block px-3 py-1 bg-gray-100 text-gray-800 font-bold uppercase tracking-widest text-[11px] rounded">
                TAX INVOICE
              </span>
              <table className="mt-3 text-[11px] ml-auto text-left">
                <tbody>
                  <tr>
                    <td className="pr-3 text-gray-500">Invoice No:</td>
                    <td className="font-mono font-bold text-gray-900">INV-{order.order_number}</td>
                  </tr>
                  <tr>
                    <td className="pr-3 text-gray-500">Invoice Date:</td>
                    <td className="font-medium text-gray-800">{invoiceDate}</td>
                  </tr>
                  <tr>
                    <td className="pr-3 text-gray-500">Payment Status:</td>
                    <td className="font-semibold text-emerald-700 uppercase">{order.payment_status}</td>
                  </tr>
                  <tr>
                    <td className="pr-3 text-gray-500">HSN/SAC:</td>
                    <td className="font-mono text-gray-700">{INVOICE_STORE_CONFIG.hsnSacCode}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Billed To & Shipped To Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-gray-50 p-4 rounded border border-gray-200 text-[11px]">
            <div>
              <p className="uppercase tracking-wider font-bold text-gray-600 mb-1.5 text-[10px]">Billed To / Customer</p>
              <p className="font-semibold text-gray-900 text-sm">{order.guest_name}</p>
              <p className="text-gray-700">Phone: {order.guest_phone}</p>
              {order.guest_email && <p className="text-gray-700">Email: {order.guest_email}</p>}
            </div>

            <div>
              <p className="uppercase tracking-wider font-bold text-gray-600 mb-1.5 text-[10px]">Shipped To</p>
              <p className="font-semibold text-gray-900 text-sm">{addr.recipientName}</p>
              <p className="text-gray-700">{addr.addressLine1}</p>
              {addr.addressLine2 && <p className="text-gray-700">{addr.addressLine2}</p>}
              <p className="text-gray-900 font-medium">
                {addr.city}, {addr.state} - <span className="font-mono font-bold">{addr.pincode}</span>
              </p>
              <p className="text-gray-700">Delivery Phone: {addr.phone}</p>
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <table className="w-full text-left border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100 text-gray-700 uppercase tracking-wider text-[10px]">
                  <th className="p-3 border border-gray-300">#</th>
                  <th className="p-3 border border-gray-300">Description of Goods</th>
                  <th className="p-3 border border-gray-300">HSN</th>
                  <th className="p-3 border border-gray-300 text-right">Qty</th>
                  <th className="p-3 border border-gray-300 text-right">Unit Price</th>
                  <th className="p-3 border border-gray-300 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-[11px]">
                {order.order_items.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="p-3 border border-gray-300 text-gray-500 font-mono">{idx + 1}</td>
                    <td className="p-3 border border-gray-300">
                      <p className="font-semibold text-gray-900">{item.product_name}</p>
                      <p className="text-[10px] text-gray-500 font-mono">Code: {item.product_code}</p>
                      {item.selected_color && (
                        <p className="text-[10px] text-gray-600">Color/Shade: {item.selected_color}</p>
                      )}
                      {item.gift_wrap && (
                        <p className="text-[10px] text-amber-700 font-medium">🎁 Atelier Gift Wrapped</p>
                      )}
                    </td>
                    <td className="p-3 border border-gray-300 font-mono text-[10px] text-gray-600">
                      {INVOICE_STORE_CONFIG.hsnSacCode}
                    </td>
                    <td className="p-3 border border-gray-300 text-right font-mono font-semibold">{item.quantity}</td>
                    <td className="p-3 border border-gray-300 text-right font-mono">
                      {formatPrice(item.unit_price_in_paise / 100)}
                    </td>
                    <td className="p-3 border border-gray-300 text-right font-mono font-semibold">
                      {formatPrice((item.unit_price_in_paise * item.quantity) / 100)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Notes */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2">
            <div className="w-full sm:max-w-xs text-[10px] text-gray-500 space-y-1">
              <p className="font-bold text-gray-700 uppercase">Terms &amp; Crafting Declaration:</p>
              <p>• All products are handcrafted and made-to-order individually by our artisans.</p>
              <p>• Because each piece is customized, creations are non-cancellable once crafting starts.</p>
              <p>• This is a computer-generated invoice; no physical signature required.</p>
            </div>

            <div className="w-full sm:w-64 space-y-1.5 text-xs text-right border-t sm:border-t-0 pt-3 sm:pt-0">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span className="font-mono">{formatPrice(order.subtotal_in_paise / 100)}</span>
              </div>
              {order.discount_in_paise > 0 && (
                <div className="flex justify-between text-rose font-medium">
                  <span>Coupon ({order.applied_coupon_code}):</span>
                  <span className="font-mono">-{formatPrice(order.discount_in_paise / 100)}</span>
                </div>
              )}
              {order.loyalty_discount_in_paise > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Petal Points ({order.loyalty_points_redeemed} pts):</span>
                  <span className="font-mono">-{formatPrice(order.loyalty_discount_in_paise / 100)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Shipping &amp; Packaging:</span>
                <span className="font-mono">
                  {order.shipping_fee_in_paise > 0 ? formatPrice(order.shipping_fee_in_paise / 100) : 'FREE'}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-400">
                <span>Total Amount:</span>
                <span className="font-mono text-base text-rose font-bold">
                  {formatPrice(order.total_in_paise / 100)}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 pt-1">Inclusive of all taxes</p>
            </div>
          </div>

          {/* Footer Signature */}
          <div className="pt-8 border-t border-gray-200 flex justify-between items-end text-[10px] text-gray-500">
            <div>
              <p className="font-serif italic text-bark text-xs">“Flowers that never fade. Gifts that stay.”</p>
              <p>The Petal &amp; Bloom · www.thepetalandbloom.com</p>
            </div>
            <div className="text-right">
              <div className="h-10 border-b border-gray-300 w-36 mb-1 ml-auto"></div>
              <p className="font-medium text-gray-800">Authorized Signatory</p>
              <p className="text-gray-500">{storeConfig.legalBusinessName}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
