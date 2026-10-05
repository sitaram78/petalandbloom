import React, { useState } from 'react';
import {
  Truck,
  MapPin,
  Calendar,
  Clock,
  RotateCw,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  PackageCheck,
  ShieldCheck,
} from 'lucide-react';

export interface LiveScanItem {
  scanDateTime: string;
  scanType?: string;
  scan: string;
  scannedLocation: string;
  instructions?: string;
  statusCode?: string;
}

export interface LiveTrackingData {
  success?: boolean;
  carrier?: string;
  awbNumber?: string;
  status?: string;
  statusType?: string;
  statusCode?: string;
  statusDateTime?: string;
  currentLocation?: string;
  origin?: string;
  destination?: string;
  expectedDeliveryDate?: string | null;
  pickupDate?: string | null;
  scans?: LiveScanItem[];
  trackingUrl?: string;
  isDelivered?: boolean;
  cachedAt?: string;
  errorMessage?: string;
}

export interface LiveCourierJourneyProps {
  liveTracking?: LiveTrackingData | null;
  shipment?: {
    carrier?: string;
    awb_number?: string;
    tracking_url?: string;
    status?: string;
    estimated_delivery_date?: string;
  } | null;
  orderNumber?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  variant?: 'card' | 'modal';
  onClose?: () => void;
}

