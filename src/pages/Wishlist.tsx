import { Link } from 'react-router-dom';
import { Heart, Trash2, ShoppingBag } from 'lucide-react';
import Reveal from '@/components/Reveal';
import { useWishlist } from '@/context/WishlistContext';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/data/products';
import { useProducts } from '@/context/ProductContext';
import AtelierButton from '@/components/AtelierButton';
import SEO from '@/components/SEO';

export default function Wishlist() {
  const { items, removeItem } = useWishlist();
  const { addItem } = useCart();
  const { products } = useProducts();

  const wishlistedProducts = products.filter((p) => items.includes(p.code));

  const handleMoveToCart = (product: any) => {
    addItem(product);
    removeItem(product.code);
  };

  return (
    <div className="bg-linen min-h-screen">
      <SEO
        title="My Saved Blooms — The Petal & Bloom"
        description="A personal gallery of your favourite handmade crochet pieces, waiting for the perfect moment."
        canonicalPath="/wishlist"
      />

      {/* Atelier Wishlist Header */}
      <section className="pt-16 pb-12 lg:pt-24 lg:pb-20">
        <div className="container-lux grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
          <div className="lg:col-span-7">
            <span className="font-serif italic text-sm text-rose mb-3 block uppercase tracking-widest">Curated Savings</span>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-7xl text-bark leading-tight mb-6">
              My Saved Blooms
            </h1>
            <p className="text-ink-light text-base sm:text-lg max-w-2xl leading-relaxed">
              A personal gallery of your favourite pieces, waiting for the perfect moment.
            </p>
          </div>
          <div className="lg:col-span-5">
            <div className="aspect-[16/9] rounded-atelier-img overflow-hidden shadow-soft bg-canvas">
               <div className="w-full h-full flex items-center justify-center p-12 text-center">
                  <p className="font-serif italic text-bark text-lg opacity-60">"Saved pieces are like seeds, waiting for the right season to bloom."</p>
               </div>
            </div>
          </div>
        </div>
      </section>

      <main className="container-lux py-12 lg:py-24">
        {wishlistedProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {wishlistedProducts.map((product, i) => (
              <Reveal key={product.code} delay={i * 100}>
                <div className="group relative bg-linen rounded-atelier-panel border border-canvas-line shadow-soft overflow-hidden transition-all duration-500 hover:-translate-y-2">
                  <div className="aspect-[4/5] overflow-hidden bg-canvas relative">
                    <Link to={`/product/${product.code}`} className="block w-full h-full">
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    </Link>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        removeItem(product.code);
                      }}
                      className="absolute top-3 right-3 p-2 bg-linen/90 backdrop-blur-sm text-ink-light hover:text-rose rounded-full transition-colors shadow-sm z-10"
                      title="Remove from wishlist"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="p-5 space-y-4">
                    <Link to={`/product/${product.code}`} className="block group/link">
                      <p className="text-[10px] uppercase tracking-widest text-rose font-medium mb-1">
                        {product.code}
                      </p>
                      <h3 className="font-serif text-xl text-bark truncate group-hover/link:text-rose transition-colors">
                        {product.name}
                      </h3>
                    </Link>

                    <div className="flex items-center justify-between pt-4 border-t border-canvas-line">
                      <span className="font-serif text-lg text-bark">{formatPrice(product.price)}</span>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleMoveToCart(product);
                        }}
                        className="flex items-center gap-2 text-xs font-medium text-ink-light hover:text-rose transition-colors group/btn"
                      >
                        <ShoppingBag size={14} className="group-hover/btn:scale-110 transition-transform" />
                        Move to Bag
                      </button>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        ) : (
          <Reveal>
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
              <div className="w-20 h-20 bg-canvas rounded-full flex items-center justify-center text-ink-light/30">
                <Heart size={40} strokeWidth={1} />
              </div>
              <div className="space-y-2">
                <h2 className="font-serif text-3xl text-bark">Your gallery is empty</h2>
                <p className="text-ink-light max-w-md mx-auto font-light">
                  You haven't saved any botanical pieces yet. Start exploring our collection to find your favourites.
                </p>
              </div>
              <AtelierButton variant="primary" onClick={() => window.location.href = '/shop'}>
                Continue Shopping
              </AtelierButton>
            </div>
          </Reveal>
        )}
      </main>
    </div>
  );
}
