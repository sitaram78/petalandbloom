import React from 'react';

interface AtelierButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  isLoading?: boolean;
}

const AtelierButton: React.FC<AtelierButtonProps> = ({
  children,
  variant = 'primary',
  isLoading = false,
  className = '',
  ...props
}) => {
  const variants = {
    primary: 'bg-rose text-linen hover:bg-rose-deep',
    secondary: 'bg-moss text-linen hover:bg-moss-soft',
    ghost: 'border border-ink text-ink hover:bg-bark hover:text-linen',
  };

  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium transition-all duration-200 whitespace-nowrap
        rounded-atelier-btn active:scale-95 disabled:opacity-50
        ${variants[variant]}
        ${className}
      `}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <div className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      ) : (
        children
      )}
    </button>
  );
};

export default AtelierButton;
