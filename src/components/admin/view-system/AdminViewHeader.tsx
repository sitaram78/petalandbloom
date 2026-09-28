import React, { ReactNode } from 'react';

export interface ViewHeaderStat {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: ReactNode;
  badge?: string;
  badgeColor?: string;
}

export interface ViewHeaderAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  title?: string;
}

interface AdminViewHeaderProps {
  category?: string;
  title: string;
  subtitle?: string;
  stats?: ViewHeaderStat[];
  primaryAction?: ViewHeaderAction;
  secondaryActions?: ViewHeaderAction[];
  children?: ReactNode;
}

export default function AdminViewHeader({
  category,
  title,
  subtitle,
  stats,
  primaryAction,
  secondaryActions,
  children,
}: AdminViewHeaderProps) {
  return (
    <header className="space-y-6 mb-8">
      {/* Top Title & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {category && (
            <p className="text-xs uppercase tracking-[0.25em] text-rose font-medium mb-1">
              {category}
            </p>
          )}
          <h1 className="heading-serif text-3xl sm:text-4xl text-bark tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-ink-light font-light mt-1 max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>

        {/* Action Buttons Group */}
        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          {secondaryActions?.map((action, idx) => (
            <button
              key={idx}
              onClick={action.onClick}
              disabled={action.disabled}
              title={action.title}
              className="px-3.5 py-2 bg-linen border border-canvas-line text-xs font-medium text-bark hover:border-bark hover:bg-canvas/40 rounded-sm flex items-center gap-1.5 transition-all shadow-soft disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}

          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              title={primaryAction.title}
              className="px-4 py-2 bg-ink text-white hover:bg-bark text-xs font-medium uppercase tracking-wider rounded-sm flex items-center gap-1.5 transition-all shadow-soft disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {primaryAction.icon}
              <span>{primaryAction.label}</span>
            </button>
          )}

          {children}
        </div>
      </div>

      {/* Optional Top KPI Stats Grid */}
      {stats && stats.length > 0 && (
        <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-${Math.min(stats.length, 4)} gap-4 pt-1`}>
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="bg-linen p-5 rounded-sm border border-canvas-line shadow-soft transition-all hover:border-rose/40"
            >
              <div className="flex items-center justify-between text-bark">
                <span className="text-[11px] uppercase tracking-wider text-ink-light font-semibold truncate">
                  {stat.label}
                </span>
                {stat.icon && <div className="text-rose flex-shrink-0">{stat.icon}</div>}
              </div>
              <p className="font-serif text-2xl sm:text-3xl text-bark mt-2 truncate">
                {stat.value}
              </p>
              {stat.subtext && (
                <p className="text-[11px] text-ink-light mt-1 truncate">
                  {stat.subtext}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </header>
  );
}
