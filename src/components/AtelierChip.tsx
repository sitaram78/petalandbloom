import React from 'react';

interface AtelierChipProps {
  children: React.ReactNode;
  active?: boolean;
  variant?: 'default' | 'toggle' | 'occasion';
  onClick?: () => void;
  className?: string;
}

const AtelierChip: React.FC<AtelierChipProps> = ({
  children,
  active = false,
  variant = 'default',
  onClick,
  className = '',
}) => {
  const variantStyles = {
    default: active
      ? 'bg-bark text-linen border-bark'
      : 'bg-transparent text-ink border-canvas-line',
    toggle: active
      ? 'bg-moss text-linen border-moss'
      : 'bg-transparent text-moss border-moss-soft',
    occasion: active
      ? 'bg-rose text-linen border-rose'
      : 'bg-canvas text-ink-light border-transparent',
  };

  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-2 px-4 py-2 text-xs font-medium
        border rounded-full transition-all duration-200 whitespace-nowrap
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {variant === 'toggle' && (
        <span className={`w-2 h-2 rounded-full border ${active ? 'bg-linen border-linen' : 'border-moss'}`} />
      )}
      {children}
    </button>
  );
};

export default AtelierChip;
