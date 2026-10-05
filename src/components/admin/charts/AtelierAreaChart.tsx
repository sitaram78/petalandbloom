import React, { useState, useId } from 'react';
import { formatPrice } from '@/data/products';

export interface ChartDataPoint {
  date: string;
  label: string;
  value: number; // in Rupees
  ordersCount?: number;
}

interface AtelierAreaChartProps {
  data: ChartDataPoint[];
  title?: string;
  subtitle?: string;
  height?: number;
  timeRange?: '7d' | '30d' | '90d';
  onTimeRangeChange?: (range: '7d' | '30d' | '90d') => void;
}

export default function AtelierAreaChart({
  data,
  title = 'Revenue Trajectory',
  subtitle = 'Daily captured revenue over time',
  height = 240,
  timeRange = '30d',
  onTimeRangeChange,
}: AtelierAreaChartProps) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="bg-linen p-6 rounded-atelier-panel border border-canvas-line shadow-soft flex items-center justify-center h-64 text-xs text-ink-light italic">
        No sales data available for this timeframe.
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const maxValue = Math.max(...values, 1000);
  const paddingX = 40;
  const paddingY = 30;
  const chartWidth = 700;
  const chartHeight = height;

  const points = data.map((d, i) => {
    const x = paddingX + (i / Math.max(1, data.length - 1)) * (chartWidth - paddingX * 2);
    const y = chartHeight - paddingY - (d.value / maxValue) * (chartHeight - paddingY * 2);
    return { x, y, ...d };
  });

  // Build SVG path
  const linePath = points.reduce((acc, curr, idx) => {
    if (idx === 0) return `M ${curr.x},${curr.y}`;
    const prev = points[idx - 1];
    const cpX = (prev.x + curr.x) / 2;
    return `${acc} C ${cpX},${prev.y} ${cpX},${curr.y} ${curr.x},${curr.y}`;
  }, '');

  const areaPath = `${linePath} L ${points[points.length - 1].x},${chartHeight - paddingY} L ${points[0].x},${chartHeight - paddingY} Z`;

  const activePoint = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : null;

  // Grid lines
  const gridLevels = [0, 0.33, 0.66, 1];

  return (
    <div className="bg-linen p-6 rounded-atelier-panel border border-canvas-line shadow-soft space-y-4">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-canvas-line">
        <div>
          <h3 className="font-serif text-lg text-bark font-bold">{title}</h3>
          <p className="text-xs text-ink-light">{subtitle}</p>
        </div>

        {onTimeRangeChange && (
          <div className="flex items-center gap-1 bg-canvas/40 p-1 rounded-sm border border-canvas-line text-xs font-medium self-start sm:self-auto">
            {(['7d', '30d', '90d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => onTimeRangeChange(r)}
                className={`px-2.5 py-1 rounded-sm uppercase tracking-wider text-[10px] font-semibold transition-all ${
                  timeRange === r
                    ? 'bg-bark text-white shadow-soft'
                    : 'text-ink-light hover:text-ink'
                }`}
              >
                {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : 'Quarter'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Responsive SVG Chart */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto overflow-visible"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8A3344" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#8A3344" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {gridLevels.map((lvl, idx) => {
            const y = chartHeight - paddingY - lvl * (chartHeight - paddingY * 2);
            const valLabel = Math.round(lvl * maxValue);
            return (
              <g key={idx}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={chartWidth - paddingX}
                  y2={y}
                  stroke="#E5DECE"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="#786C5E"
                  fontSize="9"
                  fontFamily="sans-serif"
                >
                  ₹{valLabel >= 1000 ? `${(valLabel / 1000).toFixed(0)}k` : valLabel}
                </text>
              </g>
            );
          })}

          {/* Area & Line */}
          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path
            d={linePath}
            fill="none"
            stroke="#8A3344"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Invisible hover trigger columns */}
          {points.map((p, i) => {
            const colWidth = (chartWidth - paddingX * 2) / points.length;
            return (
              <rect
                key={i}
                x={p.x - colWidth / 2}
                y={paddingY}
                width={colWidth}
                height={chartHeight - paddingY * 2}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(i)}
                className="cursor-pointer"
              />
            );
          })}

          {/* Active Hover Point & Vertical Guide */}
          {activePoint && (
            <g>
              <line
                x1={activePoint.x}
                y1={paddingY}
                x2={activePoint.x}
                y2={chartHeight - paddingY}
                stroke="#8A3344"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="6"
                fill="#8A3344"
                stroke="#FFF"
                strokeWidth="2"
                className="filter drop-shadow-sm"
              />
            </g>
          )}

          {/* Date Axis Labels */}
          {points.filter((_, idx) => idx % Math.ceil(points.length / 6) === 0 || idx === points.length - 1).map((p, idx) => (
            <text
              key={idx}
              x={p.x}
              y={chartHeight - 8}
              textAnchor="middle"
              fill="#786C5E"
              fontSize="9"
              fontFamily="sans-serif"
            >
              {p.label}
            </text>
          ))}
        </svg>

        {/* Floating Tooltip */}
        {activePoint && (
          <div
            className="absolute z-10 pointer-events-none transform -translate-x-1/2 -translate-y-full bg-bark text-linen px-3 py-2 rounded-sm shadow-xl text-xs space-y-0.5 border border-canvas-line transition-all duration-75"
            style={{
              left: `${(activePoint.x / chartWidth) * 100}%`,
              top: `${(activePoint.y / chartHeight) * 100}%`,
              marginTop: '-12px',
            }}
          >
            <p className="text-[10px] text-rose font-medium uppercase tracking-wider">{activePoint.date}</p>
            <p className="font-serif font-bold text-sm">{formatPrice(activePoint.value)}</p>
            {typeof activePoint.ordersCount === 'number' && (
              <p className="text-[10px] text-ink-light/80">
                {activePoint.ordersCount} {activePoint.ordersCount === 1 ? 'order' : 'orders'} captured
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
