import React, { useEffect, ReactNode } from 'react';
import { X } from 'lucide-react';

interface AdminEntityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  children: ReactNode;
  footerActions?: ReactNode;
  widthClass?: string; // e.g. 'max-w-2xl', 'max-w-3xl'
}

export default function AdminEntityDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  children,
  footerActions,
  widthClass = 'max-w-xl',
}: AdminEntityDrawerProps) {
  // Lock background scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Dimmed backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-fadeIn"
      />

      {/* Slide-Over Drawer Container */}
      <div
        className={`relative z-10 w-full ${widthClass} bg-linen h-full shadow-2xl border-l border-canvas-line flex flex-col transform transition-transform duration-300 ease-out animate-slideLeft`}
      >
        {/* Drawer Header */}
        <header className="p-5 border-b border-canvas-line bg-canvas/40 flex items-center justify-between gap-4">
          <div className="space-y-0.5 truncate">
            {badge && <div className="mb-1">{badge}</div>}
            <h2 className="heading-serif text-2xl text-bark truncate">{title}</h2>
            {subtitle && <p className="text-xs text-ink-light truncate">{subtitle}</p>}
          </div>

          <button
            onClick={onClose}
            className="p-2 text-bark/60 hover:text-ink hover:bg-canvas/50 rounded-sm transition-colors flex-shrink-0"
            title="Close drawer (Esc)"
          >
            <X size={18} />
          </button>
        </header>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {children}
        </div>

        {/* Drawer Footer Actions (Optional) */}
        {footerActions && (
          <footer className="p-4 border-t border-canvas-line bg-canvas/30 flex items-center justify-end gap-3 flex-shrink-0">
            {footerActions}
          </footer>
        )}
      </div>
    </div>
  );
}
