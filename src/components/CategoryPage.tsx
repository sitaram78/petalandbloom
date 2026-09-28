import { type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import ProductGrid from '@/components/ProductGrid';
import Reveal from '@/components/Reveal';
import WhatsAppButton from '@/components/WhatsAppButton';
import type { Product } from '@/data/products';
import { customOrderMessage } from '@/utils/whatsapp';

interface CategoryPageProps {
  label: string;
  title: ReactNode;
  subtitle: string;
  image?: string;
  products: Product[];
  columns?: 2 | 3 | 4;
  showCustomCTA?: boolean;
  children?: ReactNode;
}

export default function CategoryPage({
  label, title, subtitle, image, products, columns = 3, showCustomCTA = false, children,
}: CategoryPageProps) {
  return (
    <div>
      <PageHeader label={label} title={title} subtitle={subtitle} image={image} />
      <div className="container-lux pb-16">
        <ProductGrid products={products} columns={columns} />
        {children}
        {showCustomCTA && (
          <Reveal className="mt-16 text-center bg-cream-100 p-8 lg:p-12 rounded-sm">
            <h3 className="heading-serif text-2xl lg:text-3xl mb-3">
              Don't see exactly what you want?
            </h3>
            <p className="text-brown-400 max-w-md mx-auto mb-6">
              We can make it for you. Start a custom bouquet and choose every detail.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/custom" className="btn-primary">
                Create a custom bouquet <ArrowRight size={16} />
              </Link>
              <WhatsAppButton
                message={customOrderMessage()}
                label="Talk to us on WhatsApp"
                variant="outline"
              />
            </div>
          </Reveal>
        )}
      </div>
    </div>
  );
}
