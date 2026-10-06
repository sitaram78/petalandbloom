import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { QuickViewProvider } from '@/context/QuickViewContext';
import { ProductProvider } from '@/context/ProductContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { NavigationProvider } from '@/context/NavigationContext';
import { SiteAssetsProvider } from '@/context/SiteAssetsContext';
import { StoreSettingsProvider } from '@/context/StoreSettingsContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CartDrawer from '@/components/CartDrawer';
import MobileBottomNav from '@/components/MobileBottomNav';
import ScrollToTop from '@/components/ScrollToTop';
import AtelierConciergeWidget from '@/components/AtelierConciergeWidget';

// Core Eager Pages (immediate render without suspense lag)
import Home from '@/pages/Home';
import Shop from '@/pages/Shop';
import Wishlist from '@/pages/Wishlist';
import ProductDetail from '@/pages/ProductDetail';
import NotFound from '@/pages/NotFound';
import AdminRoute from '@/components/AdminRoute';

// Secondary Storefront Pages (Lazy Loaded)
const CustomOrders = lazy(() => import('@/pages/CustomOrders'));
const CustomBouquetBuilder = lazy(() => import('@/pages/CustomBouquetBuilder'));
const GiftFinder = lazy(() => import('@/pages/GiftFinder'));
const About = lazy(() => import('@/pages/About'));
const Contact = lazy(() => import('@/pages/Contact'));
const Account = lazy(() => import('@/pages/Account'));
const Privacy = lazy(() => import('@/pages/Privacy'));
const Terms = lazy(() => import('@/pages/Terms'));
const Refund = lazy(() => import('@/pages/Refund'));
const OrderConfirmation = lazy(() => import('@/pages/OrderConfirmation'));
const TrackOrder = lazy(() => import('@/pages/TrackOrder'));

// Admin Backoffice Pages (Lazy Loaded - isolated from storefront bundle)
const AdminLogin = lazy(() => import('@/pages/AdminLogin'));
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'));
const AdminEditor = lazy(() => import('@/pages/AdminEditor'));
const AdminAssets = lazy(() => import('@/pages/admin/AdminAssets'));
const AdminNavigation = lazy(() => import('@/pages/admin/AdminNavigation'));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'));
const AdminCoupons = lazy(() => import('@/pages/admin/AdminCoupons'));
const AdminOrders = lazy(() => import('@/pages/admin/AdminOrders'));
const AdminCustomers = lazy(() => import('@/pages/admin/AdminCustomers'));
const AdminMessages = lazy(() => import('@/pages/admin/AdminMessages'));
const AdminReviews = lazy(() => import('@/pages/admin/AdminReviews'));
const AdminAuditLogs = lazy(() => import('@/pages/admin/AdminAuditLogs'));
const AdminInfluencers = lazy(() => import('@/pages/admin/AdminInfluencers'));
const AdminAbandonedCarts = lazy(() => import('@/pages/admin/AdminAbandonedCarts'));
const AdminReports = lazy(() => import('@/pages/admin/AdminReports'));
const AdminOccasions = lazy(() => import('@/pages/admin/AdminOccasions'));

function PageFallback() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-bark/20 border-t-bark animate-spin mb-3" />
      <p className="text-xs uppercase tracking-widest text-ink-light font-medium font-sans">
        Loading Atelier...
      </p>
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  const pathname = location.pathname;
  const isAdminRoute = pathname.startsWith('/admin');

  return (
    <>
      {/* Navbar only on storefront routes */}
      {!isAdminRoute && <Navbar />}

      <CartDrawer />

      <main className={`min-h-screen ${!isAdminRoute ? 'pb-16 sm:pb-0' : ''}`}>
        <Suspense fallback={<PageFallback />}>
          <Routes>
          {/* Storefront Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/custom" element={<CustomOrders />} />
          <Route path="/custom-bouquet" element={<CustomBouquetBuilder />} />
          <Route path="/gift-finder" element={<GiftFinder />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/product/:code" element={<ProductDetail />} />
          <Route path="/account" element={<Account />} />
          <Route path="/order-confirmation" element={<OrderConfirmation />} />
          <Route path="/track" element={<TrackOrder />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/refund" element={<Refund />} />
          <Route path="*" element={<NotFound />} />

          {/* Admin Portal */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route element={<AdminRoute />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/customers" element={<AdminCustomers />} />
            <Route path="/admin/messages" element={<AdminMessages />} />
            <Route path="/admin/reviews" element={<AdminReviews />} />
            <Route path="/admin/navigation" element={<AdminNavigation />} />
            <Route path="/admin/editor" element={<AdminEditor />} />
            <Route path="/admin/assets" element={<AdminAssets />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/coupons" element={<AdminCoupons />} />
            <Route path="/admin/influencers" element={<AdminInfluencers />} />
            <Route path="/admin/abandoned-carts" element={<AdminAbandonedCarts />} />
            <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
            <Route path="/admin/occasions" element={<AdminOccasions />} />
          </Route>
        </Routes>
        </Suspense>
      </main>

      {/* Bottom Navigation, Footer, and In-System / WhatsApp Concierge Widget on storefront routes */}
      {!isAdminRoute && (
        <>
          <AtelierConciergeWidget />
          <MobileBottomNav />
          <Footer />
        </>
      )}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <AuthProvider>
          <StoreSettingsProvider>
            <WishlistProvider>
              <ProductProvider>
                <CartProvider>
                  <QuickViewProvider>
                    <SiteAssetsProvider>
                      <NavigationProvider>
                        <ScrollToTop />
                        <AppContent />
                      </NavigationProvider>
                    </SiteAssetsProvider>
                  </QuickViewProvider>
                </CartProvider>
              </ProductProvider>
            </WishlistProvider>
          </StoreSettingsProvider>
        </AuthProvider>
      </NotificationProvider>
    </BrowserRouter>
  );
}

export default App;
