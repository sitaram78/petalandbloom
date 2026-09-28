import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { QuickViewProvider } from '@/context/QuickViewContext';
import { ProductProvider } from '@/context/ProductContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { NavigationProvider } from '@/context/NavigationContext';
import { SiteAssetsProvider } from '@/context/SiteAssetsContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CartDrawer from '@/components/CartDrawer';
import MobileBottomNav from '@/components/MobileBottomNav';
import ScrollToTop from '@/components/ScrollToTop';
import Home from '@/pages/Home';
import Shop from '@/pages/Shop';
import Wishlist from '@/pages/Wishlist';
import CustomOrders from '@/pages/CustomOrders';
import CustomBouquetBuilder from '@/pages/CustomBouquetBuilder';
import GiftFinder from '@/pages/GiftFinder';
import About from '@/pages/About';
import Contact from '@/pages/Contact';
import ProductDetail from '@/pages/ProductDetail';
import Account from '@/pages/Account';
import Privacy from '@/pages/Privacy';
import Terms from '@/pages/Terms';
import Refund from '@/pages/Refund';
import OrderConfirmation from '@/pages/OrderConfirmation';
import TrackOrder from '@/pages/TrackOrder';
import AdminLogin from '@/pages/AdminLogin';
import AdminRoute from '@/components/AdminRoute';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminEditor from '@/pages/AdminEditor';
import AdminAssets from '@/pages/admin/AdminAssets';
import AdminNavigation from '@/pages/admin/AdminNavigation';
import AdminSettings from '@/pages/admin/AdminSettings';
import AdminCoupons from '@/pages/admin/AdminCoupons';
import AdminOrders from '@/pages/admin/AdminOrders';
import AdminCustomers from '@/pages/admin/AdminCustomers';
import AdminMessages from '@/pages/admin/AdminMessages';
import AdminReviews from '@/pages/admin/AdminReviews';
import { StoreSettingsProvider } from '@/context/StoreSettingsContext';
import AtelierConciergeWidget from '@/components/AtelierConciergeWidget';
import NotFound from '@/pages/NotFound';

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
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/customers" element={<AdminCustomers />} />
            <Route path="/admin/messages" element={<AdminMessages />} />
            <Route path="/admin/reviews" element={<AdminReviews />} />
            <Route path="/admin/navigation" element={<AdminNavigation />} />
            <Route path="/admin/editor" element={<AdminEditor />} />
            <Route path="/admin/assets" element={<AdminAssets />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/coupons" element={<AdminCoupons />} />
          </Route>
        </Routes>
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
