import React from 'react';
import { Printer, X, Package, ShieldAlert } from 'lucide-react';
import { InvoiceOrderData, INVOICE_STORE_CONFIG } from './InvoiceModal';
import { useStoreSettings } from '@/context/StoreSettingsContext';

interface PackingSlipModalProps {
  order: InvoiceOrderData;
  carrierName?: string;
  awbNumber?: string;
  onClose: () => void;
}

export default function PackingSlipModal({
  order,
  carrierName = 'Surface Courier / Delhivery',
  awbNumber = '',
  onClose,
}: PackingSlipModalProps) {
  const { settings } = useStoreSettings();
  const storeConfig = {
    legalBusinessName: settings.legalBusinessName || INVOICE_STORE_CONFIG.legalBusinessName,
    studioAddress: settings.studioAddress || INVOICE_STORE_CONFIG.studioAddress,
    phone: settings.whatsappNumber || INVOICE_STORE_CONFIG.phone,
  };

  const handlePrint = () => {
    window.print();
  };

  const addr = order.shipping_address_snapshot;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bark/70 backdrop-blur-sm print:p-0 print:bg-white">
      <div className="bg-white text-ink w-full max-w-md max-h-[92vh] overflow-y-auto rounded-sm shadow-xl flex flex-col print:max-h-none print:shadow-none print:w-full print:max-w-none">
        {/* Controls (Hidden in Print) */}
        <div className="p-3.5 bg-linen border-b border-canvas-line flex items-center justify-between print:hidden">
          <span className="font-serif font-semibold text-bark text-sm">4×6 Shipping &amp; Packing Label</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-bark text-linen text-xs uppercase tracking-wider font-medium rounded-sm flex items-center gap-1.5 hover:bg-rose-deep transition-all"
            >
              <Printer size={14} />
              Print Label
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-ink-light hover:text-bark rounded-sm border border-canvas-line"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 4x6 Thermal Label Container (Standard 4" x 6" proportions) */}
        <div className="p-6 font-sans text-xs border border-gray-300 m-4 rounded print:m-0 print:border-none print:p-4 space-y-4">
          {/* Header & Carrier */}
          <div className="flex justify-between items-start border-b-2 border-black pb-3">
            <div>
              <p className="font-serif font-bold text-lg text-black tracking-wider">THE PETAL &amp; BLOOM</p>
              <p className="text-[10px] uppercase font-bold text-gray-700">Handmade Floral Atelier</p>
            </div>
            <div className="text-right">
              <span className="px-2 py-0.5 border border-black font-bold uppercase text-[10px] rounded">
                SURFACE STANDARD
              </span>
              <p className="text-[10px] font-mono text-gray-800 mt-1 font-semibold">{carrierName}</p>
            </div>
          </div>

          {/* Barcode & AWB Strip */}
          <div className="text-center py-2 bg-gray-50 border border-gray-300 rounded font-mono">
            <div className="text-lg tracking-[0.25em] font-black text-black select-all">
              {awbNumber ? awbNumber : `*${order.order_number}*`}
            </div>
            <p className="text-[9px] text-gray-500 uppercase mt-0.5">
              Order: {order.order_number} {awbNumber && `· AWB: ${awbNumber}`}
            </p>
          </div>

          {/* Deliver To (Recipient) */}
          <div className="border-b-2 border-black pb-3">
            <p className="text-[10px] uppercase font-black text-gray-600 tracking-wider">SHIP TO / DELIVER TO:</p>
            <p className="text-base font-bold text-black mt-0.5">{addr.recipientName}</p>
            <p className="text-xs text-gray-800 font-medium leading-relaxed">
              {addr.addressLine1}
              {addr.addressLine2 ? `, ${addr.addressLine2}` : ''}
            </p>
            <p className="text-sm font-bold text-black mt-1">
              {addr.city}, {addr.state} — <span className="font-mono text-base underline">{addr.pincode}</span>
            </p>
            <p className="text-xs font-bold text-black mt-1 font-mono">
              Contact: {addr.phone}
            </p>
          </div>

          {/* Items Summary & Gift Messages */}
          <div className="border-b border-gray-300 pb-3">
            <p className="text-[10px] uppercase font-bold text-gray-600 mb-1.5 flex items-center gap-1">
              <Package size={12} />
              Enclosed Botanical Items ({order.order_items.reduce((s, i) => s + i.quantity, 0)} pcs)
            </p>
            <div className="space-y-1.5 text-[11px]">
              {order.order_items.map((item) => (
                <div key={item.id} className="flex justify-between items-start">
                  <div>
                    <span className="font-semibold text-black">{item.quantity}× {item.product_name}</span>
                    {item.selected_color && (
                      <span className="text-gray-600 text-[10px] ml-1">({item.selected_color})</span>
                    )}
                    {item.personal_message && (
                      <div className="text-[10px] text-gray-800 italic bg-gray-100 p-1 rounded mt-0.5">
                        Gift note: &ldquo;{item.personal_message}&rdquo;
                      </div>
                    )}
                  </div>
                  <span className="font-mono text-gray-500 text-[10px]">{item.product_code}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sender & Return Address */}
          <div className="text-[10px] text-gray-600 pt-1 flex justify-between items-end">
            <div>
              <p className="font-bold text-black uppercase">Return If Undelivered:</p>
              <p>{storeConfig.legalBusinessName}</p>
              <p>{storeConfig.studioAddress}</p>
              <p>Helpline: {storeConfig.phone}</p>
            </div>
            <div className="border border-black px-2 py-1 text-center font-bold text-[9px] uppercase">
              FRAGILE<br />HANDMADE
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
