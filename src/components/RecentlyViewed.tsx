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
    <section className="pt-12 lg:pt-16 pb-6 lg:pb-8 bg-cream-50">
      <div className="container-lux">
        <Reveal>
          <h2 className="heading-serif text-2xl lg:text-3xl mb-8">You might still be thinking about these...</h2>
        </Reveal>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-8">
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
