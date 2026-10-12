import { Plus, Check, Sparkles, Flower2, Tag, Wine, Package, Gift } from 'lucide-react';
import { formatPrice } from '@/data/products';
import { useCart } from '@/context/CartContext';
import {
  useStoreSettings,
  DEFAULT_COMPANION_GIFTS,
  CompanionGiftItem,
} from '@/context/StoreSettingsContext';
import { useState } from 'react';

const getCompanionBadge = (id: string, name: string) => {
  const lower = `${id} ${name}`.toLowerCase();
  if (lower.includes('flower') || lower.includes('stem') || lower.includes('bloom')) {
    return { icon: Flower2, label: 'Artisan Stem', color: 'text-rose bg-rose/10' };
  }
  if (lower.includes('charm') || lower.includes('tag') || lower.includes('name')) {
    return { icon: Tag, label: 'Personalised', color: 'text-rose-deep bg-rose/15' };
  }
  if (lower.includes('vase') || lower.includes('pot') || lower.includes('ceramic')) {
    return { icon: Wine, label: 'Studio Pottery', color: 'text-bark bg-bark/10' };
  }
  if (lower.includes('pouch') || lower.includes('bag') || lower.includes('linen') || lower.includes('box')) {
    return { icon: Package, label: 'Preservation', color: 'text-moss bg-moss/10' };
  }
  return { icon: Gift, label: 'Studio Add-on', color: 'text-rose bg-rose/10' };
};

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
    <section className="py-12 lg:py-16 bg-linen border-t border-canvas-line/80">
      <div className="container-lux">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-rose" />
            <span className="text-[10px] uppercase tracking-[0.25em] text-rose font-semibold">
              Atelier Companions
            </span>
          </div>
          <span className="sm:hidden text-[10px] text-ink-light font-mono">Swipe to explore →</span>
        </div>
        <h2 className="font-serif text-2xl lg:text-3xl text-bark mb-1 font-medium">Complete the gift</h2>
        <p className="text-xs sm:text-sm text-ink-light mb-6">
          Thoughtful handmade touches that turn a gift into a lasting moment.
        </p>
        <div className="flex sm:grid overflow-x-auto sm:overflow-visible snap-x snap-mandatory scrollbar-hide sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 -mx-4 px-4 sm:mx-0 sm:px-0 pb-3 sm:pb-0">
          {companionList.map((addon) => {
            const added = isItemAdded(addon.id);
            const badgeMeta = getCompanionBadge(addon.id, addon.name);
            const IconComponent = badgeMeta.icon;

            return (
              <div
                key={addon.id}
                className="snap-start shrink-0 w-[220px] sm:w-auto bg-white/85 backdrop-blur-sm p-4 sm:p-5 rounded-2xl border border-canvas-line/80 hover:border-rose/50 hover:shadow-md transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 ${badgeMeta.color}`}>
                      <IconComponent size={17} strokeWidth={1.75} />
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-ink-light bg-canvas/60 px-2.5 py-0.5 rounded-full border border-canvas-line/60">
                      {badgeMeta.label}
                    </span>
                  </div>
                  <h3 className="font-serif text-base sm:text-lg text-bark leading-tight font-medium group-hover:text-rose-deep transition-colors">
                    {addon.name}
                  </h3>
                  <p className="text-xs text-ink-light mt-1.5 leading-relaxed line-clamp-2">
                    {addon.description}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-4 sm:mt-5 pt-3.5 border-t border-canvas-line/60">
                  <div>
                    <span className="text-[10px] text-ink-light block font-mono uppercase tracking-wider">Studio Add-on</span>
                    <span className="font-serif text-base font-semibold text-rose-deep">
                      {formatPrice(addon.priceRupees)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAdd(addon)}
                    disabled={added}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                      added
                        ? 'bg-moss text-linen'
                        : 'bg-bark text-linen hover:bg-rose-deep active:scale-95'
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
    </section>
  );
}
