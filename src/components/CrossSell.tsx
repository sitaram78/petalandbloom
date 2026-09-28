import { Plus, Check } from 'lucide-react';
import { addOns } from '@/data/site';
import { formatPrice } from '@/data/products';
import { useCart } from '@/context/CartContext';
import { useState } from 'react';

export default function CrossSell() {
  const { addItem } = useCart();
  const [added, setAdded] = useState<string[]>([]);

  const applicableAddOns = addOns.filter((a) =>
    ['Greeting Card', 'Personalised Message', 'Premium Ribbon', 'Premium Wrapping'].includes(a.name)
  );

  const handleAdd = (name: string, price: number) => {
    const pseudoProduct = {
      code: `ADDON-${name}`,
      name,
      category: 'gifts' as const,
      price,
      description: '',
      images: [addOns.find((addon) => addon.name === name)?.image || ''],
    };
    addItem(pseudoProduct);
    setAdded((prev) => [...prev, name]);
  };

  return (
    <div className="py-12 lg:py-16 bg-cream-50">
      <div className="container-lux">
        <h2 className="heading-serif text-2xl lg:text-3xl mb-2">Complete the gift</h2>
        <p className="text-sm text-brown-400 mb-6">Small touches that turn a gift into a moment.</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {applicableAddOns.map((addon) => (
            <div
              key={addon.name}
              className="bg-cream-100 p-4 rounded-sm border border-cream-200 hover:border-terracotta-300 transition-all duration-300"
            >
              <h3 className="font-serif text-base text-brown-800 leading-tight">{addon.name}</h3>
              <p className="text-xs text-brown-400 mt-1 leading-snug">{addon.description}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm font-medium text-terracotta-600">
                  {addon.priceLabel || formatPrice(addon.price)}
                </span>
                <button
                  onClick={() => handleAdd(addon.name, addon.price)}
                  disabled={added.includes(addon.name)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    added.includes(addon.name)
                      ? 'bg-sage-600 text-cream-50'
                      : 'bg-brown-700 text-cream-50 hover:bg-brown-800'
                  }`}
                  aria-label={`Add ${addon.name}`}
                >
                  {added.includes(addon.name) ? <Check size={14} strokeWidth={2.5} /> : <Plus size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
