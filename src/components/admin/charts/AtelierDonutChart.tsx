import React, { useState } from 'react';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface AtelierDonutChartProps {
  segments: DonutSegment[];
  title?: string;
  subtitle?: string;
  centerLabel?: string;
  size?: number;
}

export default function AtelierDonutChart({
  segments,
  title = 'Order Pipeline',
  subtitle = 'Status distribution across studio orders',
  centerLabel = 'Total Orders',
  size = 130,
}: AtelierDonutChartProps) {
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);

  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return (
      <div className="bg-linen p-6 rounded-atelier-panel border border-canvas-line shadow-soft flex items-center justify-center h-64 text-xs text-ink-light italic">
        No orders recorded in the pipeline.
      </div>
    );
  }

  const radius = size / 2;
  const strokeWidth = 22;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  let accumulatedPercent = 0;

  return (
    <div className="bg-linen p-6 rounded-atelier-panel border border-canvas-line shadow-soft flex flex-col justify-between space-y-4 h-full">
      <div className="pb-3 border-b border-canvas-line">
        <h3 className="font-serif text-lg text-bark font-bold">{title}</h3>
        <p className="text-xs text-ink-light">{subtitle}</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-5 my-auto">
        {/* SVG Donut */}
        <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="transform -rotate-90">
            {segments.map((seg, idx) => {
              const percent = seg.value / total;
              const strokeDashoffset = circumference - percent * circumference;
              const rotation = accumulatedPercent * 360;
              accumulatedPercent += percent;

              const isHovered = activeSegmentIndex === idx;

              return (
                <circle
                  key={idx}
                  cx={radius}
                  cy={radius}
                  r={normalizedRadius}
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={strokeDashoffset}
                  style={{
                    transformOrigin: `${radius}px ${radius}px`,
                    transform: `rotate(${rotation}deg)`,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={() => setActiveSegmentIndex(idx)}
                  onMouseLeave={() => setActiveSegmentIndex(null)}
                  className="cursor-pointer"
                />
              );
            })}
          </svg>

          {/* Center Cutout Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
            <span className="font-serif text-2xl font-bold text-bark leading-none">
              {activeSegmentIndex !== null ? segments[activeSegmentIndex].value : total}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-ink-light mt-1 max-w-[85px] truncate font-medium">
              {activeSegmentIndex !== null ? segments[activeSegmentIndex].label : centerLabel}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-1.5 flex-1 w-full min-w-0">
          {segments.map((seg, idx) => {
            const pct = Math.round((seg.value / total) * 100);
            const isHovered = activeSegmentIndex === idx;

            return (
              <div
                key={idx}
                onMouseEnter={() => setActiveSegmentIndex(idx)}
                onMouseLeave={() => setActiveSegmentIndex(null)}
                className={`flex items-center justify-between gap-3 py-1.5 px-2 rounded text-xs transition-colors cursor-pointer ${
                  isHovered ? 'bg-canvas/60 font-semibold' : 'hover:bg-canvas/30'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="truncate text-bark text-xs font-medium">{seg.label}</span>
                </div>
                <div className="flex items-center justify-end gap-1.5 text-ink-light flex-shrink-0 font-mono text-xs text-right">
                  <span className="font-bold text-bark">{seg.value}</span>
                  <span className="text-[10px] text-ink-light/70">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
