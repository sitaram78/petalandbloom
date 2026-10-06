import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Plus,
  Package,
  LogOut,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  SlidersHorizontal,
  GripVertical,
  Palette,
  Ticket,
  Truck,
  Users,
  MessageCircle,
  Star,
  FileText,
  Sparkles,
  ShoppingBag,
  BarChart3,
  Search,
  ExternalLink,
  Store,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import CommandPaletteModal from '@/components/admin/CommandPaletteModal';

interface AdminLayoutProps {
  children: React.ReactNode;
  activePage:
    | 'dashboard'
    | 'orders'
    | 'editor'
    | 'occasions'
    | 'settings'
    | 'navigation'
    | 'assets'
    | 'coupons'
    | 'customers'
    | 'messages'
    | 'reviews'
    | 'audit-logs'
    | 'influencers'
    | 'abandoned-carts'
    | 'reports';
}

interface NavGroup {
  label: string;
  items: Array<{
    id: AdminLayoutProps['activePage'];
    title: string;
    path: string;
    icon: React.ReactNode;
    badgeCount?: number;
    badgeColor?: string;
  }>;
}

export default function AdminLayout({ children, activePage }: AdminLayoutProps) {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // Dynamic Operational Badges
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [pendingReviewsCount, setPendingReviewsCount] = useState(0);

  // Global Keyboard Shortcut for Command Palette: Cmd + K or Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Poll Operational Counts
  const loadBadgeCounts = async () => {
    try {
      // 1. Orders awaiting fulfillment
      const { count: ordCount } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('order_status', 'PAYMENT_CONFIRMED');
      if (ordCount !== null) setPendingOrdersCount(ordCount);

      // 2. Unread assistance threads
      const { count: msgCount } = await supabase
        .from('assistance_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING_ADMIN');
      if (msgCount !== null) setUnreadMessagesCount(msgCount);

      // 3. Pending reviews for moderation
      const { count: revCount } = await supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING');
      if (revCount !== null) setPendingReviewsCount(revCount);
    } catch (e) {
      console.warn('Error loading operational badge counts:', e);
    }
  };

  useEffect(() => {
    loadBadgeCounts();
    const interval = setInterval(loadBadgeCounts, 45000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      navigate('/admin/login');
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Structured Operational Navigation Hubs
  const navGroups: NavGroup[] = [
    {
      label: 'Intelligence',
      items: [
        {
          id: 'dashboard',
          title: 'Dashboard',
          path: '/admin/dashboard',
          icon: <LayoutDashboard size={17} />,
        },
        {
          id: 'reports',
          title: 'Reports & Analytics',
          path: '/admin/reports',
          icon: <BarChart3 size={17} />,
        },
      ],
    },
    {
      label: 'Commerce & Orders',
      items: [
        {
          id: 'orders',
          title: 'Orders & Shipments',
          path: '/admin/orders',
          icon: <Truck size={17} />,
          badgeCount: pendingOrdersCount,
          badgeColor: 'bg-emerald-600 text-white',
        },
        {
          id: 'abandoned-carts',
          title: 'Abandoned Checkouts',
          path: '/admin/abandoned-carts',
          icon: <ShoppingBag size={17} />,
        },
        {
          id: 'editor',
          title: 'Add New Piece',
          path: '/admin/editor',
          icon: <Plus size={17} />,
        },
        {
          id: 'occasions',
          title: 'Occasions & Festivals',
          path: '/admin/occasions',
          icon: <Sparkles size={17} />,
        },
      ],
    },
    {
      label: 'Patrons & Growth',
      items: [
        {
          id: 'customers',
          title: 'Patrons & CRM',
          path: '/admin/customers',
          icon: <Users size={17} />,
        },
        {
          id: 'messages',
          title: 'Live Assistance',
          path: '/admin/messages',
          icon: <MessageCircle size={17} />,
          badgeCount: unreadMessagesCount,
          badgeColor: 'bg-rose text-white',
        },
        {
          id: 'reviews',
          title: 'Customer Reviews',
          path: '/admin/reviews',
          icon: <Star size={17} />,
          badgeCount: pendingReviewsCount,
          badgeColor: 'bg-amber-500 text-ink',
        },
        {
          id: 'influencers',
          title: 'Ambassadors & Creators',
          path: '/admin/influencers',
          icon: <Sparkles size={17} />,
        },
        {
          id: 'coupons',
          title: 'Coupons & Promos',
          path: '/admin/coupons',
          icon: <Ticket size={17} />,
        },
      ],
    },
    {
      label: 'Studio System',
      items: [
        {
          id: 'settings',
          title: 'Company Settings',
          path: '/admin/settings',
          icon: <SlidersHorizontal size={17} />,
        },
        {
          id: 'assets',
          title: 'Studio Visuals',
          path: '/admin/assets',
          icon: <Palette size={17} />,
        },
        {
          id: 'navigation',
          title: 'Navigation Manager',
          path: '/admin/navigation',
          icon: <GripVertical size={17} />,
        },
        {
          id: 'audit-logs',
          title: 'Audit Logs',
          path: '/admin/audit-logs',
          icon: <FileText size={17} />,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-parchment-50 flex">
      {/* Mobile Top Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-ink text-parchment-50 flex items-center justify-between px-4 z-40 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-rose/20 text-rose flex items-center justify-center">
            <Package size={18} />
          </div>
          <div>
            <span className="font-serif text-parchment-50 font-medium text-base tracking-tight block leading-tight">The Petal &amp; Bloom</span>
            <span className="text-[9px] uppercase tracking-widest text-rose font-mono">Atelier Control</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaletteOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded bg-white/10 text-parchment-50 hover:bg-white/20 transition-colors"
            title="Search (Cmd+K)"
          >
            <Search size={16} />
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="w-9 h-9 flex items-center justify-center rounded bg-rose text-ink hover:bg-rose-deep hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Modern Sidebar Shell */}
      <aside
        className={`bg-ink text-white fixed md:sticky top-0 h-screen z-50 transition-all duration-300 ease-in-out flex flex-col shadow-2xl md:shadow-none
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${isCollapsed ? 'md:w-20' : 'md:w-64'} w-64`}
      >
        {/* Atelier Brand Header */}
        <div className={`p-5 border-b border-white/10 flex items-center justify-between transition-all duration-300 ${isCollapsed ? 'px-3 justify-center' : ''}`}>
          {!isCollapsed ? (
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.25em] text-rose font-medium">Studio Management</p>
              <h2 className="heading-serif text-lg truncate text-white tracking-wide">The Petal &amp; Bloom</h2>
            </div>
          ) : (
            <div className="w-10 h-10 rounded bg-rose/10 flex items-center justify-center text-rose">
              <Package size={20} />
            </div>
          )}
        </div>

        {/* Categorized Navigation Hubs */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-5 custom-scrollbar">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {!isCollapsed ? (
                <p className="px-3 text-[10px] uppercase tracking-wider font-semibold text-white/40 mb-1.5">
                  {group.label}
                </p>
              ) : (
                <div className="h-px bg-white/10 my-2 mx-2" />
              )}

              {group.items.map((item) => {
                const isActive = activePage === item.id;
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-sm transition-all duration-200 text-xs font-medium group ${
                      isActive
                        ? 'bg-rose text-ink font-semibold shadow-soft'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    } ${isCollapsed ? 'justify-center px-2' : ''}`}
                    title={item.title}
                  >
                    <span className={`${isActive ? 'text-ink' : 'text-white/60 group-hover:text-white'}`}>
                      {item.icon}
                    </span>

                    {!isCollapsed && (
                      <span className="flex-1 truncate">{item.title}</span>
                    )}

                    {!isCollapsed && Boolean(item.badgeCount && item.badgeCount > 0) && (
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${item.badgeColor || 'bg-rose text-white'}`}>
                        {item.badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-white/10 space-y-2">
          {/* External Storefront Link */}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2.5 px-3 py-2 rounded text-xs text-white/60 hover:text-white hover:bg-white/5 transition-all ${
              isCollapsed ? 'justify-center px-2' : ''
            }`}
            title="Preview Live Shop (New Tab)"
          >
            <Store size={16} className="text-moss flex-shrink-0" />
            {!isCollapsed && <span className="flex-1">Live Storefront</span>}
            {!isCollapsed && <ExternalLink size={12} className="text-white/40" />}
          </a>

          {/* Sign Out */}
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs text-rose/80 hover:text-rose hover:bg-rose/10 transition-all disabled:opacity-50 ${
              isCollapsed ? 'justify-center px-2' : ''
            }`}
            title="Sign Out"
          >
            {isLoggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
            {!isCollapsed && <span>Sign Out</span>}
          </button>

          {/* Collapse/Expand Toggle on Desktop */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex w-full items-center justify-center py-1.5 text-white/30 hover:text-white text-xs hover:bg-white/5 rounded transition-all"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
        {/* Desktop Top Header Bar */}
        <header className="hidden md:flex h-14 bg-white/80 backdrop-blur-md border-b border-canvas-line px-6 lg:px-10 items-center justify-between sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPaletteOpen(true)}
              className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-sm bg-canvas/40 hover:bg-canvas border border-canvas-line text-xs text-ink-light hover:text-ink transition-all shadow-2xs"
            >
              <Search size={14} className="text-rose" />
              <span>Search orders, patrons, tools...</span>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-canvas-line text-ink-light">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-linen border border-canvas-line hover:border-bark text-bark font-medium transition-all"
            >
              <Store size={14} className="text-moss" />
              <span>Preview Storefront</span>
              <ExternalLink size={12} className="text-ink-light" />
            </a>

            <div className="h-4 w-px bg-canvas-line" />

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-bark text-linen flex items-center justify-center font-bold text-xs">
                PB
              </div>
              <span className="font-medium text-bark">Studio Admin</span>
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <div className="pt-16 md:pt-0 flex-1">
          {children}
        </div>
      </main>

      {/* Global Command Palette Modal */}
      <CommandPaletteModal
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
      />
    </div>
  );
}
