import { type ReactNode } from 'react';
import Reveal from '@/components/Reveal';

interface PageHeaderProps {
  label?: string;
  title: ReactNode;
  subtitle?: string;
  image?: string;
}

export default function PageHeader({ label, title, subtitle, image }: PageHeaderProps) {
  return (
    <div className="relative pt-28 pb-12 lg:pt-36 lg:pb-16 overflow-hidden">
      {image && (
        <div className="absolute inset-0">
          <img src={image} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-parchment-50/85" />
        </div>
      )}
      <div className="container-lux relative">
        <Reveal>
          {label && <p className="section-label mb-3">{label}</p>}
          <h1 className="heading-serif text-4xl sm:text-5xl lg:text-6xl text-balance">{title}</h1>
          {subtitle && (
            <p className="mt-4 text-lg text-ink-light leading-relaxed max-w-2xl">
              {subtitle}
            </p>
          )}
        </Reveal>
      </div>
    </div>
  );
}
