import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  User,
  ShoppingBag,
  Sparkles,
  Gift,
  MapPin,
  LogOut,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  Plus,
  Trash2,
  Package,
  Award,
  Share2,
  Clock,
  ArrowRight,
  Loader2,
  Lock,
  Mail,
  Phone,
  MessageCircle,
  CheckCircle2,
  Truck,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useNotification } from '@/context/NotificationContext';
import { supabase } from '@/lib/supabaseClient';
import { formatPrice } from '@/data/products';
import { buildWhatsAppLink } from '@/utils/whatsapp';
import Reveal from '@/components/Reveal';
import SEO from '@/components/SEO';

interface CustomerOrder {
  id: string;
  order_number: string;
  order_status: string;
  payment_status: string;
  total_in_paise: number;
  subtotal_in_paise: number;
  shipping_fee_in_paise?: number;
  discount_in_paise?: number;
  loyalty_discount_in_paise?: number;
  loyalty_points_redeemed?: number;
  applied_coupon_code?: string;
  customer_note?: string;
  created_at: string;
  order_items?: Array<{
    id: string;
    product_name: string;
    product_code: string;
    quantity: number;
    unit_price_in_paise: number;
    total_price_in_paise?: number;
    selected_color?: string;
    gift_wrap?: boolean;
    personal_message?: string;
    item_image?: string;
  }>;
}

interface SavedAddress {
  id: string;
  recipient_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
}

interface LoyaltyLedgerEntry {
  id: string;
  type: string;
  points: number;
  description: string;
  created_at: string;
}

type TabType = 'orders' | 'loyalty' | 'referrals' | 'addresses' | 'profile';

