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
    <div className="bg-silk/50 rounded-sm p-6 border border-silk shadow-sm">
      <h3 className="font-serif text-lg text-ink mb-4 flex items-center gap-3">
        <Truck size={18} className="text-rose" strokeWidth={1.5} />
        Shipping Timeline
      </h3>

      {!checked ? (
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light/50" strokeWidth={1.5} />
            <input
              type="text"
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter your PIN code"
              className="input-field pl-9 bg-parchment-50 border-silk focus:border-rose"
              aria-label="PIN code"
            />
          </div>
          <button
            onClick={handleCheck}
            disabled={pincode.length !== 6}
            className={`btn-primary !py-2.5 !px-5 text-sm ${pincode.length !== 6 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Check
          </button>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-start gap-3 text-sm text-ink-light">
            <Clock size={14} className="text-rose mt-0.5 flex-shrink-0" strokeWidth={1.5} />
            <p>
              <span className="font-medium text-ink">Studio Preparation:</span> {preparationDays || '3–5 days'}
            </p>
          </div>
          <div className="flex items-start gap-3 text-sm text-ink-light">
            <Truck size={14} className="text-rose mt-0.5 flex-shrink-0" strokeWidth={1.5} />
            <p>
              <span className="font-medium text-ink">Transit Time:</span> 2–5 business days via courier
            </p>
          </div>
          <div className="flex items-start gap-3 text-sm text-ink-light">
            <Info size={14} className="text-ink-light/50 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
            <p>
              <span className="font-medium text-ink">Estimated Arrival:</span>{' '}
              {preparationDays || '3–5 days'} + 2–5 days delivery
            </p>
          </div>
          <p className="text-xs text-ink-light/60 pt-2 italic">
            This is a studio estimate. We will confirm the exact delivery window upon order placement.
          </p>
          <button
            onClick={() => { setChecked(false); setPincode(''); }}
            className="text-xs text-rose hover:text-rose-dark link-underline"
          >
            Check another PIN code
          </button>
        </div>
      )}
    </div>
  );
}
