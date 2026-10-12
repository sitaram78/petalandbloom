import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { useProducts } from '@/context/ProductContext';
import ProductCard from '@/components/ProductCard';
import Reveal from '@/components/Reveal';

export default function RecentlyViewed({ excludeCode }: { excludeCode?: string }) {
  const { recentCodes } = useRecentlyViewed();
  const { products } = useProducts();

  const recentProducts = recentCodes
    .filter((code) => code !== excludeCode)
    .map((code) => products.find((p) => p.code === code))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .slice(0, 4);

  if (recentProducts.length === 0) return null;

  return (
    <section className="py-12 lg:py-20 bg-linen border-t border-canvas-line/80">
      <div className="container-lux">
        <Reveal>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-8 pb-3 sm:pb-4 border-b border-canvas-line/60 gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-rose font-semibold mb-1">
                Your Browsing Atelier
              </p>
              <h2 className="font-serif text-2xl lg:text-3xl text-bark font-medium">Still thinking about these?</h2>
            </div>
            <p className="text-xs text-ink-light font-mono hidden sm:block">Recently viewed</p>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
          {recentProducts.map((product, i) => (
            <Reveal key={product.code} delay={i * 60}>
              <ProductCard product={product} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
