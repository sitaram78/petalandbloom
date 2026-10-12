import { Plus, Check, Sparkles } from 'lucide-react';
import { formatPrice } from '@/data/products';
import { useCart } from '@/context/CartContext';
import {
  useStoreSettings,
  DEFAULT_COMPANION_GIFTS,
  CompanionGiftItem,
} from '@/context/StoreSettingsContext';
import { useState } from 'react';

export default function CrossSell() {
  const { addItem, items: cartItems } = useCart();
  const { settings } = useStoreSettings();
  const [justAddedCodes, setJustAddedCodes] = useState<string[]>([]);

  // 100% isolated from the shop catalog. Defined and edited solely via Admin Settings!
  const companionList: CompanionGiftItem[] =
    settings.businessRules?.companionGifts && settings.businessRules.companionGifts.length > 0
      ? settings.businessRules.companionGifts
      : DEFAULT_COMPANION_GIFTS;

  const handleAdd = (item: CompanionGiftItem) => {
    const cleanId = item.id.replace(/^addon-/i, '').toLowerCase();
    const itemCode = `ADDON-${cleanId.toUpperCase()}`;
    addItem({
      code: itemCode,
      name: item.name,
      category: 'gifts' as const,
      price: item.priceRupees,
      description: item.description,
      images: ['/placeholder-bloom.svg'],
    });
    setJustAddedCodes((prev) => [...prev, itemCode, `ADDON-${item.id.toUpperCase()}`]);
  };

  const isItemAdded = (id: string) => {
    const cleanId = id.replace(/^addon-/i, '').toUpperCase();
    const targetCodes = [
      `ADDON-${cleanId}`,
      `ADDON-ADDON-${cleanId}`,
      `ADDON-${id.toUpperCase()}`,
      id.toUpperCase(),
    ];
    return (
      justAddedCodes.some((code) => targetCodes.includes(code.toUpperCase())) ||
      cartItems.some((ci) => targetCodes.includes((ci.code || '').toUpperCase()))
    );
  };

  return (
    <div className="py-12 lg:py-16 bg-cream-50 border-t border-canvas-line/80">
      <div className="container-lux">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={14} className="text-rose" />
          <span className="text-[10px] uppercase tracking-[0.25em] text-rose font-semibold">
            Atelier Companions
          </span>
        </div>
        <h2 className="heading-serif text-2xl lg:text-3xl text-bark mb-1">Complete the gift</h2>
        <p className="text-sm text-ink-light mb-6">
          Thoughtful handmade touches that turn a gift into a lasting moment.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {companionList.map((addon) => {
            const added = isItemAdded(addon.id);
            return (
              <div
                key={addon.id}
                className="bg-white p-4 rounded-sm border border-canvas-line hover:border-rose/50 transition-all duration-300 shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <h3 className="font-serif text-base text-bark leading-tight">{addon.name}</h3>
                  <p className="text-xs text-ink-light mt-1.5 leading-relaxed">
                    {addon.description}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-canvas-line/60">
                  <span className="text-sm font-semibold text-rose-deep">
                    {formatPrice(addon.priceRupees)}
                  </span>
                  <button
                    onClick={() => handleAdd(addon)}
                    disabled={added}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 transition-all ${
                      added
                        ? 'bg-moss text-linen'
                        : 'bg-bark text-linen hover:bg-rose-deep'
                    }`}
                    aria-label={`Add ${addon.name}`}
                  >
                    {added ? (
                      <>
                        <Check size={12} strokeWidth={2.5} />
                        <span>Added</span>
                      </>
                    ) : (
                      <>
                        <Plus size={12} />
                        <span>Add</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
