import { type ReactNode, type ElementType } from 'react';
import { useReveal } from '@/hooks/useReveal';

interface RevealProps extends React.HTMLAttributes<HTMLElement> {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: ElementType;
}

export default function Reveal({ children, className = '', delay = 0, as: Tag = 'div', style, ...rest }: RevealProps) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms`, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
