import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, MessageCircle, Menu, X, XCircle, Heart, ChevronDown, User } from 'lucide-react';
import { brandInfo } from '@/data/site';
import { formatPrice } from '@/data/products';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useAuth } from '@/context/AuthContext';
import { useProducts } from '@/context/ProductContext';
import { useSiteAssets, getDynamicAsset } from '@/context/SiteAssetsContext';
import { SITE_ASSET_KEYS } from '@/utils/siteAssetKeys';
import { buildWhatsAppLink, generalEnquiryMessage } from '@/utils/whatsapp';
import { trackEvent } from '@/utils/analytics';
import { useClickOutside } from '@/hooks/useClickOutside';
import { filterProducts } from '@/utils/productSearch';
import { useNavigation, NavItem } from '@/context/NavigationContext';
import { useStoreSettings } from '@/context/StoreSettingsContext';


export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);

  const { assets } = useSiteAssets();
  const { navItems, loading: navLoading } = useNavigation();
  const location = useLocation();
  const navigate = useNavigate();
  const { totalItems, openCart } = useCart();
  const { count: wishlistCount } = useWishlist();
  const { user } = useAuth();
  const { products } = useProducts();
  const { settings, triggerAssistance } = useStoreSettings();
  const searchRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useClickOutside<HTMLDivElement>(() => setSearchOpen(false));

  const topLevelNav = useMemo(() => {
    const filtered = navItems.filter(item => !item.parent_id).sort((a, b) => a.order - b.order);
    return filtered;
  }, [navItems]);

  const getChildren = (parentId: string) =>
    navItems.filter(item => item.parent_id === parentId).sort((a, b) => a.order - b.order);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setSearchQuery('');
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (searchOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [searchOpen]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    // Use the shared filter utility to maintain consistency with the Shop page
    return filterProducts(products || [], {
      query: q,
    }).slice(0, 6);
  }, [searchQuery, products]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      trackEvent('search', { query: searchQuery.trim() });
      navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 ${
          searchOpen
            ? 'bg-parchment-50 shadow-sm'
            : 'transition-all duration-500 ' + (scrolled
            ? 'glass-panel shadow-sm'
            : 'bg-parchment-50/40 backdrop-blur-sm')
        }`}
      >
        <nav className="container-lux flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0 flex items-center gap-3" aria-label="The Petal & Bloom home">
            <img
              src={getDynamicAsset(assets, SITE_ASSET_KEYS.LOGO)}
              alt="The Petal & Bloom Logo"
              className="w-10 h-10 rounded-full object-cover shadow-sm border border-canvas-line"
            />
            <span className="font-serif text-lg lg:text-xl font-medium tracking-wide text-bark leading-tight hidden sm:inline">
              THE PETAL<span className="text-rose"> &amp; </span>BLOOM
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-7">
            {topLevelNav.map((item) => (
              <div
                key={item.id}
                className="relative group"
                onMouseEnter={() => item.type === 'dropdown' && setOpenDropdown(item.id)}
                onMouseLeave={() => setOpenDropdown(null)}
              >
                <div className="flex items-center gap-1">
                  <Link
                    to={item.path || '#'}
                    className={`text-sm font-medium tracking-wide transition-colors duration-300 link-underline ${
                      isActive(item.path || '') ? 'text-rose-deep' : 'text-ink-light hover:text-rose'
                    }`}
                  >
                    {item.label}
                  </Link>
                  {item.type === 'dropdown' && <ChevronDown size={14} className="text-ink-light group-hover:text-rose transition-colors" />}
                </div>

                {/* Mega Menu Dropdown */}
                {item.type === 'dropdown' && openDropdown === item.id && (
                  <div className="absolute top-full left-0 w-64 glass-panel shadow-soft py-4 px-2 z-50 animate-fade-in rounded-sm">
                    <div className="flex flex-col gap-1">
                      {getChildren(item.id).map((child) => (
                        <Link
                          key={child.id}
                          to={child.path || '#'}
                          className={`px-4 py-2 text-sm transition-colors duration-200 rounded-sm ${
                            isActive(child.path || '')
                              ? 'bg-rose/10 text-rose-deep'
                              : 'text-ink-light hover:bg-canvas/50 hover:text-rose'
                          }`}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3 lg:gap-4">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="text-ink-light hover:text-rose transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2 focus-visible:ring-offset-linen rounded-sm"
              aria-label="Search products"
              aria-expanded={searchOpen}
            >
              <Search size={20} strokeWidth={1.5} />
            </button>
            <Link
              to="/wishlist"
              className="relative text-ink-light hover:text-rose transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2 focus-visible:ring-offset-linen rounded-sm"
              aria-label={`Wishlist with ${wishlistCount} items`}
            >
              <Heart size={20} strokeWidth={1.5} />
              {wishlistCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-bark text-linen text-[10px] font-medium w-4 h-4 rounded-full flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </Link>
            <Link
              to="/account"
              className="relative text-ink-light hover:text-rose transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2 focus-visible:ring-offset-linen rounded-sm"
              aria-label="Customer Account"
            >
              <User size={20} strokeWidth={1.5} />
              {user && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-linen" />
              )}
            </Link>
            <button
              onClick={openCart}
              className="relative text-ink-light hover:text-rose transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2 focus-visible:ring-offset-linen rounded-sm"
              aria-label={`Cart with ${totalItems} items`}
            >
              <ShoppingBag size={20} strokeWidth={1.5} />
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose text-linen text-[10px] font-medium w-4 h-4 rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => triggerAssistance(generalEnquiryMessage())}
              className="hidden sm:inline-flex px-5 py-2.5 text-xs font-medium rounded-atelier-btn bg-rose text-linen hover:bg-rose-deep transition-all duration-200 cursor-pointer"
            >
              <MessageCircle size={16} className="mr-2" />
              {settings.conciergeChannelMode === 'IN_SYSTEM' ? 'Studio Concierge' : 'Gift Concierge'}
            </button>
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden text-ink-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2 focus-visible:ring-offset-linen rounded-sm"
              aria-label="Open menu"
            >
              <Menu size={22} strokeWidth={1.5} />
            </button>
          </div>
        </nav>

        {/* Search bar with live results */}
        {searchOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-ink/30 animate-fade-in"
              onClick={() => setSearchOpen(false)}
            />
            <div
              ref={searchContainerRef}
              className="absolute top-full left-0 right-0 bg-parchment-50 border-t border-silk shadow-2xl animate-fade-in z-50"
            >
              <div className="container-lux py-6">
                <form onSubmit={handleSearchSubmit} className="relative">
                  <div className="relative flex items-center gap-3">
                    <input
                      ref={searchRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search for a bloom, an occasion, or a mood..."
                      className="w-full bg-transparent border-b border-silk pb-3 pr-12 text-ink placeholder-ink/40 focus:outline-none focus:border-rose font-serif text-xl transition-colors duration-300"
                    />
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="text-ink-light/50 hover:text-ink transition-colors"
                          aria-label="Clear search"
                        >
                          <XCircle size={20} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSearchOpen(false)}
                        className="text-ink-light hover:text-rose transition-colors"
                        aria-label="Close search"
                      >
                        <X size={20} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                </form>

                {/* Live results */}
                {searchResults.length > 0 && (
                  <div className="mt-4 space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-brown-400 mb-2">Products</p>
                    {searchResults.map((product) => (
                      <Link
                        key={product.code}
                        to={`/product/${product.code}`}
                        onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                        className="flex items-center gap-3 p-2 rounded-sm hover:bg-silk/50 transition-colors"
                      >
                        <div className="w-12 h-14 overflow-hidden rounded-sm bg-cream-200 flex-shrink-0">
                          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-serif text-base text-ink truncate">{product.name}</p>
                          <p className="text-xs text-brown-400 truncate">{product.description}</p>
                        </div>
                        <span className="text-sm font-medium text-rose flex-shrink-0">
                          {product.priceLabel || formatPrice(product.price)}
                        </span>
                      </Link>
                    ))}
                    <button
                      onClick={handleSearchSubmit}
                      className="text-sm text-rose hover:text-rose mt-2 link-underline"
                    >
                      See all results →
                    </button>
                  </div>
                )}

                {/* Empty state */}
                {searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                  <div className="mt-4 text-center py-6">
                    <p className="font-serif text-lg text-ink-light">Can't find what you're looking for?</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchOpen(false);
                        triggerAssistance(generalEnquiryMessage());
                      }}
                      className="text-sm text-rose hover:text-rose-deep mt-2 inline-block link-underline cursor-pointer"
                    >
                      {settings.conciergeChannelMode === 'IN_SYSTEM'
                        ? 'Talk to Studio Concierge →'
                        : 'Talk to us on WhatsApp →'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </header>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-bark/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-[80%] max-w-sm glass-panel shadow-2xl animate-slide-in flex flex-col">
            <div className="flex items-center justify-between px-5 h-16 border-b border-canvas-line">
              <span className="font-serif text-base font-medium text-bark">Menu</span>
              <button onClick={() => setMobileOpen(false)} className="text-ink-light hover:text-bark transition-colors" aria-label="Close menu">
                <X size={22} strokeWidth={1.5} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-4">
              {topLevelNav.map((item) => (
                <div key={item.id} className="flex flex-col">
                  <div
                    className={`flex items-center justify-between px-5 py-3.5 text-base font-medium transition-colors duration-200 cursor-pointer ${
                      isActive(item.path || '')
                        ? 'text-rose-deep bg-rose/10'
                        : 'text-ink-light hover:text-bark hover:bg-canvas/50'
                    }`}
                    onClick={() => {
                      if (item.type === 'dropdown') {
                        setMobileExpanded(mobileExpanded === item.id ? null : item.id);
                      } else {
                        navigate(item.path || '/');
                        setMobileOpen(false);
                      }
                    }}
                  >
                    <span>{item.label}</span>
                    {item.type === 'dropdown' && (
                      <ChevronDown
                        size={18}
                        className={`transition-transform duration-300 ${mobileExpanded === item.id ? 'rotate-180' : ''}`}
                      />
                    )}
                  </div>
                  {item.type === 'dropdown' && mobileExpanded === item.id && (
                    <div className="bg-canvas/30 py-2">
                      {getChildren(item.id).map((child) => (
                        <Link
                          key={child.id}
                          to={child.path || '#'}
                          className={`block px-10 py-3 text-sm font-medium transition-colors duration-200 ${
                            isActive(child.path || '')
                              ? 'text-rose-deep'
                              : 'text-ink-light hover:text-bark'
                          }`}
                          onClick={() => setMobileOpen(false)}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="border-t border-canvas-line mt-2 pt-2">
                <Link
                  to="/account"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between px-5 py-3.5 text-base font-medium text-bark hover:bg-canvas/50"
                >
                  <span>{user ? 'My Account & Rewards' : 'Sign In / Join Studio'}</span>
                  {user && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                </Link>
                <Link
                  to="/track"
                  onClick={() => setMobileOpen(false)}
                  className="block px-5 py-3 text-sm font-medium text-ink-light hover:text-bark hover:bg-canvas/50"
                >
                  Track Order
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    triggerAssistance(generalEnquiryMessage());
                  }}
                  className="w-full text-left px-5 py-3.5 text-base font-medium text-ink-light hover:text-bark hover:bg-canvas/50 cursor-pointer"
                >
                  Custom Enquiry
                </button>
              </div>
            </div>
            <div className="p-5 border-t border-canvas-line">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  triggerAssistance(generalEnquiryMessage());
                }}
                className="flex items-center justify-center gap-2 w-full py-3 text-sm font-medium rounded-atelier-btn bg-rose text-linen hover:bg-rose-deep transition-all duration-200 cursor-pointer"
              >
                <MessageCircle size={16} />
                {settings.conciergeChannelMode === 'IN_SYSTEM'
                  ? 'Chat with Studio Concierge'
                  : 'Chat with Gift Concierge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
