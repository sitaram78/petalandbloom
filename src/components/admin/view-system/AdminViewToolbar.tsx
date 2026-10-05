import React, { ReactNode } from 'react';
import {
  Search,
  X,
  LayoutGrid,
  Table as TableIcon,
  Columns3,
  Split,
  RefreshCw,
} from 'lucide-react';
import type { ViewMode } from './useAdminView';

export interface ViewSegmentTab {
  id: string;
  label: string;
  count?: number;
}

interface AdminViewToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchPlaceholder?: string;
  tabs?: ViewSegmentTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  supportedModes?: ViewMode[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
  filterControls?: ReactNode;
  actionsSlot?: ReactNode;
}

export default function AdminViewToolbar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search...',
  tabs,
  activeTab,
  onTabChange,
  viewMode = 'table',
  onViewModeChange,
  supportedModes = ['table', 'grid', 'kanban'],
  onRefresh,
  isRefreshing,
  filterControls,
  actionsSlot,
}: AdminViewToolbarProps) {
  return (
    <div className="bg-linen p-4 rounded-sm border border-canvas-line shadow-soft mb-6 space-y-4">
      {/* Upper Toolbar: Search + View Mode Switcher + Extra Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Universal Search Input */}
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-8 py-2 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-light hover:text-ink"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* View Mode Toggle & Custom Actions */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          {filterControls}

          {/* View Mode Switcher */}
          {onViewModeChange && supportedModes.length > 1 && (
            <div className="flex items-center bg-canvas/40 border border-canvas-line rounded-sm p-0.5">
              {supportedModes.includes('table') && (
                <button
                  type="button"
                  onClick={() => onViewModeChange('table')}
                  className={`p-1.5 rounded-sm transition-colors ${
                    viewMode === 'table'
                      ? 'bg-ink text-white shadow-soft'
                      : 'text-bark/70 hover:text-ink hover:bg-canvas/50'
                  }`}
                  title="Table View"
                >
                  <TableIcon size={14} />
                </button>
              )}
              {supportedModes.includes('grid') && (
                <button
                  type="button"
                  onClick={() => onViewModeChange('grid')}
                  className={`p-1.5 rounded-sm transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-ink text-white shadow-soft'
                      : 'text-bark/70 hover:text-ink hover:bg-canvas/50'
                  }`}
                  title="Card / Gallery View"
                >
                  <LayoutGrid size={14} />
                </button>
              )}
              {supportedModes.includes('kanban') && (
                <button
                  type="button"
                  onClick={() => onViewModeChange('kanban')}
                  className={`p-1.5 rounded-sm transition-colors ${
                    viewMode === 'kanban'
                      ? 'bg-ink text-white shadow-soft'
                      : 'text-bark/70 hover:text-ink hover:bg-canvas/50'
                  }`}
                  title="Pipeline / Kanban View"
                >
                  <Columns3 size={14} />
                </button>
              )}
              {supportedModes.includes('split') && (
                <button
                  type="button"
                  onClick={() => onViewModeChange('split')}
                  className={`p-1.5 rounded-sm transition-colors ${
                    viewMode === 'split'
                      ? 'bg-ink text-white shadow-soft'
                      : 'text-bark/70 hover:text-ink hover:bg-canvas/50'
                  }`}
                  title="Split View"
                >
                  <Split size={14} />
                </button>
              )}
            </div>
          )}

          {actionsSlot}

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 bg-linen border border-canvas-line text-xs font-medium text-bark hover:border-bark rounded-sm transition-colors disabled:opacity-50"
              title="Refresh dataset"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-rose' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* Lower Toolbar: Segment / Presets Tab Navigation */}
      {tabs && tabs.length > 0 && onTabChange && (
        <div className="relative pt-2 border-t border-canvas-line/60">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 scroll-smooth pr-6 sm:pr-0">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`px-3 py-1.5 rounded-sm text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0 ${
                    isActive
                      ? 'bg-bark text-white shadow-soft'
                      : 'bg-canvas/40 hover:bg-canvas text-bark/80 hover:text-ink border border-transparent hover:border-canvas-line'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        isActive ? 'bg-white/20 text-white' : 'bg-canvas-line text-ink-light'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {/* Subtle mobile edge fade indicator showing more tabs exist */}
          <div className="sm:hidden pointer-events-none absolute right-0 top-2 bottom-0 w-8 bg-gradient-to-l from-linen to-transparent" />
        </div>
      )}
    </div>
  );
}
