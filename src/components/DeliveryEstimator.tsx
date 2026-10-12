import { useState } from 'react';
import { Truck, MapPin, Clock, Info } from 'lucide-react';

interface DeliveryEstimatorProps {
  preparationDays?: string;
}

export default function DeliveryEstimator({ preparationDays }: DeliveryEstimatorProps) {
  const [pincode, setPincode] = useState('');
  const [checked, setChecked] = useState(false);

  const handleCheck = () => {
    if (pincode.length === 6) {
      setChecked(true);
    }
  };

  return (
    <div className="bg-canvas/50 rounded-2xl p-4 sm:p-5 border border-canvas-line/60 shadow-2xs">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif text-base text-bark flex items-center gap-2 font-medium">
          <Truck size={16} className="text-rose" strokeWidth={1.5} />
          <span>Delivery Timeline Estimator</span>
        </h3>
        <span className="text-[11px] text-ink-light">Pan-India</span>
      </div>

      {!checked ? (
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light/50" strokeWidth={1.5} />
            <input
              type="text"
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter delivery PIN code (6 digits)"
              className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-canvas-line text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-rose transition-colors"
              aria-label="PIN code"
            />
          </div>
          <button
            onClick={handleCheck}
            disabled={pincode.length !== 6}
            className={`px-4 py-2 bg-bark hover:bg-ink text-linen rounded-xl text-xs font-medium transition-all ${
              pincode.length !== 6 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-xs'
            }`}
          >
            Check
          </button>
        </div>
      ) : (
        <div className="space-y-2.5 animate-fade-in text-xs">
          <div className="flex items-start gap-2.5 text-ink-light">
            <Clock size={14} className="text-rose mt-0.5 flex-shrink-0" strokeWidth={1.5} />
            <p>
              <span className="font-semibold text-bark">Studio Crafting:</span> {preparationDays || '3–5 days'}
            </p>
          </div>
          <div className="flex items-start gap-2.5 text-ink-light">
            <Truck size={14} className="text-rose mt-0.5 flex-shrink-0" strokeWidth={1.5} />
            <p>
              <span className="font-semibold text-bark">Transit Window:</span> 2–5 business days via courier
            </p>
          </div>
          <div className="flex items-start gap-2.5 text-ink-light">
            <Info size={14} className="text-moss mt-0.5 flex-shrink-0" strokeWidth={1.5} />
            <p>
              <span className="font-semibold text-bark">Estimated Arrival:</span>{' '}
              {preparationDays || '3–5 days'} + 2–5 days courier delivery
            </p>
          </div>
          <div className="pt-1 flex items-center justify-between text-[11px]">
            <span className="text-ink-light italic">Confirmations sent via email &amp; SMS</span>
            <button
              onClick={() => { setChecked(false); setPincode(''); }}
              className="text-rose hover:text-rose-deep font-medium underline underline-offset-2 cursor-pointer"
            >
              Check another PIN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
