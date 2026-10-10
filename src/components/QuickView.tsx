import { useState, useEffect } from 'react';
import { X, ShoppingBag, Clock, Sparkles, Check, Heart, ArrowRight } from 'lucide-react';
import type { Product } from '@/data/products';
import { formatPrice, getDiscountPercent } from '@/data/products';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useSwipeDownToClose } from '@/hooks/useSwipeDownToClose';
import WhatsAppButton from '@/components/WhatsAppButton';
import { productOrderMessage } from '@/utils/whatsapp';
import { trackEvent } from '@/utils/analytics';
import { Link } from 'react-router-dom';

const KNOWN_COLORS: Record<string, string> = {
  // Pinks / Roses
  pink: '#f472b6',
  rose: '#A8465A',
  'blush pink': '#fbcfe8',
  'baby pink': '#fce7f3',
  'hot pink': '#db2777',
  magenta: '#d946ef',
  fuchsia: '#c026d3',

  // Reds
  red: '#ef4444',
  crimson: '#dc2626',
  maroon: '#991b1b',
  ruby: '#e11d48',
  cherry: '#be123c',
  burgundy: '#881337',

  // Blues
  blue: '#3b82f6',
  'sky blue': '#38bdf8',
  'baby blue': '#bae6fd',
  'light blue': '#7dd3fc',
  navy: '#1e3a8a',
  'royal blue': '#1d4ed8',
  cyan: '#06b6d4',
  teal: '#14b8a6',
  turquoise: '#2dd4bf',
  ocean: '#0284c7',

  // Yellows & Golds
  yellow: '#facc15',
  'light yellow': '#fef08a',
  lemon: '#fef08a',
  mustard: '#ca8a04',
  gold: '#eab308',
  golden: '#eab308',

  // Purples & Lavenders
  lavender: '#c084fc',
  purple: '#a855f7',
  violet: '#8b5cf6',
  lilac: '#d8b4fe',
  plum: '#701a75',
  mauve: '#c084fc',

  // Whites & Creams
  white: '#ffffff',
  'white/ ivory': '#fefefe',
  ivory: '#fffbeb',
  cream: '#fef3c7',
  'off white': '#fafaf9',
  pearl: '#f5f5f4',

  // Greens
  green: '#22c55e',
  sage: '#8C9B7F',
  moss: '#58643F',
  olive: '#65a30d',
  mint: '#6ee7b7',
  emerald: '#10b981',
  forest: '#15803d',

  // Oranges & Peaches
  orange: '#f97316',
  peach: '#fdba74',
  coral: '#fb7185',
  apricot: '#fed7aa',
  rust: '#c2410c',
  amber: '#d97706',

  // Browns & Neutrals
  brown: '#78350f',
  bark: '#382E2B',
  coffee: '#451a03',
  chocolate: '#3b1c11',
  tan: '#d2b48c',
  camel: '#c19a6b',
  beige: '#f5f5dc',
  canvas: '#CBB89A',

  // Blacks & Grays
  black: '#1c1917',
  charcoal: '#334155',
  grey: '#9ca3af',
  gray: '#9ca3af',
  silver: '#cbd5e1',
};

const MIX_GRADIENT = 'linear-gradient(135deg, #f43f5e 0%, #a855f7 35%, #3b82f6 70%, #10b981 100%)';

export function getColorMeta(rawColor: string): { dot: string; isGradient?: boolean } {
  if (!rawColor) return { dot: '#d4cecb' };
  const clean = rawColor.toLowerCase().trim();

  // Multi / Mix / Rainbow / Custom mix
  if (
    clean.includes('mix') ||
    clean.includes('multi') ||
    clean.includes('rainbow') ||
    clean.includes('assort') ||
    clean.includes('custom')
  ) {
    return { dot: MIX_GRADIENT, isGradient: true };
  }

  // Exact match
  if (KNOWN_COLORS[clean]) {
    return { dot: KNOWN_COLORS[clean] };
  }

  // Compound check e.g. "white/ ivory" -> check individual parts
  if (clean.includes('/')) {
    const parts = clean.split('/').map((s) => s.trim());
    for (const part of parts) {
      if (KNOWN_COLORS[part]) {
        return { dot: KNOWN_COLORS[part] };
      }
    }
  }

  // Substring checks
  if (clean.includes('blue')) return { dot: '#38bdf8' };
  if (clean.includes('yellow')) return { dot: '#facc15' };
  if (clean.includes('gold')) return { dot: '#eab308' };
  if (clean.includes('red') || clean.includes('crimson')) return { dot: '#ef4444' };
  if (clean.includes('pink') || clean.includes('rose') || clean.includes('blush')) return { dot: '#f472b6' };
  if (clean.includes('white') || clean.includes('ivory') || clean.includes('cream')) return { dot: '#fefefe' };
  if (clean.includes('purple') || clean.includes('lavender') || clean.includes('lilac') || clean.includes('violet')) return { dot: '#c084fc' };
  if (clean.includes('green') || clean.includes('sage') || clean.includes('moss') || clean.includes('mint')) return { dot: '#8C9B7F' };
  if (clean.includes('orange') || clean.includes('peach') || clean.includes('coral')) return { dot: '#fb923c' };
  if (clean.includes('brown') || clean.includes('coffee') || clean.includes('tan') || clean.includes('beige')) return { dot: '#78350f' };
  if (clean.includes('black') || clean.includes('charcoal')) return { dot: '#1c1917' };

  // Fallback to CSS color string or safe tint
  return { dot: clean };
}

