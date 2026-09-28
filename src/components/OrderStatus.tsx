import { Package, Scissors, Gift, Truck, Home, Check } from 'lucide-react';

export interface OrderStatusInfo {
  status: 'received' | 'handcrafting' | 'packed' | 'shipped' | 'out_for_delivery' | 'delivered';
  orderCode?: string;
  estimatedDelivery?: string;
}

const statusSteps = [
  { key: 'received', label: 'Order received', icon: Package },
  { key: 'handcrafting', label: 'Being handcrafted', icon: Scissors },
  { key: 'packed', label: 'Packed', icon: Gift },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'out_for_delivery', label: 'Out for delivery', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: Home },
] as const;

export default function OrderStatus({ status, orderCode, estimatedDelivery }: OrderStatusInfo) {
  const currentIndex = statusSteps.findIndex((s) => s.key === status);

  return (
    <div className="bg-cream-50 rounded-sm border border-cream-300 p-6">
      {orderCode && (
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-brown-400">Order</p>
            <p className="font-serif text-lg text-brown-800">{orderCode}</p>
          </div>
          {estimatedDelivery && (
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-brown-400">Est. delivery</p>
              <p className="text-sm font-medium text-brown-700">{estimatedDelivery}</p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-1">
        {statusSteps.map((step, i) => {
          const Icon = step.icon;
          const isComplete = i < currentIndex;
          const isCurrent = i === currentIndex;
          return (
            <div key={step.key} className="flex items-center gap-3 py-1.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  isComplete
                    ? 'bg-sage-600 text-cream-50'
                    : isCurrent
                    ? 'bg-terracotta-500 text-cream-50 animate-pulse'
                    : 'bg-cream-200 text-brown-300'
                }`}
              >
                {isComplete ? <Check size={14} strokeWidth={2.5} /> : <Icon size={14} strokeWidth={1.5} />}
              </div>
              <span
                className={`text-sm ${
                  isComplete || isCurrent ? 'text-brown-700 font-medium' : 'text-brown-300'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-ink-light/70 mt-4 pt-3 border-t border-cream-200">
        Status updates are synchronized directly from the studio. For queries, contact our gift concierge with your order reference.
      </p>
    </div>
  );
}
