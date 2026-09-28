import React, { useState } from 'react';
import { Truck, Package, MapPin, X, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { InvoiceOrderData } from './InvoiceModal';
import { CarrierType, SUPPORTED_CARRIERS } from '@/services/shippingService';
import { formatPrice } from '@/data/products';

interface CourierBookingModalProps {
  order: InvoiceOrderData;
  onClose: () => void;
  onConfirmBooking: (carrier: CarrierType, awbNumber: string, note: string) => Promise<void>;
}

export default function CourierBookingModal({
  order,
  onClose,
  onConfirmBooking,
}: CourierBookingModalProps) {
  const totalItemCount = order.order_items.reduce((sum, item) => sum + item.quantity, 0);

  // Estimations for floral gift packaging
  const defaultWeight = Math.max(0.3, Math.min(2.0, Number((totalItemCount * 0.25).toFixed(2))));
  const [carrier, setCarrier] = useState<CarrierType>('DELHIVERY');
  const [weightKg, setWeightKg] = useState<number>(defaultWeight);
  const [lengthCm, setLengthCm] = useState<number>(28);
  const [widthCm, setWidthCm] = useState<number>(20);
  const [heightCm, setHeightCm] = useState<number>(12);
  const [awbNumber, setAwbNumber] = useState<string>('');
  const [internalNote, setInternalNote] = useState<string>('Floral arrangement securely boxed with protective padding.');
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const addr = order.shipping_address_snapshot;

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!awbNumber.trim()) {
      setError('Please provide or scan an AWB / Consignment tracking number for this parcel.');
      return;
    }
    setError('');
    setIsConfirming(true);
    try {
      await onConfirmBooking(carrier, awbNumber.trim(), internalNote.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save courier booking.');
      setIsConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bark/70 backdrop-blur-sm">
      <div className="bg-white text-ink w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-sm shadow-2xl flex flex-col border border-canvas-line">
        {/* Header */}
        <div className="p-5 bg-linen border-b border-canvas-line flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-rose/10 text-rose flex items-center justify-center">
              <Truck size={18} />
            </div>
            <div>
              <h3 className="font-serif font-semibold text-bark text-base">Courier Booking &amp; Dispatch Prep</h3>
              <p className="text-xs text-ink-light">Order {order.order_number} · Made-To-Order Fulfillment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-ink-light hover:text-bark rounded-sm border border-canvas-line"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleBooking} className="p-6 space-y-6 text-xs">
          {/* MTO Status Notice */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-sm flex items-start gap-2.5">
            <ShieldCheck size={16} className="text-amber-800 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-900 leading-relaxed">
              <strong className="font-semibold">Crafting &amp; Packaging Completed:</strong> Ready for carrier pickup booking. Surface transport is standard; air cargo requests can be coordinated manually with the concierge.
            </div>
          </div>

          {/* Delivery Destination */}
          <div className="bg-canvas/30 p-4 rounded-sm border border-canvas-line space-y-2">
            <p className="text-[10px] uppercase font-bold tracking-wider text-bark flex items-center gap-1.5">
              <MapPin size={12} className="text-rose" />
              Delivery Destination &amp; Consignee
            </p>
            <div className="text-[11px] text-gray-800 space-y-0.5">
              <p className="font-bold text-sm text-black">{addr.recipientName} ({addr.phone})</p>
              <p>{addr.addressLine1} {addr.addressLine2 ? `, ${addr.addressLine2}` : ''}</p>
              <p className="font-medium text-bark">
                {addr.city}, {addr.state} — <span className="font-mono font-bold">{addr.pincode}</span>
              </p>
            </div>
          </div>

          {/* Parcel Specifications */}
          <div className="space-y-3">
            <p className="text-[10px] uppercase font-bold tracking-wider text-bark flex items-center gap-1.5">
              <Package size={12} className="text-rose" />
              Parcel Specifications ({totalItemCount} floral items)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] uppercase text-ink-light mb-1">Weight (KG)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="10"
                  value={weightKg}
                  onChange={(e) => setWeightKg(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-canvas/40 border border-canvas-line rounded-sm text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-ink-light mb-1">Length (CM)</label>
                <input
                  type="number"
                  value={lengthCm}
                  onChange={(e) => setLengthCm(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-canvas/40 border border-canvas-line rounded-sm text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-ink-light mb-1">Width (CM)</label>
                <input
                  type="number"
                  value={widthCm}
                  onChange={(e) => setWidthCm(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-canvas/40 border border-canvas-line rounded-sm text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-ink-light mb-1">Height (CM)</label>
                <input
                  type="number"
                  value={heightCm}
                  onChange={(e) => setHeightCm(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-canvas/40 border border-canvas-line rounded-sm text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Carrier Partner Selection */}
          <div className="space-y-3">
            <label className="block text-[10px] uppercase font-bold tracking-wider text-bark">
              Select Logistics / Courier Service
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'DELHIVERY', name: 'Delhivery Surface', info: 'Land Cargo (3–5 days)' },
                { id: 'SHIPROCKET', name: 'Shiprocket Partner', info: 'Multi-courier Aggregator' },
                { id: 'INDIA_POST', name: 'India Post Speed Post', info: 'Deep Pincode Reach' },
              ].map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setCarrier(c.id as CarrierType)}
                  className={`p-3 text-left rounded-sm border transition-all ${
                    carrier === c.id
                      ? 'border-bark bg-linen shadow-sm font-semibold'
                      : 'border-canvas-line bg-canvas/20 hover:bg-canvas/40'
                  }`}
                >
                  <p className="text-xs font-medium text-bark">{c.name}</p>
                  <p className="text-[10px] text-ink-light mt-0.5">{c.info}</p>
                </button>
              ))}
            </div>
          </div>

          {/* AWB & Tracking Number Entry */}
          <div className="space-y-1.5">
            <label className="block text-[10px] uppercase font-bold tracking-wider text-bark">
              Carrier AWB / Consignment Tracking Number *
            </label>
            <input
              type="text"
              required
              value={awbNumber}
              onChange={(e) => setAwbNumber(e.target.value)}
              placeholder="e.g. 142859204910 or SP12839210IN"
              className="w-full px-3 py-2 bg-canvas/40 border border-canvas-line rounded-sm text-sm font-mono text-bark focus:outline-none focus:border-bark"
            />
            <p className="text-[10px] text-ink-light">
              Enter the AWB provided on your carrier parcel slip or manifest.
            </p>
          </div>

          {/* Internal Dispatch Note */}
          <div className="space-y-1.5">
            <label className="block text-[10px] uppercase font-bold tracking-wider text-bark">
              Dispatch Verification Note
            </label>
            <input
              type="text"
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              className="w-full px-3 py-2 bg-canvas/40 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
            />
          </div>

          {error && (
            <div className="p-3 bg-rose/10 border border-rose/25 rounded-sm text-xs text-rose flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t border-canvas-line">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-canvas-line text-xs uppercase tracking-wider font-medium text-ink hover:bg-canvas/30 rounded-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isConfirming}
              className="px-6 py-2 bg-bark text-linen hover:bg-rose-deep text-xs uppercase tracking-wider font-medium rounded-sm flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <CheckCircle2 size={15} />
              {isConfirming ? 'Confirming Dispatch...' : 'Confirm Dispatch & Save AWB'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