interface QuickViewProps {
  product: Product | null;
  onClose: () => void;
}

export default function QuickView({ product, onClose }: QuickViewProps) {
  const { addItem } = useCart();
  const { toggleItem, isWishlisted } = useWishlist();
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [hasSwiped, setHasSwiped] = useState(false);

  const handleClose = () => {
    if (sheetRef.current) {
      sheetRef.current.style.opacity = '0';
      sheetRef.current.style.pointerEvents = 'none';
    }
    if (backdropRef.current) {
      backdropRef.current.style.opacity = '0';
      backdropRef.current.style.pointerEvents = 'none';
    }
    onClose();
  };

  // High-performance 120fps swipe-down-to-dismiss gesture hook (same as chat & filter drawers)
  const {
    sheetRef,
    backdropRef,
    handleTouchStart: rawTouchStart,
    handleTouchMove,
    handleTouchEnd,
    sheetStyle,
    isDragging,
    isPastThreshold,
  } = useSwipeDownToClose({
    onClose: handleClose,
    threshold: 75,
  });

  const handleTouchStart = (e: React.TouchEvent) => {
    setHasSwiped(true);
    rawTouchStart(e);
  };

  useEffect(() => {
    if (product) {
      setSelectedColor('');
      setQuantity(1);
      setHasSwiped(false);
      trackEvent('quick_view', { code: product.code });
    }
  }, [product]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    if (product) {
      document.addEventListener('keydown', onEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', onEsc);
      document.body.style.overflow = '';
    };
  }, [product, onClose]);

  if (!product) return null;

  const handleAddToCart = () => {
    addItem(product, { color: selectedColor || undefined, quantity });
    handleClose();
  };

  const discountPercent = getDiscountPercent(product);

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-fade-in">
      {/* Blurred warm vignette backdrop */}
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-bark/40 backdrop-blur-md transition-opacity"
        onClick={handleClose}
      />

      {/* Atelier Modal / Bottom Sheet */}
      <div
        ref={sheetRef}
        style={sheetStyle}
        className={`relative bg-linen text-bark rounded-t-3xl sm:rounded-atelier-img shadow-2xl border border-canvas-line w-full max-w-4xl max-h-[92vh] sm:max-h-[88vh] flex flex-col sm:flex-row overflow-hidden z-10 ${
          !hasSwiped && !isDragging ? 'animate-fade-up' : ''
        }`}
      >
        
        {/* Mobile Interactive Swipe-Down Drag Handle Bar */}
        <div
          className="sm:hidden pt-3 pb-2 w-full bg-linen flex justify-center cursor-grab active:cursor-grabbing select-none touch-none flex-shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className={`h-1 rounded-full transition-all duration-150 ${
              isPastThreshold
                ? 'w-14 bg-rose scale-y-125'
                : isDragging
                ? 'w-12 bg-bark/60 scale-y-110'
                : 'w-10 bg-bark/25'
            }`}
          />
        </div>

        {/* Floating High-Contrast Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-30 w-9 h-9 rounded-full bg-linen/95 hover:bg-canvas backdrop-blur-md flex items-center justify-center text-bark shadow-sm border border-canvas-line transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
          aria-label="Close preview"
        >
          <X size={17} strokeWidth={1.5} />
        </button>

        {/* Gallery Image Column with Inset Margins and Framing */}
        <div className="sm:w-1/2 p-3.5 sm:p-5 flex-shrink-0 flex items-center justify-center bg-linen sm:bg-canvas/20">
          <div className="relative w-full aspect-[4/3] sm:aspect-[4/5] rounded-2xl overflow-hidden bg-canvas shadow-xs border border-canvas-line">
            <img
              src={product.images?.[0] || '/placeholder-bloom.svg'}
              alt={product.name}
              className="w-full h-full object-cover"
            />

            {/* Badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
              {product.customisable && (
                <span className="bg-moss/90 backdrop-blur-sm text-linen text-[10px] font-medium px-2.5 py-1 rounded-full shadow-xs">
                  Customisable
                </span>
              )}
              {product.bestseller && (
                <span className="bg-rose/90 backdrop-blur-sm text-linen text-[10px] font-medium px-2.5 py-1 rounded-full shadow-xs">
                  Bestseller
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Information & Actions Column */}
        <div className="sm:w-1/2 flex flex-col flex-1 overflow-hidden bg-linen">
          
          {/* Scrollable Details Area */}
          <div className="p-5 sm:p-7 overflow-y-auto overscroll-contain flex-1 space-y-4">
            
            {/* Header: Code & Wishlist / Save Button (Clear of top-right close button) */}
            <div className="flex items-center justify-between gap-3 pr-12 sm:pr-14">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-ink-light">
                  {product.code}
                </span>
                <button
                  type="button"
                  onClick={() => toggleItem(product.code)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all text-xs font-medium border shadow-xs active:scale-95 ${
                    isWishlisted(product.code)
                      ? 'bg-rose/10 border-rose/30 text-rose'
                      : 'bg-canvas/80 hover:bg-canvas border-canvas-line text-bark hover:text-rose'
                  }`}
                  aria-label={isWishlisted(product.code) ? 'Remove from wishlist' : 'Save to wishlist'}
                >
                  <Heart
                    size={13}
                    strokeWidth={1.5}
                    fill={isWishlisted(product.code) ? 'currentColor' : 'none'}
                    className={isWishlisted(product.code) ? 'text-rose' : ''}
                  />
                  <span>{isWishlisted(product.code) ? 'Saved' : 'Save'}</span>
                </button>
              </div>
            </div>

            {/* Product Title */}
            <div>
              <h2 className="font-serif text-2xl lg:text-3xl text-bark leading-tight">
                {product.name}
              </h2>
            </div>

            {/* Price Row */}
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <span className="font-serif text-2xl text-bark">
                {product.priceLabel || formatPrice(product.price)}
              </span>
              {product.compareAtPrice && product.compareAtPrice > product.price && (
                <>
                  <span className="text-sm text-ink-light line-through">
                    {formatPrice(product.compareAtPrice)}
                  </span>
                  <span className="text-xs text-rose font-medium bg-rose/10 px-2 py-0.5 rounded-full">
                    {discountPercent}% off
                  </span>
                </>
              )}
            </div>

            {/* Feature Pills */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {product.customisable && (
                <span className="text-[11px] text-moss font-medium flex items-center gap-1 bg-moss/10 px-2.5 py-1 rounded-full border border-moss/15">
                  <Sparkles size={11} /> Custom colours available
                </span>
              )}
              {product.preparationDays && (
                <span className="text-[11px] text-bark/80 font-medium flex items-center gap-1 bg-canvas px-2.5 py-1 rounded-full border border-canvas-line">
                  <Clock size={11} strokeWidth={1.5} /> Made in {product.preparationDays}
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-ink-light leading-relaxed line-clamp-3">
              {product.description}
            </p>

            {/* Color Swatches with Consistent Colors & Mix Gradients */}
            {product.colors && product.colors.length > 0 && (
              <div className="pt-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-bark/70 mb-2">
                  Select Shade {selectedColor && <span className="font-normal normal-case text-rose">— {selectedColor}</span>}
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((color) => {
                    const colorMeta = getColorMeta(color);
                    const isSelected = selectedColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(isSelected ? '' : color)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-all duration-200 ${
                          isSelected
                            ? 'border-rose ring-2 ring-rose/30 bg-rose/10 text-bark font-medium shadow-xs'
                            : 'border-canvas-line bg-canvas/60 text-bark/80 hover:border-bark/30 hover:bg-canvas'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/10 flex-shrink-0"
                          style={{ background: colorMeta.dot }}
                        />
                        <span className="capitalize">{color}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity Stepper */}
            <div className="pt-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-bark/70 mb-2">
                Quantity
              </label>
              <div className="inline-flex items-center border border-canvas-line rounded-full bg-canvas/60 p-0.5">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-bark hover:text-rose hover:bg-linen transition-colors"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="px-3 text-sm text-bark font-mono font-medium min-w-[32px] text-center">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-bark hover:text-rose hover:bg-linen transition-colors"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Sticky Actions Footer (Always Visible on Mobile & Desktop) */}
          <div className="p-4 sm:p-6 bg-linen border-t border-canvas-line space-y-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleAddToCart}
              className="bg-bark text-linen hover:bg-bark/90 active:scale-[0.99] transition-all w-full py-3.5 px-6 rounded-atelier-btn font-medium flex items-center justify-center gap-2 shadow-soft text-sm tracking-wide"
            >
              <ShoppingBag size={16} />
              Add to Bag — {formatPrice(product.price * quantity)}
            </button>

            <div className="flex gap-2">
              <WhatsAppButton
                message={productOrderMessage(product)}
                label="WhatsApp"
                className="flex-1 text-xs py-2.5"
              />
              <Link
                to={`/product/${product.code}`}
                onClick={handleClose}
                className="flex-1 text-center bg-canvas hover:bg-canvas-line/40 text-bark border border-canvas-line py-2.5 px-3 rounded-atelier-btn transition-colors text-xs font-medium tracking-wide inline-flex items-center justify-center gap-1"
              >
                <span>Full Details</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
