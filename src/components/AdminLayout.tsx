import React, { useState } from 'react';
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
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface AdminLayoutProps {
  children: React.ReactNode;
  activePage: 'dashboard' | 'orders' | 'editor' | 'settings' | 'navigation' | 'assets' | 'coupons';
}

export default function AdminLayout({ children, activePage }: AdminLayoutProps) {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <div className="min-h-screen bg-parchment-50 flex">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-ink text-parchment-50 flex items-center justify-between px-4 z-50 shadow-md">
        <div className="flex items-center gap-2">
          <Package size={20} className="text-rose" />
          <span className="heading-serif text-lg">Studio Admin</span>
        </div>
        <button
          onClick={toggleMobileMenu}
          className="w-10 h-10 flex items-center justify-center rounded-md bg-rose text-ink hover:bg-rose-deep hover:text-white transition-colors"
          aria-label={isMobileMenuOpen ? 'Close admin menu' : 'Open admin menu'}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`bg-ink text-white fixed md:sticky top-0 h-screen z-50 transition-all duration-500 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${isCollapsed ? 'md:w-20' : 'md:w-64'} w-64 flex flex-col`}
      >
        <div className={`p-6 border-b border-white/10 transition-all duration-500 overflow-hidden ${
          isCollapsed ? 'px-4' : ''
        }`}>
          {!isCollapsed ? (
            <>
              <p className="text-xs uppercase tracking-[0.3em] text-rose mb-1">Studio Admin</p>
              <h2 className="heading-serif text-xl truncate text-white">Atelier Control</h2>
            </>
          ) : (
            <div className="flex justify-center">
              <Package size={24} className="text-rose" />
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Link
            to="/admin/dashboard"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-sm transition-all duration-300 ${
              activePage === 'dashboard'
                ? 'bg-white/20 text-white font-medium shadow-inner'
                : 'hover:bg-white/10 text-white/60 hover:text-white'
            } ${isCollapsed ? 'justify-center px-2' : ''}`}
            title="Dashboard"
          >
            <LayoutDashboard size={18} />
            {!isCollapsed && <span className="text-sm">Dashboard</span>}
          </Link>
          <Link
            to="/admin/orders"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-sm transition-all duration-300 ${
              activePage === 'orders'
                ? 'bg-white/20 text-white font-medium shadow-inner'
                : 'hover:bg-white/10 text-white/60 hover:text-white'
            } ${isCollapsed ? 'justify-center px-2' : ''}`}
            title="Orders & Shipments"
          >
            <Truck size={18} />
            {!isCollapsed && <span className="text-sm">Orders & Shipments</span>}
          </Link>
          <Link
            to="/admin/editor"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-sm transition-all duration-300 ${
              activePage === 'editor'
                ? 'bg-white/20 text-white font-medium shadow-inner'
                : 'hover:bg-white/10 text-white/60 hover:text-white'
            } ${isCollapsed ? 'justify-center px-2' : ''}`}
            title="Add New Piece"
          >
            <Plus size={18} />
            {!isCollapsed && <span className="text-sm">Add New Piece</span>}
          </Link>
          <Link
            to="/admin/settings"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-sm transition-all duration-300 ${
              activePage === 'settings'
                ? 'bg-white/20 text-white font-medium shadow-inner'
                : 'hover:bg-white/10 text-white/60 hover:text-white'
            } ${isCollapsed ? 'justify-center px-2' : ''}`}
            title="Category Manager"
          >
            <SlidersHorizontal size={18} />
            {!isCollapsed && <span className="text-sm">Category Manager</span>}
          </Link>
          <Link
            to="/admin/navigation"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-sm transition-all duration-300 ${
              activePage === 'navigation'
                ? 'bg-white/20 text-white font-medium shadow-inner'
                : 'hover:bg-white/10 text-white/60 hover:text-white'
            } ${isCollapsed ? 'justify-center px-2' : ''}`}
            title="Navigation Manager"
          >
            <GripVertical size={18} />
            {!isCollapsed && <span className="text-sm">Navigation</span>}
          </Link>
          <Link
            to="/admin/assets"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-sm transition-all duration-300 ${
              activePage === 'assets'
                ? 'bg-white/20 text-white font-medium shadow-inner'
                : 'hover:bg-white/10 text-white/60 hover:text-white'
            } ${isCollapsed ? 'justify-center px-2' : ''}`}
            title="Studio Visuals"
          >
            <Palette size={18} />
            {!isCollapsed && <span className="text-sm">Studio Visuals</span>}
          </Link>
          <Link
            to="/admin/coupons"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-sm transition-all duration-300 ${
              activePage === 'coupons'
                ? 'bg-white/20 text-white font-medium shadow-inner'
                : 'hover:bg-white/10 text-white/60 hover:text-white'
            } ${isCollapsed ? 'justify-center px-2' : ''}`}
            title="Coupons"
          >
            <Ticket size={18} />
            {!isCollapsed && <span className="text-sm">Coupons</span>}
          </Link>
        </nav>

        <div className="p-4 border-t border-white/10 space-y-4">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-sm hover:bg-rose/20 text-white/60 hover:text-rose transition-all disabled:opacity-50 ${
              isCollapsed ? 'justify-center px-2' : ''
            }`}
            title="Sign Out"
          >
            {isLoggingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
            {!isCollapsed && <span className="text-sm">Sign Out</span>}
          </button>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex w-full items-center justify-center p-2 rounded-sm hover:bg-white/5 text-white/40 hover:text-white transition-all"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto transition-all duration-500 ${isCollapsed ? 'md:ml-0' : 'md:ml-0'}`}>
        <div className="pt-16 md:pt-0">
          {children}
        </div>
      </main>
    </div>
  );
}
