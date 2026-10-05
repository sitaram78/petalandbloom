import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  BarChart3,
  Truck,
  Users,
  MessageCircle,
  Star,
  Plus,
  SlidersHorizontal,
  GripVertical,
  Palette,
  Ticket,
  Sparkles,
  ShoppingBag,
  FileText,
  ExternalLink,
  ArrowRight,
  Package,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PaletteItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Navigation' | 'Actions' | 'Recent Orders';
  icon: React.ReactNode;
  action: () => void;
  badge?: string;
}

export default function CommandPaletteModal({ isOpen, onClose }: CommandPaletteModalProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);

      // Fetch quick recent orders
      supabase
        .from('orders')
        .select('id, order_number, guest_name, order_status, total_in_paise')
        .order('created_at', { ascending: false })
        .limit(5)
        .then(({ data }) => {
          if (data) setRecentOrders(data);
        });
    }
  }, [isOpen]);

  // Standard static navigation and action commands
  const staticItems: PaletteItem[] = [
    {
      id: 'nav-dashboard',
      title: 'Studio Dashboard',
      subtitle: 'Executive KPIs, daily revenue, active orders overview',
      category: 'Navigation',
      icon: <LayoutDashboard size={18} className="text-rose" />,
      action: () => { navigate('/admin/dashboard'); onClose(); },
    },
    {
      id: 'nav-reports',
      title: 'Executive Reports & Analytics',
      subtitle: 'Financial reconciliation, velocity, loyalty ledger, logistics',
      category: 'Navigation',
      icon: <BarChart3 size={18} className="text-amber-600" />,
      action: () => { navigate('/admin/reports'); onClose(); },
    },
    {
      id: 'nav-orders',
      title: 'Orders & Shipments',
      subtitle: 'Manage order status, dispatch, waybills, and tracking',
      category: 'Navigation',
      icon: <Truck size={18} className="text-emerald-700" />,
      action: () => { navigate('/admin/orders'); onClose(); },
    },
    {
      id: 'nav-customers',
      title: 'Patrons CRM & Loyalty',
      subtitle: 'Customer profiles, lifetime spend, and Petal Points balances',
      category: 'Navigation',
      icon: <Users size={18} className="text-purple-700" />,
      action: () => { navigate('/admin/customers'); onClose(); },
    },
    {
      id: 'nav-messages',
      title: 'Live Assistance Inbox',
      subtitle: 'Customer chat inquiries, guest questions, and concierge',
      category: 'Navigation',
      icon: <MessageCircle size={18} className="text-sky-700" />,
      action: () => { navigate('/admin/messages'); onClose(); },
    },
    {
      id: 'nav-reviews',
      title: 'Customer Reviews & UGC',
      subtitle: 'Moderation queue, published testimonials, photo gallery',
      category: 'Navigation',
      icon: <Star size={18} className="text-amber-500" />,
      action: () => { navigate('/admin/reviews'); onClose(); },
    },
    {
      id: 'nav-editor',
      title: 'Add New Bloom / Piece',
      subtitle: 'Create a new crochet bloom, bouquet, or custom gift piece',
      category: 'Actions',
      icon: <Plus size={18} className="text-rose-deep" />,
      action: () => { navigate('/admin/editor'); onClose(); },
      badge: 'Action',
    },
    {
      id: 'nav-settings',
      title: 'Company Settings & Storefront Flags',
      subtitle: 'Store configuration, shipping rules, WhatsApp & payment settings',
      category: 'Navigation',
      icon: <SlidersHorizontal size={18} className="text-ink" />,
      action: () => { navigate('/admin/settings'); onClose(); },
    },
    {
      id: 'nav-coupons',
      title: 'Coupons & Promos',
      subtitle: 'Discount vouchers, promo campaigns, and seasonal offers',
      category: 'Navigation',
      icon: <Ticket size={18} className="text-teal-700" />,
      action: () => { navigate('/admin/coupons'); onClose(); },
    },
    {
      id: 'nav-influencers',
      title: 'Ambassadors & Affiliates',
      subtitle: 'Creator partnerships, referral discount codes, and UTR payouts',
      category: 'Navigation',
      icon: <Sparkles size={18} className="text-rose" />,
      action: () => { navigate('/admin/influencers'); onClose(); },
    },
    {
      id: 'nav-abandoned',
      title: 'Abandoned Checkouts',
      subtitle: 'Recoverable cart sessions with WhatsApp & email reminders',
      category: 'Navigation',
      icon: <ShoppingBag size={18} className="text-orange-700" />,
      action: () => { navigate('/admin/abandoned-carts'); onClose(); },
    },
    {
      id: 'nav-assets',
      title: 'Studio Visuals & Media',
      subtitle: 'Curated imagery, banner assets, and product CDN uploads',
      category: 'Navigation',
      icon: <Palette size={18} className="text-indigo-700" />,
      action: () => { navigate('/admin/assets'); onClose(); },
    },
    {
      id: 'nav-navigation',
      title: 'Storefront Navigation Manager',
      subtitle: 'Header links, mobile menus, and collection taxonomy',
      category: 'Navigation',
      icon: <GripVertical size={18} className="text-bark" />,
      action: () => { navigate('/admin/navigation'); onClose(); },
    },
    {
      id: 'nav-audit',
      title: 'Audit Logs & Security Trail',
      subtitle: 'Immutable record of staff actions, edits, and status transitions',
      category: 'Navigation',
      icon: <FileText size={18} className="text-ink-light" />,
      action: () => { navigate('/admin/audit-logs'); onClose(); },
    },
    {
      id: 'action-view-store',
      title: 'Preview Live Storefront',
      subtitle: 'Opens the public shop in a new browser tab',
      category: 'Actions',
      icon: <ExternalLink size={18} className="text-rose" />,
      action: () => { window.open('/', '_blank'); onClose(); },
      badge: 'Storefront',
    },
  ];

  // Dynamic order items
  const orderItems: PaletteItem[] = recentOrders.map((ord) => ({
    id: `order-${ord.id}`,
    title: `Order ${ord.order_number}`,
    subtitle: `${ord.guest_name || 'Guest'} • ₹${((ord.total_in_paise || 0) / 100).toFixed(0)} • ${ord.order_status}`,
    category: 'Recent Orders',
    icon: <Package size={18} className="text-bark" />,
    action: () => {
      navigate('/admin/orders');
      onClose();
    },
    badge: ord.order_status,
  }));

  const allItems = [...staticItems, ...orderItems];

  // Filter items by search query
  const filteredItems = allItems.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
      item.category.toLowerCase().includes(q)
    );
  });

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;

      if (e.key === 'Escape' || e.key === 'Esc' || e.code === 'Escape' || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, selectedIndex, filteredItems, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-3 sm:px-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-linen rounded-atelier-panel border border-canvas-line shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-3 sm:p-4 border-b border-canvas-line bg-canvas/40 flex items-center gap-2.5 sm:gap-3">
          <Search size={19} className="text-rose flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || e.key === 'Esc' || e.code === 'Escape' || e.keyCode === 27) {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }
            }}
            placeholder="Type a command, page name, or search recent orders..."
            className="flex-1 min-w-0 bg-transparent text-sm sm:text-base text-bark placeholder:text-ink-light/50 focus:outline-none font-medium"
          />
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] uppercase font-mono font-semibold bg-white border border-canvas-line rounded text-ink-light shadow-2xs">
              ESC
            </kbd>
            <button
              type="button"
              onClick={onClose}
              className="p-1 sm:p-1.5 rounded-full hover:bg-canvas text-ink-light hover:text-bark transition-colors focus:outline-none focus:ring-1 focus:ring-rose"
              aria-label="Close search"
              title="Close search (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-canvas-line/40">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-ink-light">
              No matching pages, orders, or actions found for "{query}".
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full p-3 rounded-sm flex items-center justify-between text-left transition-all ${
                    isSelected ? 'bg-white shadow-soft border-l-4 border-l-rose' : 'hover:bg-canvas/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded bg-linen border border-canvas-line/80 flex-shrink-0">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="font-serif text-sm font-semibold text-bark truncate">{item.title}</p>
                      {item.subtitle && (
                        <p className="text-[11px] text-ink-light truncate mt-0.5">{item.subtitle}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {item.badge && (
                      <span className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-canvas border border-canvas-line text-ink-light">
                        {item.badge}
                      </span>
                    )}
                    <span className="text-[10px] uppercase tracking-wider text-ink-light/60 font-mono hidden sm:inline">
                      {item.category}
                    </span>
                    <ArrowRight size={14} className={`text-rose transition-transform ${isSelected ? 'translate-x-1' : 'opacity-0'}`} />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Guide */}
        <footer className="p-3 bg-canvas/30 border-t border-canvas-line flex items-center justify-between text-[11px] text-ink-light">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1 py-0.5 bg-white border border-canvas-line rounded text-[10px]">↑</kbd> <kbd className="px-1 py-0.5 bg-white border border-canvas-line rounded text-[10px]">↓</kbd> to navigate</span>
            <span><kbd className="px-1.5 py-0.5 bg-white border border-canvas-line rounded text-[10px]">↵</kbd> to select</span>
          </div>
          <span className="text-[10px] text-rose font-medium">The Petal &amp; Bloom Atelier</span>
        </footer>
      </div>
    </div>
  );
}
