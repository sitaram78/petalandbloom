import { Link } from 'react-router-dom';
import { Star, Sparkles, Clock, ArrowRight, Eye, Heart } from 'lucide-react';
import type { Product } from '@/data/products';
import { formatPrice, getDiscountPercent } from '@/data/products';
import { useQuickView } from '@/context/QuickViewContext';
import { useWishlist } from '@/context/WishlistContext';

interface ProductCardProps {
  product: Product;
  variant?: 'default' | 'compact';
}

export default function ProductCard({ product, variant = 'default' }: ProductCardProps) {
  const { openQuickView } = useQuickView();
  const { toggleItem, isWishlisted } = useWishlist();

  return (
    <div className="group block relative">
      <div className="relative overflow-hidden bg-canvas rounded-atelier-img">
        <Link
          to={`/product/${product.code}`}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2 focus-visible:ring-offset-linen rounded-atelier-img"
        >
          <div className="aspect-[4/5] overflow-hidden">
            <img
              src={product.images?.[0] || '/placeholder-bloom.svg'}
              alt={product.name}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
          </div>
        </Link>

        {/* Customisable Badge */}
        {product.customisable && (
          <span className="absolute top-3 left-3 z-10 bg-moss text-linen text-[10px] font-medium px-2 py-1 rounded-full shadow-sm">
            Customisable
          </span>
        )}

        {/* Wishlist button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleItem(product.code);
          }}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-linen/90 backdrop-blur-sm flex items-center justify-center text-ink-light hover:text-rose transition-all duration-300 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
          aria-label={isWishlisted(product.code) ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart
            size={14}
            strokeWidth={1.5}
            fill={isWishlisted(product.code) ? 'currentColor' : 'none'}
            className={isWishlisted(product.code) ? 'text-rose' : ''}
          />
        </button>

        {/* Quick Add/View Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openQuickView(product);
          }}
          className="absolute left-3 right-3 bottom-3 z-10 bg-linen text-ink text-xs font-medium tracking-wide flex items-center justify-center py-3 rounded-atelier-btn opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 hover:bg-canvas"
          aria-label={`Quick view ${product.name}`}
        >
          Add to bag — {product.priceLabel || formatPrice(product.price)}
        </button>
      </div>

      {/* Info */}
      <div className="mt-4">
        <Link to={`/product/${product.code}`}>
          <h3 className="font-serif text-lg text-bark leading-tight group-hover:text-rose transition-colors duration-300">
            {product.name}
          </h3>
        </Link>
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-serif text-base text-bark">
              {product.priceLabel || formatPrice(product.price)}
            </span>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <>
                <span className="text-xs text-ink-light line-through">{formatPrice(product.compareAtPrice)}</span>
                <span className="text-[10px] text-rose font-medium">{getDiscountPercent(product)}% off</span>
              </>
            )}
          </div>
          <span className="text-[10px] text-ink-light font-mono uppercase tracking-widest">
            {product.code}
          </span>
        </div>
      </div>
    </div>
  );
}
