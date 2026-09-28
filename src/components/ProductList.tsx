import Reveal from '@/components/Reveal';
import { Link } from 'react-router-dom';
import { Heart, Eye } from 'lucide-react';
import type { Product } from '@/data/products';
import { formatPrice } from '@/data/products';
import { useQuickView } from '@/context/QuickViewContext';
import { useWishlist } from '@/context/WishlistContext';

interface ProductListProps {
  products: Product[];
}

export default function ProductList({ products }: ProductListProps) {
  return (
    <div className="flex flex-col gap-6">
      {products.map((product, i) => {
        const { openQuickView } = useQuickView();
        const { toggleItem, isWishlisted } = useWishlist();

        return (
          <Reveal key={product.code} delay={Math.min(i * 60, 600)}>
            <div className="group flex flex-col sm:flex-row gap-6 p-4 rounded-atelier-panel bg-canvas/30 border border-canvas-line hover:bg-canvas/50 transition-all duration-300">
              {/* Image Section */}
              <div className="w-full sm:w-48 h-48 shrink-0 overflow-hidden rounded-atelier-img bg-canvas relative">
                <Link to={`/product/${product.code}`} className="block w-full h-full">
                  <img
                    src={product.images?.[0] || '/placeholder-bloom.svg'}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </Link>
                {product.customisable && (
                  <span className="absolute top-2 left-2 z-10 bg-moss text-linen text-[10px] font-medium px-2 py-1 rounded-full shadow-sm">
                    Customisable
                  </span>
                )}
              </div>

              {/* Info Section */}
              <div className="flex flex-col justify-between flex-grow py-1">
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <Link to={`/product/${product.code}`} className="font-serif text-2xl text-bark hover:text-rose transition-colors">
                        {product.name}
                      </Link>
                      <span className="block text-[10px] text-ink-light font-mono uppercase tracking-widest mt-1">
                        {product.code}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleItem(product.code)}
                      className="w-10 h-10 rounded-full bg-linen/80 backdrop-blur-sm flex items-center justify-center text-ink-light hover:text-rose transition-all duration-300"
                      aria-label={isWishlisted(product.code) ? 'Remove from wishlist' : 'Add to wishlist'}
                    >
                      <Heart
                        size={18}
                        strokeWidth={1.5}
                        fill={isWishlisted(product.code) ? 'currentColor' : 'none'}
                        className={isWishlisted(product.code) ? 'text-rose' : ''}
                      />
                    </button>
                  </div>
                  <p className="text-ink-light text-sm leading-relaxed mb-4 line-clamp-2">
                    {product.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-canvas-line">
                  <span className="font-serif text-xl text-rose-deep">
                    {product.priceLabel || formatPrice(product.price)}
                  </span>
                  <button
                    onClick={() => openQuickView(product)}
                    className="px-6 py-2 bg-bark text-linen text-xs font-medium rounded-atelier-btn hover:bg-bark-dark transition-all duration-300 whitespace-nowrap"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}
