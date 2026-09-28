import React, { useState } from 'react';
import { Truck, Package, MapPin, X, CheckCircle2, AlertTriangle, ShieldCheck, Zap, Loader2 } from 'lucide-react';
import { InvoiceOrderData } from './InvoiceModal';
import { CarrierType } from '@/services/shippingService';
import { useStoreSettings } from '@/context/StoreSettingsContext';
import { useNotification } from '@/context/NotificationContext';

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
  const { settings } = useStoreSettings();
  const { showNotification } = useNotification();
  const totalItemCount = order.order_items.reduce((sum, item) => sum + item.quantity, 0);

  // Estimations for floral gift packaging
  const defaultWeight = Math.max(0.3, Math.min(2.0, Number((totalItemCount * 0.25).toFixed(2))));
  const [carrier, setCarrier] = useState<CarrierType>('SHIPROCKET');
  const [weightKg, setWeightKg] = useState<number>(defaultWeight);
  const [lengthCm, setLengthCm] = useState<number>(28);
  const [widthCm, setWidthCm] = useState<number>(20);
  const [heightCm, setHeightCm] = useState<number>(12);
  const [awbNumber, setAwbNumber] = useState<string>('');
  const [internalNote, setInternalNote] = useState<string>('Floral arrangement securely boxed with protective padding.');
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [isAutomating, setIsAutomating] = useState<boolean>(false);
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const addr = order.shipping_address_snapshot;
  const canAutomate = carrier === 'SHIPROCKET' || carrier === 'DELHIVERY';

  const handleManualBooking = async (e: React.FormEvent) => {
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

  const handleExecuteAutomatedBooking = async () => {
    setIsAutomating(true);
    setError('');
    try {
      const res = await fetch('/api/shipping/book-shipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          carrier,
          weightKg,
          lengthCm,
          widthCm,
          heightCm,
          pickupLocation: settings.shiprocketPickupLocation || 'Atelier Primary Studio',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Automated courier booking failed.');
      }

      showNotification(`Pickup booked via ${carrier}! AWB: ${data.awbNumber}`, 'success');
      setShowApprovalModal(false);
      await onConfirmBooking(carrier, data.awbNumber, `Automated pickup booked via ${carrier}`);
      onClose();
    } catch (err: any) {
      console.error('[Automated Booking Error]:', err);
      setError(err.message || 'Automated carrier booking could not be completed.');
      showNotification(err.message || 'Automated booking failed.', 'error');
    } finally {
      setIsAutomating(false);
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
        <form onSubmit={handleManualBooking} className="p-6 space-y-6 text-xs">
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
                { id: 'SHIPROCKET', name: 'Shiprocket Partner', info: 'Multi-courier Aggregator (Auto-ready)' },
                { id: 'DELHIVERY', name: 'Delhivery Surface', info: 'Land Cargo (3–5 days)' },
                { id: 'INDIA_POST', name: 'India Post Speed Post', info: 'Deep Pincode Reach (Manual AWB)' },
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

          {/* Decision 5: Automated 1-Click Booking Section (With Confirmation) */}
          {canAutomate && settings.logisticsAutomationMode !== 'MANUAL_ONLY' && (
            <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-950 flex items-center gap-1.5">
                  <Zap size={14} className="text-emerald-700" />
                  Automated Pickup Booking (Decision 5)
                </span>
                <span className="text-[10px] bg-emerald-200/60 text-emerald-900 px-2 py-0.5 rounded-full font-mono">
                  {carrier}
                </span>
              </div>
              <p className="text-[11px] text-emerald-900 leading-relaxed">
                Click below to book carrier pickup, allocate the official AWB code, update the order status to Shipped, and prepare customer dispatch notifications with your confirmation.
              </p>
              <button
                type="button"
                onClick={() => setShowApprovalModal(true)}
                className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-sm flex items-center justify-center gap-2 text-xs transition-colors shadow-sm"
              >
                <Zap size={14} />
                Auto-Book via {carrier === 'SHIPROCKET' ? 'Shiprocket Partner' : 'Delhivery'}
              </button>
            </div>
          )}

          {/* Manual Entry Divider */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-canvas-line"></div>
            <span className="flex-shrink mx-3 text-[10px] uppercase font-bold tracking-wider text-ink-light">
              Or Enter Consignment AWB Manually
            </span>
            <div className="flex-grow border-t border-canvas-line"></div>
          </div>

          {/* AWB & Tracking Number Entry */}
          <div className="space-y-1.5">
            <label className="block text-[10px] uppercase font-bold tracking-wider text-bark">
              Carrier AWB / Consignment Tracking Number
            </label>
            <input
              type="text"
              value={awbNumber}
              onChange={(e) => setAwbNumber(e.target.value)}
              placeholder="e.g. 142859204910, SR19283741, or SP12839210IN"
              className="w-full px-3 py-2 bg-canvas/40 border border-canvas-line rounded-sm text-sm font-mono text-bark focus:outline-none focus:border-bark"
            />
            <p className="text-[10px] text-ink-light">
              Required for manual dispatch (e.g. India Post slips or external manifests).
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
              {isConfirming ? 'Confirming Dispatch...' : 'Confirm Manual Dispatch'}
            </button>
          </div>
        </form>
      </div>

      {/* Decision 5 Confirmation & Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-bark/70 backdrop-blur-xs">
          <div className="bg-linen w-full max-w-md rounded-sm border border-canvas-line shadow-2xl p-6 text-xs space-y-4">
            <div className="flex items-center gap-2.5 text-bark font-semibold text-sm pb-2 border-b border-canvas-line">
              <ShieldCheck size={18} className="text-emerald-700" />
              <span>Approve Courier Booking &amp; Pickup</span>
            </div>
            
            <p className="text-ink text-xs leading-relaxed">
              Are you sure you want to approve automated courier dispatch for Order <strong>#{order.order_number}</strong>? Pickup will be booked with the carrier.
            </p>

            <div className="bg-canvas/40 p-3.5 rounded-sm space-y-1.5 text-[11px] font-mono border border-canvas-line">
              <div><strong className="text-bark">Destination:</strong> {addr.recipientName} ({addr.city}, {addr.pincode})</div>
              <div><strong className="text-bark">Logistics Partner:</strong> {carrier}</div>
              <div><strong className="text-bark">Parcel Dimensions:</strong> {lengthCm}×{widthCm}×{heightCm} cm · {weightKg} kg</div>
              <div><strong className="text-bark">Pickup Hub:</strong> {settings.shiprocketPickupLocation || 'Atelier Primary Studio'}</div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isAutomating}
                onClick={() => setShowApprovalModal(false)}
                className="px-3.5 py-1.5 border border-canvas-line rounded-sm text-ink hover:bg-canvas/50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isAutomating}
                onClick={handleExecuteAutomatedBooking}
                className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-sm font-medium flex items-center gap-1.5 transition-colors"
              >
                {isAutomating ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                {isAutomating ? 'Contacting Carrier API...' : 'Yes, Approve & Book Pickup'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
