import { Link, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, MessageCircle, User } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useStoreSettings } from '@/context/StoreSettingsContext';
import { generalEnquiryMessage } from '@/utils/whatsapp';

export default function MobileBottomNav() {
  const location = useLocation();
  const { totalItems, openCart } = useCart();
  const { user } = useAuth();
  const { settings, triggerAssistance, isChatOpen } = useStoreSettings();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-linen/95 backdrop-blur-md border-t border-canvas-line">
      <div className="flex items-center justify-around h-16">
        <Link
          to="/"
          className={`flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors ${
            isActive('/') ? 'text-rose-deep' : 'text-ink-light'
          }`}
          aria-label="Home"
        >
          <Home size={20} strokeWidth={1.5} />
          <span className="text-[10px] font-medium">Home</span>
        </Link>

        <Link
          to="/shop"
          className={`flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors ${
            isActive('/shop') ? 'text-rose-deep' : 'text-ink-light'
          }`}
          aria-label="Shop"
        >
          <ShoppingBag size={20} strokeWidth={1.5} />
          <span className="text-[10px] font-medium">Shop</span>
        </Link>

        <button
          onClick={openCart}
          className={`flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors ${
            totalItems > 0 ? 'text-rose-deep' : 'text-ink-light'
          }`}
          aria-label={`Bag with ${totalItems} items`}
        >
          <div className="relative">
            <ShoppingBag size={20} strokeWidth={1.5} />
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-bark text-linen text-[8px] font-medium w-3.5 h-3.5 rounded-full flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium">Bag</span>
        </button>

        <Link
          to="/account"
          className={`flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors ${
            isActive('/account') ? 'text-rose-deep' : 'text-ink-light'
          }`}
          aria-label="Account"
        >
          <div className="relative">
            <User size={20} strokeWidth={1.5} />
            {user && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </div>
          <span className="text-[10px] font-medium">{user ? 'Account' : 'Sign In'}</span>
        </Link>

        <button
          type="button"
          onClick={() => triggerAssistance(generalEnquiryMessage())}
          className={`flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors cursor-pointer ${
            isChatOpen
              ? 'text-rose-deep font-semibold'
              : settings.conciergeChannelMode === 'IN_SYSTEM'
              ? 'text-rose hover:text-rose-deep'
              : 'text-moss'
          }`}
          aria-label={settings.conciergeChannelMode === 'IN_SYSTEM' ? 'Studio Concierge' : 'Order on WhatsApp'}
        >
          <MessageCircle size={20} strokeWidth={1.5} />
          <span className="text-[10px] font-medium">Concierge</span>
        </button>
      </div>
    </nav>
  );
}
