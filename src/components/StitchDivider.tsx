import React from 'react';

interface StitchDividerProps {
  className?: string;
  variant?: 'light' | 'dark';
}

const StitchDivider: React.FC<StitchDividerProps> = ({ className = '', variant = 'light' }) => {
  const gradient = variant === 'light'
    ? 'repeating-linear-gradient(90deg, #CBBE9C 0 10px, transparent 10px 18px)'
    : 'repeating-linear-gradient(90deg, #55492f 0 10px, transparent 10px 18px)';

  return (
    <div
      className={`h-px w-full ${className}`}
      style={{ backgroundImage: gradient }}
    />
  );
};

export default StitchDivider;