export default function Account() {
  const { user, profile, loyalty, loading: authLoading, signInWithEmail, signUpWithEmail, signOut, updateProfile, refreshProfile } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const { openCart } = useCart();
  const returnToCheckout = Boolean((location.state as any)?.returnToCheckout);

  // Navigation tab
  const [activeTab, setActiveTab] = useState<TabType>('orders');

  // Auth Form State (when not signed in)
  const [isRegisterMode, setIsRegisterMode] = useState(returnToCheckout);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');

  // Dashboard Data State
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyLedgerEntry[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  // New Address Form State
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [newRecipient, setNewRecipient] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newLine1, setNewLine1] = useState('');
  const [newLine2, setNewLine2] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [newPincode, setNewPincode] = useState('');
  const [isDefaultAddress, setIsDefaultAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  // Profile Edit State
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Sync profile data to edit inputs
  useEffect(() => {
    if (profile) {
      setEditName(profile.full_name || '');
      setEditPhone(profile.phone || '');
    }
  }, [profile]);

  // Load customer orders
  const loadOrders = async () => {
    if (!user) return;
    setOrdersLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          order_status,
          payment_status,
          total_in_paise,
          subtotal_in_paise,
          shipping_fee_in_paise,
          discount_in_paise,
          loyalty_discount_in_paise,
          loyalty_points_redeemed,
          applied_coupon_code,
          customer_note,
          created_at,
          order_items (
            id,
            product_name,
            product_code,
            quantity,
            unit_price_in_paise,
            total_price_in_paise,
            selected_color,
            gift_wrap,
            personal_message,
            item_image
          )
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load orders:', error);
      } else if (data) {
        setOrders(data as CustomerOrder[]);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  // Load saved addresses
  const loadAddresses = async () => {
    if (!user) return;
    setAddressesLoading(true);
    try {
      const { data, error } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('customer_id', user.id)
        .order('is_default', { ascending: false });

      if (!error && data) {
        setAddresses(data as SavedAddress[]);
      }
    } catch (err) {
      console.error('Failed to load addresses:', err);
    } finally {
      setAddressesLoading(false);
    }
  };

  // Load loyalty transactions
  const loadLoyaltyTransactions = async () => {
    if (!user) return;
    setTransactionsLoading(true);
    try {
      const { data, error } = await supabase
        .from('loyalty_transactions')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setLoyaltyTransactions(data as LoyaltyLedgerEntry[]);
      }
    } catch (err) {
      console.error('Failed to load loyalty ledger:', err);
    } finally {
      setTransactionsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      refreshProfile();
      loadOrders();
      loadAddresses();
      loadLoyaltyTransactions();
    }
  }, [user]);

  // Handle Authentication
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);

    try {
      if (isRegisterMode) {
        if (!authFullName.trim()) throw new Error('Please enter your full name.');
        if (!authPhone.trim() || authPhone.trim().length < 10) throw new Error('Please enter a valid 10-digit mobile number.');
        if (authPassword.length < 6) throw new Error('Password must be at least 6 characters.');

        const { error } = await signUpWithEmail(authEmail, authPassword, authFullName, authPhone);
        if (error) throw error;

        showNotification('Welcome! 50 Petal Points (₹50 discount) have been credited to your account.', 'success');

        if (returnToCheckout) {
          setTimeout(() => {
            navigate(-1);
            setTimeout(() => openCart(), 200);
          }, 400);
          return;
        }
      } else {
        const { data: authData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: authEmail.trim().toLowerCase(),
          password: authPassword,
        });

        if (signInErr) throw signInErr;

        if (authData.user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', authData.user.id)
            .maybeSingle();

          if (profileData && (profileData.role === 'admin' || profileData.role === 'super_admin')) {
            await supabase.auth.signOut();
            throw new Error('This account has Administrator privileges. Studio administrators must log in via the Studio Admin Portal (/admin/login).');
          }
        }

        showNotification('Welcome back to the Atelier.', 'success');

        if (returnToCheckout) {
          setTimeout(() => {
            navigate(-1);
            setTimeout(() => openCart(), 200);
          }, 400);
          return;
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Handle Add Address
  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingAddress(true);

    try {
      if (!newRecipient || !newPhone || !newLine1 || !newCity || !newState || !newPincode) {
        throw new Error('Please fill in all required address fields.');
      }

      // If set as default, reset other defaults first
      if (isDefaultAddress) {
        await supabase
          .from('customer_addresses')
          .update({ is_default: false })
          .eq('customer_id', user.id);
      }

      const { error } = await supabase.from('customer_addresses').insert({
        customer_id: user.id,
        recipient_name: newRecipient,
        phone: newPhone,
        address_line1: newLine1,
        address_line2: newLine2 || null,
        city: newCity,
        state: newState,
        pincode: newPincode,
        is_default: isDefaultAddress || addresses.length === 0,
      });

      if (error) throw error;

      showNotification('Address saved successfully.', 'success');
      setShowAddressModal(false);
      setNewRecipient('');
      setNewPhone('');
      setNewLine1('');
      setNewLine2('');
      setNewCity('');
      setNewState('');
      setNewPincode('');
      setIsDefaultAddress(false);
      loadAddresses();
    } catch (err: any) {
      showNotification(err.message || 'Failed to save address.', 'error');
    } finally {
      setSavingAddress(false);
    }
  };

  // Handle Delete Address
  const handleDeleteAddress = async (addressId: string) => {
    if (!window.confirm('Are you sure you want to remove this address?')) return;
    try {
      const { error } = await supabase
        .from('customer_addresses')
        .delete()
        .eq('id', addressId);

      if (error) throw error;
      showNotification('Address removed.', 'info');
      loadAddresses();
    } catch (err: any) {
      showNotification(err.message || 'Failed to remove address.', 'error');
    }
  };

  // Handle Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { error } = await updateProfile({
        full_name: editName,
        phone: editPhone,
      });
      if (error) throw error;
      showNotification('Profile updated successfully.', 'success');
    } catch (err: any) {
      showNotification(err.message || 'Failed to update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const copyReferralCode = () => {
    if (!profile?.referral_code) return;
    navigator.clipboard.writeText(profile.referral_code);
    setCopiedCode(true);
    showNotification('Referral code copied to clipboard!', 'success');
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const referralShareUrl = profile?.referral_code
    ? `${window.location.origin}/shop?ref=${profile.referral_code}`
    : window.location.origin;

  const referralWhatsAppText = `Hey! I love these handcrafted, everlasting crochet florals from The Petal & Bloom Atelier. Use my code ${profile?.referral_code || ''} for an exclusive gift: ${referralShareUrl}`;

  // Helper for Order Status Badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAYMENT_CONFIRMED':
      case 'ORDER_CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Order Confirmed
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            In Studio Crafting
          </span>
        );
      case 'PACKED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-800 border border-indigo-200">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            Packed & Inspected
          </span>
        );
      case 'SHIPPED':
      case 'OUT_FOR_DELIVERY':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-800 border border-sky-200">
            <Truck size={12} className="text-sky-600" />
            En Route / Shipped
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-900 border border-emerald-300">
            <CheckCircle2 size={12} className="text-emerald-700" />
            Delivered
          </span>
        );
      case 'PENDING_PAYMENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-700 border border-stone-300">
            <Clock size={12} className="text-stone-500" />
            Awaiting Payment
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  const getOrderStep = (status: string) => {
    switch (status) {
      case 'PENDING_PAYMENT':
        return 0;
      case 'PAYMENT_CONFIRMED':
      case 'ORDER_CONFIRMED':
        return 1;
      case 'PROCESSING':
        return 2;
      case 'PACKED':
      case 'SHIPPED':
      case 'OUT_FOR_DELIVERY':
        return 3;
      case 'DELIVERED':
        return 4;
      default:
        return 1;
    }
  };

  // Helper for Loyalty Tier
  const tierName = loyalty?.tier || 'FLORET';
  const tierColor =
    tierName === 'HEIRLOOM'
      ? 'from-amber-600 to-amber-700 text-amber-900 border-amber-300'
      : tierName === 'BLOSSOM'
      ? 'from-rose-500 to-rose-600 text-rose-900 border-rose-300'
      : 'from-bark/80 to-bark text-linen border-bark/20';

  if (authLoading) {
    return (
      <div className="min-h-screen bg-parchment-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-rose" />
      </div>
    );
  }

  return (
    <>
      <SEO
        title={user ? 'My Atelier Account' : 'Customer Sign In'}
        description="Manage your handcrafted floral orders, loyalty points, saved delivery addresses and atelier rewards at The Petal & Bloom."
      />

      <div className="min-h-screen bg-parchment-50/50 pt-28 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* ========================================================================= */}
          {/* 1. UNAUTHENTICATED STATE: LOGIN / REGISTER CARD                           */}
          {/* ========================================================================= */}
          {!user ? (
            <Reveal>
              <div className="max-w-md mx-auto bg-linen rounded-sm border border-canvas-line shadow-soft p-8 sm:p-10">
                <div className="text-center mb-8">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-rose font-medium mb-2">
                    Atelier Membership
                  </p>
                  <h1 className="heading-serif text-3xl sm:text-4xl text-bark mb-3">
                    {isRegisterMode ? 'Join the Studio' : 'Welcome Back'}
                  </h1>
                  <p className="text-xs sm:text-sm text-ink-light font-light leading-relaxed">
                    {isRegisterMode
                      ? 'Create an account to track handcrafted bouquets, earn loyalty points, and access private collections.'
                      : 'Sign in to access your order history, saved addresses, and loyalty rewards.'}
                  </p>
                </div>

                {returnToCheckout && (
                  <div className="mb-6 p-3.5 bg-rose/10 border border-rose/25 rounded-atelier-card flex items-start gap-2.5 text-xs text-bark font-light">
                    <Sparkles size={16} className="text-rose shrink-0 mt-0.5" />
                    <span>
                      You're claiming <strong>₹50 off</strong> for your pending cart! Sign in or register below, and we'll bring you right back to your bag with your 50 points ready to redeem.
                    </span>
                  </div>
                )}

                {/* Tab Switcher */}
                <div className="flex border-b border-canvas-line mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisterMode(false);
                      setAuthError('');
                    }}
                    className={`flex-1 pb-3 text-xs uppercase tracking-wider font-medium border-b-2 transition-all duration-200 ${
                      !isRegisterMode
                        ? 'border-bark text-bark font-semibold'
                        : 'border-transparent text-ink-light hover:text-ink'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisterMode(true);
                      setAuthError('');
                    }}
                    className={`flex-1 pb-3 text-xs uppercase tracking-wider font-medium border-b-2 transition-all duration-200 ${
                      isRegisterMode
                        ? 'border-bark text-bark font-semibold'
                        : 'border-transparent text-ink-light hover:text-ink'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {isRegisterMode && (
                  <div className="mb-6 p-3.5 bg-rose/5 border border-rose/20 rounded-sm flex items-start gap-3">
                    <Sparkles size={18} className="text-rose shrink-0 mt-0.5" />
                    <p className="text-xs text-rose-deep leading-relaxed">
                      <strong>50 Welcome Points</strong> (₹50 value) and an exclusive referral code are immediately credited to your account upon signing up!
                    </p>
                  </div>
                )}

                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  {isRegisterMode && (
                    <>
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                          Full Name *
                        </label>
                        <div className="relative">
                          <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-light" />
                          <input
                            type="text"
                            required
                            value={authFullName}
                            onChange={(e) => setAuthFullName(e.target.value)}
                            placeholder="Ananya Sharma"
                            className="w-full pl-10 pr-4 py-2.5 bg-canvas/40 border border-canvas-line rounded-sm text-sm text-ink focus:outline-none focus:border-bark focus:bg-linen"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                          Mobile Number *
                        </label>
                        <div className="relative">
                          <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-light" />
                          <input
                            type="tel"
                            required
                            maxLength={10}
                            value={authPhone}
                            onChange={(e) => setAuthPhone(e.target.value.replace(/\D/g, ''))}
                            placeholder="9876543210"
                            className="w-full pl-10 pr-4 py-2.5 bg-canvas/40 border border-canvas-line rounded-sm text-sm text-ink focus:outline-none focus:border-bark focus:bg-linen"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-light" />
                      <input
                        type="email"
                        required
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-10 pr-4 py-2.5 bg-canvas/40 border border-canvas-line rounded-sm text-sm text-ink focus:outline-none focus:border-bark focus:bg-linen"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                      Password *
                    </label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-light" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-2.5 bg-canvas/40 border border-canvas-line rounded-sm text-sm text-ink focus:outline-none focus:border-bark focus:bg-linen"
                      />
                    </div>
                  </div>

                  {authError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-sm">
                      {authError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authSubmitting}
                    className="w-full mt-2 py-3 rounded-atelier-btn bg-bark text-linen hover:bg-rose-deep text-xs uppercase tracking-widest font-medium transition-all duration-300 flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {authSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        {isRegisterMode ? 'Creating Account...' : 'Authenticating...'}
                      </>
                    ) : isRegisterMode ? (
                      'Create Account'
                    ) : (
                      'Sign In'
                    )}
                  </button>
                </form>

                <div className="mt-8 pt-6 border-t border-canvas-line text-center">
                  <p className="text-xs text-ink-light">
                    Have an existing order number?{' '}
                    <Link to="/track" className="text-rose font-medium hover:underline">
                      Track guest order here
                    </Link>
                  </p>
                </div>
              </div>
            </Reveal>
          ) : (
            /* ========================================================================= */
            /* 2. AUTHENTICATED STATE: CUSTOMER ATELIER DASHBOARD                       */
            /* ========================================================================= */
            <div className="space-y-8">
              {/* Studio Admin Alert Banner (if logged in with administrator privileges) */}
              {profile && (profile.role === 'admin' || profile.role === 'super_admin') && (
                <div className="p-4 sm:p-5 bg-bark text-linen rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md border-l-4 border-amber-400">
                  <div className="flex items-center gap-3">
                    <ShieldAlert size={24} className="text-amber-400 shrink-0" />
                    <div>
                      <h4 className="font-serif text-base sm:text-lg font-medium text-linen">
                        Administrator Session Active
                      </h4>
                      <p className="text-xs text-parchment-200">
                        You are currently signed in as a Studio Administrator ({user.email}). Atelier orders and catalog settings are managed via the Admin Portal.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to="/admin/dashboard"
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-bark font-medium text-xs uppercase tracking-wider rounded-sm transition-colors"
                    >
                      Admin Portal →
                    </Link>
                    <button
                      onClick={signOut}
                      className="px-3 py-2 border border-parchment-400 text-linen hover:bg-white/10 text-xs uppercase tracking-wider rounded-sm transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}

              {/* Atelier Member Hero Card */}
              <div className="bg-linen rounded-sm border border-canvas-line p-6 sm:p-8 shadow-soft">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <span className="px-3 py-1 rounded-full text-[11px] font-medium uppercase tracking-wider bg-rose/10 text-rose-deep border border-rose/20 flex items-center gap-1.5">
                        <Sparkles size={12} className="text-rose" />
                        {tierName} Atelier Circle
                      </span>
                      {profile?.role === 'admin' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-bark text-linen">
                          Staff
                        </span>
                      )}
                    </div>
                    <h1 className="heading-serif text-3xl sm:text-4xl text-bark">
                      Welcome to the Atelier, {profile?.full_name || user.email?.split('@')[0]}
                    </h1>
                    <p className="text-xs sm:text-sm text-ink-light flex flex-wrap items-center gap-3">
                      <span>{user.email}</span>
                      {profile?.phone && <span>• +91 {profile.phone}</span>}
                      <span>• Member Since {new Date(profile?.created_at || user.created_at || Date.now()).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
                    </p>
                  </div>

                  {/* Loyalty & Quick Stat Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 self-stretch lg:self-auto">
                    {/* Stat 1: Points Balance */}
                    <div className="bg-parchment-50/80 p-3.5 rounded-sm border border-canvas-line">
                      <div className="flex items-center gap-2 text-rose mb-1">
                        <Award size={16} />
                        <span className="text-[10px] uppercase tracking-wider text-ink-light font-medium">Petals</span>
                      </div>
                      <p className="text-xl font-serif text-bark font-semibold">
                        {loyalty?.points_balance || 0}
                      </p>
                      <p className="text-[10px] text-rose font-medium mt-0.5">
                        ₹{loyalty?.points_balance || 0} Store Credit
                      </p>
                    </div>

                    {/* Stat 2: Orders Count */}
                    <div className="bg-parchment-50/80 p-3.5 rounded-sm border border-canvas-line">
                      <div className="flex items-center gap-2 text-bark mb-1">
                        <ShoppingBag size={16} />
                        <span className="text-[10px] uppercase tracking-wider text-ink-light font-medium">Orders</span>
                      </div>
                      <p className="text-xl font-serif text-bark font-semibold">
                        {orders.length}
                      </p>
                      <p className="text-[10px] text-ink-light mt-0.5">
                        Bouquets Crafted
                      </p>
                    </div>

                    {/* Stat 3: Referral Code */}
                    <div
                      onClick={copyReferralCode}
                      className="col-span-2 sm:col-span-1 bg-parchment-50/80 p-3.5 rounded-sm border border-canvas-line cursor-pointer hover:border-bark transition-colors group"
                      title="Click to copy your code"
                    >
                      <div className="flex items-center justify-between text-bark mb-1">
                        <span className="text-[10px] uppercase tracking-wider text-ink-light font-medium">Invite Code</span>
                        {copiedCode ? <Check size={14} className="text-emerald-600" /> : <Copy size={13} className="text-ink-light group-hover:text-bark" />}
                      </div>
                      <p className="text-sm font-mono font-bold text-bark tracking-wide truncate">
                        {profile?.referral_code || 'PB-MEMBER'}
                      </p>
                      <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
                        {copiedCode ? 'Copied!' : 'Give 10%, Earn ₹100'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Dashboard Tabs */}
                <div className="flex overflow-x-auto gap-2 border-b border-canvas-line mt-8 -mb-2 pb-2 scrollbar-none">
                  <button
                    onClick={() => setActiveTab('orders')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs uppercase tracking-wider font-medium rounded-sm transition-all whitespace-nowrap ${
                      activeTab === 'orders'
                        ? 'bg-bark text-linen shadow-sm'
                        : 'text-ink-light hover:text-bark hover:bg-canvas/50'
                    }`}
                  >
                    <ShoppingBag size={15} />
                    My Orders ({orders.length})
                  </button>

                  <button
                    onClick={() => setActiveTab('loyalty')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs uppercase tracking-wider font-medium rounded-sm transition-all whitespace-nowrap ${
                      activeTab === 'loyalty'
                        ? 'bg-bark text-linen shadow-sm'
                        : 'text-ink-light hover:text-bark hover:bg-canvas/50'
                    }`}
                  >
                    <Award size={15} />
                    Atelier Circle & Points
                  </button>

                  <button
                    onClick={() => setActiveTab('referrals')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs uppercase tracking-wider font-medium rounded-sm transition-all whitespace-nowrap ${
                      activeTab === 'referrals'
                        ? 'bg-bark text-linen shadow-sm'
                        : 'text-ink-light hover:text-bark hover:bg-canvas/50'
                    }`}
                  >
                    <Gift size={15} />
                    Refer & Earn
                  </button>

                  <button
                    onClick={() => setActiveTab('addresses')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs uppercase tracking-wider font-medium rounded-sm transition-all whitespace-nowrap ${
                      activeTab === 'addresses'
                        ? 'bg-bark text-linen shadow-sm'
                        : 'text-ink-light hover:text-bark hover:bg-canvas/50'
                    }`}
                  >
                    <MapPin size={15} />
                    Saved Addresses ({addresses.length})
                  </button>

                  <button
                    onClick={() => setActiveTab('profile')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs uppercase tracking-wider font-medium rounded-sm transition-all whitespace-nowrap ${
                      activeTab === 'profile'
                        ? 'bg-bark text-linen shadow-sm'
                        : 'text-ink-light hover:text-bark hover:bg-canvas/50'
                    }`}
                  >
                    <User size={15} />
                    Profile Details
                  </button>

                  <button
                    onClick={signOut}
                    className="flex items-center gap-2 px-4 py-2.5 text-xs uppercase tracking-wider font-medium rounded-sm text-red-600 hover:bg-red-50 transition-all ml-auto whitespace-nowrap"
                  >
                    <LogOut size={15} />
                    Sign Out
                  </button>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* TAB 1: MY ORDERS                                                         */}
              {/* ========================================================================= */}
              {activeTab === 'orders' && (
                <div className="space-y-5">
                  {ordersLoading ? (
                    <div className="bg-linen p-12 text-center rounded-sm border border-canvas-line">
                      <Loader2 size={24} className="animate-spin text-rose mx-auto mb-2" />
                      <p className="text-xs text-ink-light">Fetching your orders from the atelier...</p>
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="bg-linen p-12 text-center rounded-sm border border-canvas-line shadow-soft">
                      <div className="w-16 h-16 rounded-full bg-rose/10 text-rose flex items-center justify-center mx-auto mb-4">
                        <Package size={28} />
                      </div>
                      <h3 className="heading-serif text-2xl text-bark mb-2">No Atelier Orders Yet</h3>
                      <p className="text-xs sm:text-sm text-ink-light max-w-md mx-auto mb-6">
                        Each Petal & Bloom arrangement is patiently crocheted with archival combed cotton yarns to remain vibrant forever. Your future heirloom bouquets will appear here.
                      </p>
                      <Link
                        to="/shop"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-atelier-btn bg-bark text-linen hover:bg-rose-deep text-xs uppercase tracking-wider font-medium transition-all"
                      >
                        Explore Floral Collection
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  ) : (
                    orders.map((order) => (
                      <div
                        key={order.id}
                        className="bg-linen rounded-sm border border-canvas-line shadow-soft p-5 sm:p-6 transition-all hover:border-canvas-line-hover"
                      >
                        {/* Order Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-canvas-line">
                          <div>
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="font-serif font-medium text-bark text-lg tracking-wide">
                                {order.order_number}
                              </span>
                              {getStatusBadge(order.order_status)}
                            </div>
                            <p className="text-xs text-ink-light mt-1 flex items-center gap-1.5">
                              <Clock size={12} />
                              Placed on{' '}
                              {new Date(order.created_at).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-auto">
                            <span className="font-serif text-lg font-semibold text-bark">
                              {formatPrice(order.total_in_paise / 100)}
                            </span>
                            <Link
                              to={`/order-confirmation?order_id=${encodeURIComponent(order.order_number)}`}
                              className="px-3.5 py-1.5 rounded-sm border border-canvas-line text-xs font-medium text-bark hover:border-bark hover:bg-canvas/30 transition-all flex items-center gap-1.5"
                            >
                              Receipt
                              <ExternalLink size={12} />
                            </Link>
                            <Link
                              to={`/track?order_number=${encodeURIComponent(order.order_number)}`}
                              className="px-3.5 py-1.5 rounded-sm bg-rose text-linen text-xs font-medium hover:bg-rose-deep transition-all flex items-center gap-1.5"
                            >
                              Track
                              <ChevronRight size={14} />
                            </Link>
                          </div>
                        </div>

                        {/* Crafting & Delivery 4-Step Timeline */}
                        {order.order_status !== 'CANCELLED' && (
                          <div className="py-5 my-2 border-b border-canvas-line/60">
                            <div className="relative flex items-center justify-between max-w-xl mx-auto px-4">
                              {/* Background Line */}
                              <div className="absolute top-1/2 left-8 right-8 -translate-y-1/2 h-0.5 bg-canvas-line z-0" />
                              {/* Active Colored Line */}
                              <div
                                className="absolute top-1/2 left-8 -translate-y-1/2 h-0.5 bg-emerald-600 transition-all duration-500 z-0"
                                style={{
                                  width: `${
                                    getOrderStep(order.order_status) === 1
                                      ? '0%'
                                      : getOrderStep(order.order_status) === 2
                                      ? '33%'
                                      : getOrderStep(order.order_status) === 3
                                      ? '66%'
                                      : getOrderStep(order.order_status) === 4
                                      ? '100%'
                                      : '0%'
                                  }`,
                                }}
                              />

                              {[
                                { step: 1, label: 'Confirmed' },
                                { step: 2, label: 'Handcrafting' },
                                { step: 3, label: 'Dispatched' },
                                { step: 4, label: 'Delivered' },
                              ].map((s) => {
                                const currentStep = getOrderStep(order.order_status);
                                const isCompleted = currentStep >= s.step;
                                const isCurrent = currentStep === s.step;

                                return (
                                  <div key={s.step} className="relative z-10 flex flex-col items-center">
                                    <div
                                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                        isCompleted
                                          ? 'bg-emerald-600 text-linen ring-4 ring-linen'
                                          : 'bg-linen border-2 border-canvas-line text-ink-light'
                                      } ${isCurrent ? 'ring-2 ring-emerald-400 ring-offset-1' : ''}`}
                                    >
                                      {isCompleted ? <Check size={12} strokeWidth={3} /> : s.step}
                                    </div>
                                    <span
                                      className={`text-[10px] uppercase tracking-wider mt-1.5 font-medium whitespace-nowrap ${
                                        isCurrent
                                          ? 'text-bark font-semibold'
                                          : isCompleted
                                          ? 'text-emerald-800'
                                          : 'text-ink-light/70'
                                      }`}
                                    >
                                      {s.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Order Items Snapshot with Details */}
                        <div className="mt-4 divide-y divide-canvas-line/50">
                          {order.order_items?.map((item) => (
                            <div
                              key={item.id}
                              className="py-3 flex items-center justify-between gap-4 text-xs"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-12 h-14 rounded-sm bg-canvas/60 border border-canvas-line overflow-hidden shrink-0 flex items-center justify-center">
                                  {item.item_image ? (
                                    <img
                                      src={item.item_image}
                                      alt={item.product_name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Package size={18} className="text-ink-light/40" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="font-serif font-medium text-bark text-sm truncate">
                                    {item.product_name}
                                  </h4>
                                  <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <span className="text-ink-light font-medium">Qty: {item.quantity}</span>
                                    {item.selected_color && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose/10 text-rose-deep border border-rose/20">
                                        Shade: {item.selected_color}
                                      </span>
                                    )}
                                    {item.gift_wrap && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-50 text-amber-800 border border-amber-200">
                                        🎁 Gift Wrapped
                                      </span>
                                    )}
                                  </div>
                                  {item.personal_message && (
                                    <p className="text-[11px] text-ink-light italic mt-1 line-clamp-1">
                                      “{item.personal_message}”
                                    </p>
                                  )}
                                </div>
                              </div>

                              <span className="text-sm font-medium text-bark shrink-0 font-serif">
                                {formatPrice(((item.unit_price_in_paise || 0) * item.quantity) / 100)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Order Financial Breakdown & Studio Concierge */}
                        <div className="mt-4 pt-3.5 border-t border-canvas-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-parchment-50/50 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-4 rounded-b-sm">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-light">
                            <span>Subtotal: {formatPrice((order.subtotal_in_paise || order.total_in_paise) / 100)}</span>
                            {order.loyalty_points_redeemed && order.loyalty_points_redeemed > 0 ? (
                              <span className="text-rose font-medium">
                                Petals: -{formatPrice((order.loyalty_discount_in_paise || order.loyalty_points_redeemed * 100) / 100)} ({order.loyalty_points_redeemed} pts)
                              </span>
                            ) : null}
                            {order.discount_in_paise && order.discount_in_paise > 0 ? (
                              <span className="text-emerald-700 font-medium">
                                Coupon: -{formatPrice(order.discount_in_paise / 100)}
                              </span>
                            ) : null}
                            <span>
                              Shipping:{' '}
                              {order.shipping_fee_in_paise && order.shipping_fee_in_paise > 0
                                ? formatPrice(order.shipping_fee_in_paise / 100)
                                : 'Complimentary'}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 self-end sm:self-auto">
                            <a
                              href={`https://wa.me/919931653303?text=${encodeURIComponent(
                                `Hello The Petal & Bloom Atelier, I would like an update / have a question regarding my order #${order.order_number}.`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-rose hover:text-rose-deep font-medium flex items-center gap-1.5 transition-colors"
                            >
                              <MessageCircle size={13} />
                              Studio Concierge
                            </a>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ========================================================================= */}
              {/* TAB 2: LOYALTY & REWARDS                                                 */}
              {/* ========================================================================= */}
              {activeTab === 'loyalty' && (
                <div className="space-y-6">
                  {/* Tier Overview Card */}
                  <div className="bg-linen rounded-sm border border-canvas-line p-6 sm:p-8 shadow-soft">
                    <h3 className="heading-serif text-2xl text-bark mb-2">Atelier Loyalty Program</h3>
                    <p className="text-xs sm:text-sm text-ink-light max-w-2xl mb-6">
                      Every bouquet crafted at The Petal & Bloom earns rewards. 1 Petal Point = ₹1 discount directly applicable at checkout towards any future floral arrangement.
                    </p>

                    {/* Progress to Next Tier */}
                    <div className="bg-canvas/30 p-5 rounded-sm border border-canvas-line mb-8">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-medium text-bark">
                          Tier Status: <strong className="text-rose font-semibold">{tierName} Member</strong> ({loyalty?.points_balance || 0} Petals Available)
                        </span>
                        <span className="text-xs text-ink-light">
                          {tierName === 'HEIRLOOM'
                            ? 'Top Patron Tier (Archival Privileges Active)'
                            : `${loyalty?.points_balance || 0} / ${tierName === 'FLORET' ? 500 : 1500} Petals to ${tierName === 'FLORET' ? 'Blossom' : 'Heirloom'}`}
                        </span>
                      </div>
                      <div className="w-full bg-canvas h-2.5 rounded-full overflow-hidden border border-canvas-line">
                        <div
                          className="h-full bg-gradient-to-r from-rose to-rose-deep rounded-full transition-all duration-700"
                          style={{
                            width: `${
                              tierName === 'HEIRLOOM'
                                ? 100
                                : Math.min(100, Math.round(((loyalty?.points_balance || 0) / (tierName === 'FLORET' ? 500 : 1500)) * 100))
                            }%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-ink-light mt-1.5 font-mono">
                        <span>0 Pts (Floret)</span>
                        <span>500 Pts (Blossom)</span>
                        <span>1,500+ Pts (Heirloom)</span>
                      </div>
                    </div>

                    {/* Tier Badges Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Floret */}
                      <div
                        className={`p-5 rounded-sm border transition-all ${
                          tierName === 'FLORET'
                            ? 'border-bark bg-canvas/40 shadow-sm'
                            : 'border-canvas-line bg-linen opacity-75'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-serif font-bold uppercase tracking-wider text-bark">
                            Floret
                          </span>
                          {tierName === 'FLORET' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-bark text-linen">
                              Current Tier
                            </span>
                          )}
                        </div>
                        <p className="text-lg font-serif text-bark mb-1">0 – 499 Pts</p>
                        <ul className="text-xs text-ink-light space-y-1.5 mt-3">
                          <li>• 1 Point per ₹10 spent</li>
                          <li>• Welcome Gift: 50 Points</li>
                          <li>• Complimentary botanical care card</li>
                        </ul>
                      </div>

                      {/* Blossom */}
                      <div
                        className={`p-5 rounded-sm border transition-all ${
                          tierName === 'BLOSSOM'
                            ? 'border-rose bg-rose/5 shadow-sm'
                            : 'border-canvas-line bg-linen opacity-75'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-serif font-bold uppercase tracking-wider text-rose-deep">
                            Blossom
                          </span>
                          {tierName === 'BLOSSOM' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose text-linen">
                              Current Tier
                            </span>
                          )}
                        </div>
                        <p className="text-lg font-serif text-bark mb-1">500 – 1,499 Pts</p>
                        <ul className="text-xs text-ink-light space-y-1.5 mt-3">
                          <li>• 1.25x Points multiplier</li>
                          <li>• Priority studio crafting slot</li>
                          <li>• Early access to seasonal drops</li>
                        </ul>
                      </div>

                      {/* Heirloom */}
                      <div
                        className={`p-5 rounded-sm border transition-all ${
                          tierName === 'HEIRLOOM'
                            ? 'border-amber-600 bg-amber-50 shadow-sm'
                            : 'border-canvas-line bg-linen opacity-75'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-serif font-bold uppercase tracking-wider text-amber-800">
                            Heirloom
                          </span>
                          {tierName === 'HEIRLOOM' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-700 text-linen">
                              Current Tier
                            </span>
                          )}
                        </div>
                        <p className="text-lg font-serif text-bark mb-1">1,500+ Pts</p>
                        <ul className="text-xs text-ink-light space-y-1.5 mt-3">
                          <li>• 1.5x Points multiplier</li>
                          <li>• Free expedited insured shipping</li>
                          <li>• Bespoke floral commission privileges</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Points Ledger Card */}
                  <div className="bg-linen rounded-sm border border-canvas-line p-6 shadow-soft">
                    <h4 className="heading-serif text-xl text-bark mb-4">Points Activity Ledger</h4>

                    {transactionsLoading ? (
                      <div className="py-8 text-center">
                        <Loader2 size={20} className="animate-spin text-rose mx-auto" />
                      </div>
                    ) : loyaltyTransactions.length === 0 ? (
                      <p className="text-xs text-ink-light py-4 text-center">
                        No transactions recorded yet. Place an order or refer friends to earn points!
                      </p>
                    ) : (
                      <div className="divide-y divide-canvas-line">
                        {loyaltyTransactions.map((tx) => (
                          <div key={tx.id} className="py-3 flex items-center justify-between text-xs">
                            <div>
                              <p className="font-medium text-bark">{tx.description}</p>
                              <p className="text-[11px] text-ink-light mt-0.5">
                                {new Date(tx.created_at).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </p>
                            </div>
                            <span
                              className={`font-semibold text-sm ${
                                tx.points >= 0 ? 'text-emerald-700' : 'text-rose'
                              }`}
                            >
                              {tx.points >= 0 ? `+${tx.points}` : tx.points} Pts
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* TAB 3: REFER & EARN                                                      */}
              {/* ========================================================================= */}
              {activeTab === 'referrals' && (
                <div className="bg-linen rounded-sm border border-canvas-line p-6 sm:p-10 shadow-soft">
                  <div className="max-w-xl mx-auto text-center">
                    <div className="w-16 h-16 rounded-full bg-rose/10 text-rose flex items-center justify-center mx-auto mb-4">
                      <Gift size={32} />
                    </div>
                    <h3 className="heading-serif text-3xl text-bark mb-3">
                      Share the Beauty of Handcrafted Flora
                    </h3>
                    <p className="text-xs sm:text-sm text-ink-light leading-relaxed mb-8">
                      Give your friends 10% off their first botanical arrangement. When their order ships, you will automatically receive <strong>100 Atelier Points</strong> (₹100 value) in your account.
                    </p>

                    {/* Referral Code Box */}
                    <div className="bg-parchment-50 p-6 rounded-sm border border-canvas-line mb-8 text-center">
                      <p className="text-[11px] uppercase tracking-widest text-ink-light font-medium mb-2">
                        Your Unique Atelier Code
                      </p>
                      <div className="flex items-center justify-center gap-3">
                        <span className="font-mono text-2xl font-bold tracking-wider text-bark selection:bg-rose selection:text-linen">
                          {profile?.referral_code || 'PB-MEMBER'}
                        </span>
                        <button
                          onClick={copyReferralCode}
                          className="p-2 rounded-sm border border-canvas-line hover:border-bark hover:bg-canvas/40 transition-colors text-ink"
                          title="Copy Code"
                        >
                          {copiedCode ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* Share Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <a
                        href={buildWhatsAppLink(referralWhatsAppText)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-3 rounded-atelier-btn bg-[#25D366] text-linen font-medium text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                      >
                        <Share2 size={16} />
                        Share via WhatsApp
                      </a>

                      <button
                        onClick={copyReferralCode}
                        className="px-6 py-3 rounded-atelier-btn border border-bark text-bark font-medium text-xs uppercase tracking-wider hover:bg-bark hover:text-linen transition-all"
                      >
                        {copiedCode ? 'Code Copied!' : 'Copy Code'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* TAB 4: SAVED ADDRESSES                                                   */}
              {/* ========================================================================= */}
              {activeTab === 'addresses' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="heading-serif text-2xl text-bark">Saved Delivery Addresses</h3>
                    <button
                      onClick={() => setShowAddressModal(true)}
                      className="px-4 py-2 rounded-atelier-btn bg-bark text-linen hover:bg-rose-deep text-xs uppercase tracking-wider font-medium transition-all flex items-center gap-1.5"
                    >
                      <Plus size={14} />
                      Add New Address
                    </button>
                  </div>

                  {addressesLoading ? (
                    <div className="py-8 text-center">
                      <Loader2 size={24} className="animate-spin text-rose mx-auto" />
                    </div>
                  ) : addresses.length === 0 ? (
                    <div className="bg-linen p-8 text-center rounded-sm border border-canvas-line shadow-soft">
                      <MapPin size={32} className="text-ink-light mx-auto mb-3" />
                      <p className="text-xs text-ink-light mb-4">No addresses saved yet.</p>
                      <button
                        onClick={() => setShowAddressModal(true)}
                        className="px-4 py-2 rounded-atelier-btn bg-bark text-linen text-xs uppercase tracking-wider font-medium hover:bg-rose-deep"
                      >
                        Add Address
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {addresses.map((addr) => (
                        <div
                          key={addr.id}
                          className="bg-linen p-5 rounded-sm border border-canvas-line shadow-soft relative"
                        >
                          {addr.is_default && (
                            <span className="absolute top-4 right-4 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose/10 text-rose-deep border border-rose/20">
                              Default Address
                            </span>
                          )}
                          <p className="font-serif font-semibold text-bark text-base mb-1">
                            {addr.recipient_name}
                          </p>
                          <p className="text-xs text-ink-light mb-2">Phone: +91 {addr.phone}</p>
                          <p className="text-xs text-ink leading-relaxed">
                            {addr.address_line1}
                            {addr.address_line2 && `, ${addr.address_line2}`}
                            <br />
                            {addr.city}, {addr.state} — <span className="font-mono">{addr.pincode}</span>
                          </p>

                          <div className="mt-4 pt-3 border-t border-canvas-line flex justify-end">
                            <button
                              onClick={() => handleDeleteAddress(addr.id)}
                              className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                            >
                              <Trash2 size={13} />
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Address Modal */}
                  {showAddressModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bark/40 backdrop-blur-xs">
                      <div className="bg-linen w-full max-w-lg rounded-sm border border-canvas-line shadow-2xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between pb-4 border-b border-canvas-line mb-6">
                          <h4 className="heading-serif text-2xl text-bark">Add Delivery Address</h4>
                          <button
                            onClick={() => setShowAddressModal(false)}
                            className="text-ink-light hover:text-bark text-sm"
                          >
                            ✕
                          </button>
                        </div>

                        <form onSubmit={handleSaveAddress} className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                                Recipient Name *
                              </label>
                              <input
                                type="text"
                                required
                                value={newRecipient}
                                onChange={(e) => setNewRecipient(e.target.value)}
                                placeholder="Recipient name"
                                className="w-full px-3 py-2 bg-canvas/40 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                              />
                            </div>

                            <div>
                              <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                                Phone Number *
                              </label>
                              <input
                                type="tel"
                                required
                                maxLength={10}
                                value={newPhone}
                                onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ''))}
                                placeholder="10-digit mobile"
                                className="w-full px-3 py-2 bg-canvas/40 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                              Flat / House / Apartment / Street *
                            </label>
                            <input
                              type="text"
                              required
                              value={newLine1}
                              onChange={(e) => setNewLine1(e.target.value)}
                              placeholder="House no, Street name"
                              className="w-full px-3 py-2 bg-canvas/40 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                            />
                          </div>

                          <div>
                            <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                              Landmark / Area (Optional)
                            </label>
                            <input
                              type="text"
                              value={newLine2}
                              onChange={(e) => setNewLine2(e.target.value)}
                              placeholder="Near Central Park"
                              className="w-full px-3 py-2 bg-canvas/40 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                                City *
                              </label>
                              <input
                                type="text"
                                required
                                value={newCity}
                                onChange={(e) => setNewCity(e.target.value)}
                                placeholder="City"
                                className="w-full px-3 py-2 bg-canvas/40 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                              />
                            </div>

                            <div>
                              <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                                State *
                              </label>
                              <input
                                type="text"
                                required
                                value={newState}
                                onChange={(e) => setNewState(e.target.value)}
                                placeholder="State"
                                className="w-full px-3 py-2 bg-canvas/40 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                              />
                            </div>

                            <div>
                              <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                                PIN Code *
                              </label>
                              <input
                                type="text"
                                required
                                maxLength={6}
                                value={newPincode}
                                onChange={(e) => setNewPincode(e.target.value.replace(/\D/g, ''))}
                                placeholder="Pincode"
                                className="w-full px-3 py-2 bg-canvas/40 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                              />
                            </div>
                          </div>

                          <label className="flex items-center gap-2 text-xs text-ink cursor-pointer pt-2">
                            <input
                              type="checkbox"
                              checked={isDefaultAddress}
                              onChange={(e) => setIsDefaultAddress(e.target.checked)}
                              className="accent-rose rounded"
                            />
                            <span>Set as default shipping address</span>
                          </label>

                          <div className="flex gap-3 pt-4 border-t border-canvas-line">
                            <button
                              type="button"
                              onClick={() => setShowAddressModal(false)}
                              className="flex-1 py-2.5 rounded-sm border border-canvas-line text-xs uppercase tracking-wider font-medium text-ink hover:bg-canvas/40 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={savingAddress}
                              className="flex-1 py-2.5 rounded-sm bg-bark text-linen hover:bg-rose-deep text-xs uppercase tracking-wider font-medium transition-colors flex items-center justify-center gap-2"
                            >
                              {savingAddress ? (
                                <>
                                  <Loader2 size={14} className="animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                'Save Address'
                              )}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================================= */}
              {/* TAB 5: PROFILE DETAILS                                                   */}
              {/* ========================================================================= */}
              {activeTab === 'profile' && (
                <div className="bg-linen rounded-sm border border-canvas-line p-6 sm:p-8 shadow-soft max-w-xl">
                  <h3 className="heading-serif text-2xl text-bark mb-6">Personal Details</h3>

                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-canvas/40 border border-canvas-line rounded-sm text-sm text-ink focus:outline-none focus:border-bark"
                      />
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                        Email Address (Read-only)
                      </label>
                      <input
                        type="email"
                        disabled
                        value={user.email || ''}
                        className="w-full px-4 py-2.5 bg-canvas/20 border border-canvas-line rounded-sm text-sm text-ink-light cursor-not-allowed opacity-75"
                      />
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                        Mobile Phone Number
                      </label>
                      <input
                        type="tel"
                        maxLength={10}
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-4 py-2.5 bg-canvas/40 border border-canvas-line rounded-sm text-sm text-ink focus:outline-none focus:border-bark"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="mt-4 px-6 py-2.5 rounded-atelier-btn bg-bark text-linen hover:bg-rose-deep text-xs uppercase tracking-wider font-medium transition-all flex items-center gap-2"
                    >
                      {savingProfile ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