export default function LiveCourierJourney({
  liveTracking,
  shipment,
  orderNumber,
  onRefresh,
  isRefreshing = false,
  variant = 'card',
  onClose,
}: LiveCourierJourneyProps) {
  const [copied, setCopied] = useState(false);
  const [showAllScans, setShowAllScans] = useState(false);

  const awb = liveTracking?.awbNumber || shipment?.awb_number || '';
  const carrier = liveTracking?.carrier || shipment?.carrier || 'DELHIVERY';
  const status = liveTracking?.status || shipment?.status || 'In Transit';
  const trackingUrl =
    liveTracking?.trackingUrl ||
    shipment?.tracking_url ||
    (awb ? `https://www.delhivery.com/track/package/${encodeURIComponent(awb)}` : 'https://www.delhivery.com');

  const scans = liveTracking?.scans || [];
  const currentLocation = liveTracking?.currentLocation || (scans[0]?.scannedLocation) || null;
  const eta = liveTracking?.expectedDeliveryDate || shipment?.estimated_delivery_date || null;

  const isDelivered =
    liveTracking?.isDelivered ||
    status.toLowerCase().includes('deliver') && !status.toLowerCase().includes('undeliver');

  const isOutForDelivery =
    status.toLowerCase().includes('out for delivery') ||
    status.toLowerCase().includes('out_for_delivery');

  const handleCopyAwb = () => {
    if (!awb) return;
    navigator.clipboard.writeText(awb);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const displayedScans = showAllScans ? scans : scans.slice(0, 3);

  const content = (
    <div className="space-y-6">
      {/* Top Header: Courier & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-canvas-line">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-sage-50 text-sage-700 border border-sage-200 flex items-center justify-center shrink-0">
            <Truck size={20} className="text-[#2D5A27]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif font-medium text-bark text-base tracking-wide">
                Delhivery Express Cargo
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F0F5EE] text-[#2D5A27] border border-[#D1E0CD] uppercase tracking-wider">
                Live Courier Sync
              </span>
            </div>
            {awb && (
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-ink-light">
                <span>Waybill (AWB):</span>
                <span className="font-mono font-medium text-bark">{awb}</span>
                <button
                  type="button"
                  onClick={handleCopyAwb}
                  className="p-1 text-ink-light hover:text-bark rounded transition-colors"
                  title="Copy Tracking Number"
                >
                  {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                </button>
                {copied && <span className="text-[10px] text-emerald-600">Copied!</span>}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-atelier-btn border border-canvas-line text-xs font-medium text-bark hover:border-bark hover:bg-canvas/40 transition-all disabled:opacity-50"
              title="Refresh tracking status from Delhivery"
            >
              <RotateCw size={12} className={isRefreshing ? 'animate-spin text-rose' : 'text-ink-light'} />
              <span>{isRefreshing ? 'Checking...' : 'Refresh Status'}</span>
            </button>
          )}

          <a
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-atelier-btn bg-canvas/60 border border-canvas-line text-xs font-medium text-bark hover:border-bark transition-all"
            title="Open official Delhivery tracking portal"
          >
            <span>Delhivery Portal</span>
            <ExternalLink size={12} className="text-ink-light" />
          </a>
        </div>
      </div>

      {/* Primary Status Banner */}
      <div
        className={`p-4 rounded-atelier-panel border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
          isDelivered
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
            : isOutForDelivery
            ? 'bg-amber-50/80 border-amber-200 text-amber-950'
            : 'bg-[#FAF7F2] border-[#E8E1D5] text-bark'
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {isDelivered ? (
              <PackageCheck size={18} className="text-emerald-700 shrink-0" />
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-[#2D5A27] animate-pulse shrink-0" />
            )}
            <span className="text-xs uppercase tracking-wider font-semibold">
              Current Package Status
            </span>
          </div>
          <p className="font-serif text-lg font-medium">
            {isDelivered
              ? 'Delivered to Recipient'
              : isOutForDelivery
              ? 'Out for Delivery Today'
              : status || 'In Transit'}
          </p>
          {currentLocation && (
            <p className="text-xs flex items-center gap-1.5 opacity-85">
              <MapPin size={13} className="shrink-0" />
              <span>Current Checkpoint: <strong className="font-medium">{currentLocation}</strong></span>
            </p>
          )}
        </div>

        {eta && (
          <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-canvas-line/60 pt-3 sm:pt-0 sm:pl-4 shrink-0">
            <p className="text-[11px] uppercase tracking-wider text-ink-light font-medium">
              Estimated Delivery
            </p>
            <p className="font-serif text-sm font-semibold text-bark mt-0.5 flex items-center sm:justify-end gap-1.5">
              <Calendar size={13} className="text-rose shrink-0" />
              <span>{eta}</span>
            </p>
          </div>
        )}
      </div>

      {/* Transit Scans Stepper */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-serif text-sm font-medium text-bark tracking-wide flex items-center gap-2">
            <span>Package Movement History</span>
            {scans.length > 0 && (
              <span className="text-xs font-sans text-ink-light">({scans.length} scans logged)</span>
            )}
          </h4>
          {scans.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAllScans(!showAllScans)}
              className="text-xs text-rose hover:text-rose-deep font-medium flex items-center gap-1 transition-colors"
            >
              <span>{showAllScans ? 'Show Recent Only' : `View All (${scans.length})`}</span>
              {showAllScans ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>

        {scans.length === 0 ? (
          <div className="p-4 rounded-sm bg-canvas/30 border border-canvas-line text-xs text-ink-light flex items-start gap-2.5">
            <Clock size={16} className="text-rose shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-bark">Package Registered &amp; Awaiting Initial Hub Scan</p>
              <p className="mt-0.5">
                Your order’s Delhivery waybill has been generated. Detailed location checkpoints will update automatically as soon as courier sorting facilities scan your parcel.
              </p>
            </div>
          </div>
        ) : (
          <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-canvas-line">
            {displayedScans.map((scan, idx) => {
              const isLatest = idx === 0;
              return (
                <div key={idx} className="relative group">
                  {/* Stepper Node */}
                  <span
                    className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                      isLatest
                        ? 'border-emerald-600 bg-white shadow-2xs'
                        : 'border-canvas-line bg-canvas'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isLatest ? 'bg-emerald-600 animate-pulse' : 'bg-ink-light/50'
                      }`}
                    />
                  </span>

                  {/* Scan Info */}
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 text-xs">
                    <p className={`font-medium ${isLatest ? 'text-bark text-sm font-semibold' : 'text-ink'}`}>
                      {scan.scan}
                    </p>
                    {scan.scanDateTime && (
                      <span className="text-[11px] text-ink-light shrink-0">
                        {formatDate(scan.scanDateTime)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-ink-light">
                    {scan.scannedLocation && (
                      <span className="flex items-center gap-1">
                        <MapPin size={11} className="text-rose/80" />
                        <span>{scan.scannedLocation}</span>
                      </span>
                    )}
                    {scan.instructions && scan.instructions !== scan.scan && (
                      <span className="italic opacity-85">· {scan.instructions}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info & Concierge Assurance */}
      <div className="pt-3 border-t border-canvas-line flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-ink-light">
        <span className="flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-[#2D5A27]" />
          <span>Carefully packed with protective archival wrapping for zero floral deformation during transit.</span>
        </span>
        <a
          href={trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-rose hover:text-rose-deep font-medium inline-flex items-center gap-1 self-end sm:self-auto transition-colors"
        >
          <span>Track on Delhivery.com</span>
          <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );

  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bark/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-linen w-full max-w-2xl rounded-atelier-panel shadow-2xl border border-canvas-line max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
          {/* Modal Header */}
          <div className="p-5 border-b border-canvas-line flex items-center justify-between bg-canvas/30">
            <div>
              <span className="text-[10px] uppercase tracking-[0.25em] text-rose font-semibold">
                Studio Logistics
              </span>
              <h3 className="font-serif text-xl text-bark">
                Live Courier Journey {orderNumber ? `· #${orderNumber}` : ''}
              </h3>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-ink-light hover:text-bark hover:bg-canvas transition-colors"
              >
                ✕
              </button>
            )}
          </div>

          {/* Modal Scrollable Body */}
          <div className="p-6 overflow-y-auto">{content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 sm:p-7 rounded-atelier-panel shadow-soft border border-canvas-line">
      {content}
    </div>
  );
}
