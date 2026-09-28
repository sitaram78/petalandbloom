import React, { ReactNode } from 'react';

export interface KanbanColumn<T> {
  id: string;
  title: string;
  badgeColor?: string;
  items: T[];
  emptyMessage?: string;
}

interface AdminKanbanBoardProps<T> {
  columns: KanbanColumn<T>[];
  renderCard: (item: T) => ReactNode;
}

export default function AdminKanbanBoard<T>({
  columns,
  renderCard,
}: AdminKanbanBoardProps<T>) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin">
      {columns.map((column) => (
        <div
          key={column.id}
          className="w-80 flex-shrink-0 bg-parchment/40 rounded-sm border border-canvas-line flex flex-col max-h-[calc(100vh-220px)]"
        >
          {/* Column Header */}
          <div className="p-3.5 border-b border-canvas-line bg-canvas/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  column.badgeColor || 'bg-rose'
                }`}
              />
              <h3 className="font-semibold text-xs text-bark uppercase tracking-wider">
                {column.title}
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-canvas border border-canvas-line text-ink">
              {column.items.length}
            </span>
          </div>

          {/* Cards List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {column.items.length === 0 ? (
              <div className="py-8 text-center text-xs text-ink-light/70 italic border border-dashed border-canvas-line/80 rounded-sm">
                {column.emptyMessage || 'No items in this stage'}
              </div>
            ) : (
              column.items.map((item, idx) => (
                <div key={idx} className="transition-transform hover:-translate-y-0.5">
                  {renderCard(item)}
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
