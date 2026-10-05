import React from 'react';

interface AtelierSparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

export default function AtelierSparkline({
  data,
  color = '#8A3344', // studio rose
  width = 80,
  height = 24,
}: AtelierSparklineProps) {
  if (!data || data.length < 2) {
    return <div className="w-16 h-6 bg-canvas/30 rounded" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible inline-block">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
