import { useState, useEffect } from 'react';
import { X, ShoppingBag, Clock, Sparkles, Check, Heart } from 'lucide-react';
import type { Product } from '@/data/products';
import { formatPrice } from '@/data/products';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import WhatsAppButton from '@/components/WhatsAppButton';
import { productOrderMessage } from '@/utils/whatsapp';
import { trackEvent } from '@/utils/analytics';
import { Link } from 'react-router-dom';

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  Pink: { bg: '#fbcfe8', text: '#831843' },
  Rose: { bg: '#A8465A', text: '#ffffff' },
  White: { bg: '#ffffff', text: '#2A241C' },
  Lavender: { bg: '#d8b4fe', text: '#581c87' },
  Yellow: { bg: '#fde047', text: '#854d0e' },
  Sage: { bg: '#8C9B7F', text: '#ffffff' },
  Moss: { bg: '#58643F', text: '#ffffff' },
  Bark: { bg: '#2A241C', text: '#ffffff' },
  Canvas: { bg: '#CBB89A', text: '#2A241C' },
};

interface QuickViewProps {
  product: Product | null;
  onClose: () => void;
}

export default function QuickView({ product, onClose }: QuickViewProps) {
  const { addItem } = useCart();
  const { toggleItem, isWishlisted } = useWishlist();
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (product) {
      setSelectedColor('');
      setQuantity(1);
      trackEvent('quick_view', { code: product.code });
    }
  }, [product]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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
    onClose();
  };

  const getColorStyle = (color: string) => {
    const mapped = COLOR_MAP[color] || { bg: '#ffffff', text: '#2A241C' };
    return {
      backgroundColor: mapped.bg,
      color: mapped.text,
    };
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-ink/80 backdrop-blur-md animate-fade-in" onClick={onClose} />
      <div className="relative bg-ink rounded-sm shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-fade-up text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          aria-label="Close quick view"
        >
          <X size={18} strokeWidth={1.5} />
        </button>

        <div className="grid sm:grid-cols-2 gap-0">
          {/* Image */}
          <div className="aspect-[4/5] sm:aspect-auto overflow-hidden bg-cream-100">
            <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
          </div>

          {/* Info */}
          <div className="p-6 lg:p-8 flex flex-col">
            <div className="flex items-start justify-start gap-3 mb-2">
              <p className="text-xs uppercase tracking-[0.15em] text-white/60 font-medium">{product.code}</p>
              <button
                onClick={() => toggleItem(product.code)}
                className="text-white/60 hover:text-rose transition-colors"
                aria-label={isWishlisted(product.code) ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                <Heart
                  size={20}
                  strokeWidth={1.5}
                  fill={isWishlisted(product.code) ? 'currentColor' : 'none'}
                  className={isWishlisted(product.code) ? 'text-rose' : ''}
                />
              </button>
            </div>

            <h2 className="font-serif text-2xl lg:text-3xl text-white mb-2">{product.name}</h2>
            <p className="text-sm text-white/80 leading-relaxed mb-4">{product.description}</p>

            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="font-serif text-2xl text-white">
                {product.priceLabel || formatPrice(product.price)}
              </span>
              {product.customisable && (
                <span className="text-[10px] text-sage-200 font-medium flex items-center gap-1 bg-sage-900/40 px-2 py-1 rounded-sm">
                  <Sparkles size={10} /> Custom colours
                </span>
              )}
              {product.preparationDays && (
                <span className="text-[10px] text-brown-300 font-medium flex items-center gap-1 bg-white/10 px-2 py-1 rounded-sm">
                  <Clock size={10} strokeWidth={1.5} /> Made in {product.preparationDays}
                </span>
              )}
            </div>

            {/* Colours */}
            {product.colors && product.colors.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-white/60 mb-2">Colours</label>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      style={selectedColor === color ? getColorStyle(color) : {}}
                      className={`px-3 py-1.5 text-xs rounded-sm border transition-all duration-200 ${
                        selectedColor === color
                          ? 'border-transparent shadow-sm scale-105'
                          : 'bg-white/10 text-white border-white/20 hover:border-white/40'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-white/60 mb-2">Quantity</label>
              <div className="flex items-center border border-white/20 rounded-sm w-fit">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-2 text-white/80 hover:text-white"
                  aria-label="Decrease quantity"
                >−</button>
                <span className="px-3 text-sm text-white font-medium min-w-[36px] text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-3 py-2 text-white/80 hover:text-white"
                  aria-label="Increase quantity"
                >+</button>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col gap-2 mt-auto">
              <button onClick={handleAddToCart} className="bg-linen text-ink hover:bg-linen/90 transition-colors w-full py-4 px-6 rounded-sm font-medium flex items-center justify-center gap-2 shadow-soft">
                <ShoppingBag size={16} />
                Add to enquiry
              </button>
              <div className="flex gap-2">
                <WhatsAppButton
                  message={productOrderMessage(product)}
                  label="WhatsApp"
                  className="flex-1"
                />
                <Link
                  to={`/product/${product.code}`}
                  onClick={onClose}
                  className="flex-1 text-center bg-white/10 text-white border border-white/20 hover:bg-white/20 py-3 rounded-sm transition-all text-sm font-medium"
                >
                  View details
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
