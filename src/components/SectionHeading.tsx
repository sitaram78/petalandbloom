import { type ReactNode } from 'react';
import Reveal from '@/components/Reveal';

interface SectionHeadingProps {
  label?: string;
  title: ReactNode;
  subtitle?: string;
  center?: boolean;
  className?: string;
}

export default function SectionHeading({
  label,
  title,
  subtitle,
  center = true,
  className = '',
}: SectionHeadingProps) {
  return (
    <Reveal className={`${center ? 'text-center' : ''} ${className}`}>
      {label && (
        <p className="font-serif italic text-sm text-rose mb-3 tracking-wide uppercase">
          {label}
        </p>
      )}
      <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-bark leading-tight text-balance">
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-4 text-base text-ink-light leading-relaxed ${center ? 'max-w-2xl mx-auto' : 'max-w-2xl'}`}>
          {subtitle}
        </p>
      )}
    </Reveal>
  );
}
