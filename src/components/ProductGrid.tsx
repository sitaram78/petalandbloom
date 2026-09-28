import Reveal from '@/components/Reveal';
import ProductCard from '@/components/ProductCard';
import type { Product } from '@/data/products';

interface ProductGridProps {
  products: Product[];
  columns?: 2 | 3 | 4;
}

export default function ProductGrid({ products, columns = 3 }: ProductGridProps) {
  const colClass = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
  }[columns];

  return (
    <div className={`grid ${colClass} gap-5 lg:gap-8`}>
      {products.map((product, i) => (
        <Reveal key={product.code} delay={Math.min(i * 60, 600)}>
          <ProductCard product={product} />
        </Reveal>
      ))}
    </div>
  );
}
