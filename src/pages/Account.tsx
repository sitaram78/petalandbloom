import React, { useState, useEffect, useRef } from 'react';
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
  Edit2,
  FileText,
  RotateCcw,
  X,
  KeyRound,
  Send,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useNotification } from '@/context/NotificationContext';
import { useStoreSettings } from '@/context/StoreSettingsContext';
import { supabase } from '@/lib/supabaseClient';
import { formatPrice, type Product } from '@/data/products';
import { buildWhatsAppLink } from '@/utils/whatsapp';
import Reveal from '@/components/Reveal';
import SEO from '@/components/SEO';
import InvoiceModal, { InvoiceOrderData } from '@/components/admin/InvoiceModal';
import LiveCourierJourney from '@/components/LiveCourierJourney';
import { useProducts } from '@/context/ProductContext';
import { safeUrl } from '@/utils/safeUrl';

export const INDIAN_STATES: string[] = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

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
  guest_name?: string;
  guest_phone?: string;
  guest_email?: string;
  shipping_address_snapshot?: {
    recipientName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  shipments?: Array<{
    id: string;
    carrier: string;
    awb_number: string;
    tracking_url?: string | null;
    status: string;
  }>;
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
  const { settings, triggerAssistance } = useStoreSettings();
  const { getBestsellers, products: allProducts } = useProducts();
  const navigate = useNavigate();
  const location = useLocation();
  const { openCart, addItem } = useCart();
  const returnToCheckout = Boolean((location.state as any)?.returnToCheckout);

  const isLoyaltyEnabled = settings.featureFlags?.enableLoyalty !== false;
  const isInfluencerEnabled = settings.featureFlags?.enableInfluencerProgram !== false;

  // Navigation tab
  const [activeTab, setActiveTab] = useState<TabType>('orders');

  // Auth Form State (when not signed in)
  const [isRegisterMode, setIsRegisterMode] = useState(returnToCheckout);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authReferralCode, setAuthReferralCode] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');

  // Forgot / Set Password Modal State
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotStatus, setForgotStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Set New Password Recovery State
  const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetPasswordSubmitting, setResetPasswordSubmitting] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState('');

  // Dashboard Data State
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyLedgerEntry[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<InvoiceOrderData | null>(null);
  const [copiedAwb, setCopiedAwb] = useState<string | null>(null);

  // Address Form State
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [newRecipient, setNewRecipient] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newLine1, setNewLine1] = useState('');
  const [newLine2, setNewLine2] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [newPincode, setNewPincode] = useState('');
  const [isDefaultAddress, setIsDefaultAddress] = useState(false);
  const [isGiftAddress, setIsGiftAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [pincodeLookupLoading, setPincodeLookupLoading] = useState(false);
  const [pincodeLookupSuccess, setPincodeLookupSuccess] = useState(false);
  const pincodeSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live Courier Tracking Modal State
  const [trackingModalOrder, setTrackingModalOrder] = useState<string | null>(null);
  const [liveTrackingModalData, setLiveTrackingModalData] = useState<any>(null);
  const [trackingModalLoading, setTrackingModalLoading] = useState(false);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (pincodeSuccessTimerRef.current) clearTimeout(pincodeSuccessTimerRef.current);
    };
  }, []);

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
          guest_name,
          guest_phone,
          guest_email,
          shipping_address_snapshot,
          shipments (
            id,
            carrier,
            awb_number,
            tracking_url,
            status
          ),
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

  // Listen for Password Recovery events & detect URL recovery flags
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const hash = location.hash || '';

    if (
      searchParams.get('mode') === 'reset-password' ||
      searchParams.get('type') === 'recovery' ||
      hash.includes('type=recovery')
    ) {
      setIsPasswordRecoveryMode(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecoveryMode(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [location]);

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

        const { error } = await signUpWithEmail(authEmail, authPassword, authFullName, authPhone, authReferralCode.trim());
        if (error) throw error;

        showNotification('Welcome! 40 Petal Points (₹20 discount, valid on orders > ₹299) have been credited to your account.', 'success');

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

  // Handle Secure 2-Factor Ownership Verification & Password Reset
  const handleSendPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail || !forgotEmail.trim()) {
      setForgotStatus({ type: 'error', message: 'Please enter your account email address.' });
      return;
    }
    const cleanPhone = (forgotPhone || '').replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      setForgotStatus({ type: 'error', message: 'Please enter the 10-digit mobile number linked to this account.' });
      return;
    }

    setForgotSubmitting(true);
    setForgotStatus(null);

    try {
      const res = await fetch('/api/account/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim().toLowerCase(),
          phone: cleanPhone,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Verification failed. Please check your details.');
      }

      setForgotStatus({
        type: 'success',
        message: 'Account ownership verified! Redirecting to secure password setup...',
      });

      // Navigate directly to the verified Supabase recovery link
      setTimeout(() => {
        window.location.href = data.redirectUrl;
      }, 600);
    } catch (err: any) {
      setForgotStatus({
        type: 'error',
        message: err.message || 'Unable to verify account details. Please try again.',
      });
    } finally {
      setForgotSubmitting(false);
    }
  };

  // Handle Setting New Password from Recovery flow
  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetPasswordError('');

    if (newPassword.length < 6) {
      setResetPasswordError('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetPasswordError('Passwords do not match. Please verify and try again.');
      return;
    }

    setResetPasswordSubmitting(true);

    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      showNotification('Your password has been successfully set. Welcome back to the Atelier!', 'success');
      setIsPasswordRecoveryMode(false);
      setNewPassword('');
      setConfirmPassword('');
      navigate('/account', { replace: true });

      if (data.user) {
        await refreshProfile();
        loadOrders();
        loadAddresses();
        loadLoyaltyTransactions();
      }
    } catch (err: any) {
      setResetPasswordError(err.message || 'Failed to update password. Your reset link may have expired.');
    } finally {
      setResetPasswordSubmitting(false);
    }
  };

  const handleOpenAddAddress = () => {
    if (pincodeSuccessTimerRef.current) clearTimeout(pincodeSuccessTimerRef.current);
    setEditingAddressId(null);
    setNewRecipient(profile?.full_name || '');
    setNewPhone(profile?.phone || '');
    setNewLine1('');
    setNewLine2('');
    setNewCity('');
    setNewState('');
    setNewPincode('');
    setPincodeLookupLoading(false);
    setPincodeLookupSuccess(false);
    setIsDefaultAddress(addresses.length === 0);
    setIsGiftAddress(false);
    setShowAddressModal(true);
  };

  const handleOpenEditAddress = (addr: SavedAddress) => {
    if (pincodeSuccessTimerRef.current) clearTimeout(pincodeSuccessTimerRef.current);
    setEditingAddressId(addr.id);
    const isGift = addr.recipient_name.toLowerCase().startsWith('gift:');
    setIsGiftAddress(isGift);
    setNewRecipient(isGift ? addr.recipient_name.replace(/^gift:\s*/i, '') : addr.recipient_name);
    setNewPhone(addr.phone);
    setNewLine1(addr.address_line1);
    setNewLine2(addr.address_line2 || '');
    setNewCity(addr.city);
    setNewState(addr.state);
    setNewPincode(addr.pincode);
    setPincodeLookupLoading(false);
    setPincodeLookupSuccess(false);
    setIsDefaultAddress(addr.is_default);
    setShowAddressModal(true);
  };

  // Indian PIN Code Auto-Lookup & District Mapping
  const handlePincodeChange = async (val: string) => {
    const cleanPin = val.replace(/\D/g, '').slice(0, 6);
    setNewPincode(cleanPin);
    if (pincodeSuccessTimerRef.current) clearTimeout(pincodeSuccessTimerRef.current);
    setPincodeLookupSuccess(false);

    if (cleanPin.length === 6) {
      setPincodeLookupLoading(true);

      // 1. Instant heuristic postal zone state mapping
      const prefix2 = cleanPin.slice(0, 2);
      let guessedState = '';
      if (prefix2 === '11') guessedState = 'Delhi';
      else if (['12', '13'].includes(prefix2)) guessedState = 'Haryana';
      else if (['14', '15'].includes(prefix2)) guessedState = 'Punjab';
      else if (prefix2 === '16') guessedState = 'Chandigarh';
      else if (prefix2 === '17') guessedState = 'Himachal Pradesh';
      else if (['18', '19'].includes(prefix2)) guessedState = 'Jammu and Kashmir';
      else if (['20', '21', '22', '23', '24', '25', '26', '27', '28'].includes(prefix2)) guessedState = 'Uttar Pradesh';
      else if (['30', '31', '32', '33', '34'].includes(prefix2)) guessedState = 'Rajasthan';
      else if (['36', '37', '38', '39'].includes(prefix2)) guessedState = 'Gujarat';
      else if (['40', '41', '42', '43', '44'].includes(prefix2)) guessedState = 'Maharashtra';
      else if (['45', '46', '47', '48', '49'].includes(prefix2)) guessedState = 'Madhya Pradesh';
      else if (['50', '51', '52', '53'].includes(prefix2)) guessedState = 'Telangana';
      else if (['56', '57', '58', '59'].includes(prefix2)) guessedState = 'Karnataka';
      else if (['60', '61', '62', '63', '64'].includes(prefix2)) guessedState = 'Tamil Nadu';
      else if (['67', '68', '69'].includes(prefix2)) guessedState = 'Kerala';
      else if (['70', '71', '72', '73', '74'].includes(prefix2)) guessedState = 'West Bengal';
      else if (['75', '76', '77'].includes(prefix2)) guessedState = 'Odisha';
      else if (prefix2 === '78') guessedState = 'Assam';
      else if (['80', '81', '82', '83', '84', '85'].includes(prefix2)) guessedState = 'Bihar';

      if (guessedState && !newState) {
        setNewState(guessedState);
      }

      // 2. Query live official Indian Postal API with timeout
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
            const po = data[0].PostOffice[0];
            if (po.District) setNewCity(po.District);
            if (po.State) {
              const matched = INDIAN_STATES.find(
                (s) => s.toLowerCase() === po.State.toLowerCase()
              ) || po.State;
              setNewState(matched);
            }
            setPincodeLookupSuccess(true);
            if (pincodeSuccessTimerRef.current) clearTimeout(pincodeSuccessTimerRef.current);
            pincodeSuccessTimerRef.current = setTimeout(() => {
              setPincodeLookupSuccess(false);
            }, 2500);
          }
        }
      } catch (err) {
        // Fallback remains active
      } finally {
        setPincodeLookupLoading(false);
      }
    }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    if (!user) return;
    try {
      await supabase
        .from('customer_addresses')
        .update({ is_default: false })
        .eq('customer_id', user.id);

      const { error } = await supabase
        .from('customer_addresses')
        .update({ is_default: true })
        .eq('id', addressId);

      if (error) throw error;
      showNotification('Default delivery address updated.', 'success');
      loadAddresses();
    } catch (err: any) {
      showNotification(err.message || 'Failed to update default address.', 'error');
    }
  };

  // Handle Save Address (Create or Edit)
  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingAddress(true);

    try {
      if (!newRecipient || !newPhone || !newLine1 || !newCity || !newState || !newPincode) {
        throw new Error('Please fill in all required address fields.');
      }

      const cleanPhone = newPhone.replace(/\D/g, '').slice(-10);
      const cleanPincode = newPincode.replace(/\D/g, '');

      if (cleanPhone.length !== 10) {
        throw new Error('Please enter a valid 10-digit mobile number.');
      }
      if (cleanPincode.length !== 6) {
        throw new Error('Please enter a valid 6-digit postal PIN code.');
      }

      const rawRecipient = newRecipient.trim();
      const finalRecipientName = isGiftAddress
        ? (rawRecipient.toLowerCase().startsWith('gift:') ? rawRecipient : `Gift: ${rawRecipient}`)
        : (rawRecipient.toLowerCase().startsWith('gift:') ? rawRecipient.replace(/^gift:\s*/i, '') : rawRecipient);

      // If set as default, reset other defaults first
      if (isDefaultAddress) {
        await supabase
          .from('customer_addresses')
          .update({ is_default: false })
          .eq('customer_id', user.id);
      }

      if (editingAddressId) {
        const { error } = await supabase
          .from('customer_addresses')
          .update({
            recipient_name: finalRecipientName,
            phone: cleanPhone,
            address_line1: newLine1.trim(),
            address_line2: newLine2.trim() || null,
            city: newCity.trim(),
            state: newState.trim(),
            pincode: cleanPincode,
            is_default: isDefaultAddress,
          })
          .eq('id', editingAddressId);

        if (error) throw error;
        showNotification(isGiftAddress ? 'Gift recipient address updated.' : 'Address updated successfully.', 'success');
      } else {
        const { error } = await supabase.from('customer_addresses').insert({
          customer_id: user.id,
          recipient_name: finalRecipientName,
          phone: cleanPhone,
          address_line1: newLine1.trim(),
          address_line2: newLine2.trim() || null,
          city: newCity.trim(),
          state: newState.trim(),
          pincode: cleanPincode,
          is_default: isDefaultAddress || (addresses.length === 0 && !isGiftAddress),
        });

        if (error) throw error;
        showNotification(isGiftAddress ? 'Gift recipient address saved to your Atelier profile.' : 'Address saved to your Atelier profile.', 'success');
      }

      setShowAddressModal(false);
      setEditingAddressId(null);
      setNewRecipient('');
      setNewPhone('');
      setNewLine1('');
      setNewLine2('');
      setNewCity('');
      setNewState('');
      setNewPincode('');
      setIsDefaultAddress(false);
      setIsGiftAddress(false);
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

  // Helper to copy courier AWB number
  const handleCopyAwb = (awb: string) => {
    navigator.clipboard.writeText(awb);
    setCopiedAwb(awb);
    showNotification(`AWB ${awb} copied to clipboard!`, 'success');
    setTimeout(() => setCopiedAwb(null), 2500);
  };

  // 1-Click Buy Again / Re-Order Handler
  const handleBuyAgain = (item: NonNullable<CustomerOrder['order_items']>[number]) => {
    const productForCart: Product = {
      code: item.product_code,
      name: item.product_name,
      category: 'bouquets',
      price: (item.unit_price_in_paise || 0) / 100,
      description: '',
      images: item.item_image ? [item.item_image] : [],
    };
    addItem(productForCart, {
      color: item.selected_color,
      giftWrap: item.gift_wrap,
      message: item.personal_message,
      quantity: 1,
    });
    showNotification(`Added "${item.product_name}" to your bag.`, 'success');
  };

  // Open Official Tax Invoice Modal
  const handleOpenInvoice = (order: CustomerOrder) => {
    const invoiceData: InvoiceOrderData = {
      order_number: order.order_number,
      created_at: order.created_at,
      guest_name: order.guest_name || profile?.full_name || user?.email?.split('@')[0] || 'Valued Patron',
      guest_phone: order.guest_phone || profile?.phone || '',
      guest_email: order.guest_email || user?.email || '',
      shipping_address_snapshot: order.shipping_address_snapshot || {
        recipientName: order.guest_name || profile?.full_name || 'Valued Patron',
        phone: order.guest_phone || profile?.phone || '',
        addressLine1: 'Atelier Address on File',
        city: 'India',
        state: 'India',
        pincode: '000000',
      },
      subtotal_in_paise: order.subtotal_in_paise || order.total_in_paise,
      discount_in_paise: order.discount_in_paise || 0,
      loyalty_discount_in_paise: order.loyalty_discount_in_paise || 0,
      loyalty_points_redeemed: order.loyalty_points_redeemed || 0,
      shipping_fee_in_paise: order.shipping_fee_in_paise || 0,
      total_in_paise: order.total_in_paise,
      payment_status: order.payment_status,
      applied_coupon_code: order.applied_coupon_code,
      order_items: (order.order_items || []).map((i) => ({
        id: i.id,
        product_name: i.product_name,
        product_code: i.product_code,
        quantity: i.quantity,
        unit_price_in_paise: i.unit_price_in_paise,
        selected_color: i.selected_color,
        gift_wrap: i.gift_wrap,
        personal_message: i.personal_message,
      })),
    };
    setSelectedInvoiceOrder(invoiceData);
  };

  // Open Live Courier Tracking Modal
  const handleOpenLiveTracking = async (orderCode: string, isForceRefresh = false) => {
    setTrackingModalOrder(orderCode);
    setTrackingModalLoading(true);
    try {
      const res = await fetch('/api/orders/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: orderCode,
          forceRefresh: isForceRefresh,
        }),
      });
      const data = await res.json();
      if (data.success && data.order) {
        setLiveTrackingModalData({
          liveTracking: data.order.shipment?.liveTracking || data.order.liveTracking,
          shipment: data.order.shipment,
        });
      }
    } catch (e) {
      console.warn('Failed to load live tracking modal:', e);
    } finally {
      setTrackingModalLoading(false);
    }
  };

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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-900 border border-amber-300">
            <Clock size={12} className="text-amber-600 animate-pulse" />
            Awaiting UPI Payment
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
        title={isPasswordRecoveryMode ? 'Set Account Password' : user ? 'My Atelier Account' : 'Customer Sign In'}
        description="Manage your handcrafted floral orders, loyalty points, saved delivery addresses and atelier rewards at The Petal & Bloom."
      />

      <div className="min-h-screen bg-parchment-50/50 pt-28 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* ========================================================================= */}
          {/* RECOVERY STATE: SET NEW PASSWORD CARD                                      */}
          {/* ========================================================================= */}
          {isPasswordRecoveryMode ? (
            <Reveal>
              <div className="max-w-md mx-auto bg-linen rounded-sm border border-canvas-line shadow-soft p-8 sm:p-10">
                <div className="text-center mb-8">
                  <div className="w-12 h-12 rounded-full bg-rose/10 border border-rose/20 text-rose flex items-center justify-center mx-auto mb-3">
                    <KeyRound size={22} />
                  </div>
                  <p className="text-[11px] uppercase tracking-[0.25em] text-rose font-medium mb-1">
                    Security & Access
                  </p>
                  <h1 className="heading-serif text-3xl sm:text-4xl text-bark mb-3">
                    Set Your Password
                  </h1>
                  <p className="text-xs sm:text-sm text-ink-light font-light leading-relaxed">
                    Choose a secure password for your account to access your handcrafted orders, saved addresses, and loyalty rewards.
                  </p>
                </div>

                <form onSubmit={handleSetNewPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                      New Password *
                    </label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-light" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full pl-10 pr-10 py-2.5 bg-canvas/40 border border-canvas-line rounded-sm text-sm text-ink focus:outline-none focus:border-bark focus:bg-linen"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-light hover:text-bark p-1"
                      >
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                      Confirm New Password *
                    </label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-light" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your password"
                        className="w-full pl-10 pr-10 py-2.5 bg-canvas/40 border border-canvas-line rounded-sm text-sm text-ink focus:outline-none focus:border-bark focus:bg-linen"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-light hover:text-bark p-1"
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {resetPasswordError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-sm">
                      {resetPasswordError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={resetPasswordSubmitting}
                    className="w-full mt-2 py-3 rounded-atelier-btn bg-bark text-linen hover:bg-rose-deep text-xs uppercase tracking-widest font-medium transition-all duration-300 flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {resetPasswordSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Saving Password...
                      </>
                    ) : (
                      'Save Password & Access Account'
                    )}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPasswordRecoveryMode(false);
                        navigate('/account', { replace: true });
                      }}
                      className="text-xs text-ink-light hover:text-bark hover:underline"
                    >
                      Cancel and return to Sign In
                    </button>
                  </div>
                </form>
              </div>
            </Reveal>
          ) : !user ? (
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
                      You're claiming <strong>₹20 off</strong> for your pending cart! Sign in or register below, and we'll bring you right back to your bag with your 40 points ready to redeem on orders above ₹299.
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
                      <strong>40 Welcome Points</strong> (₹20 value) and an exclusive referral code are immediately credited to your account upon signing up (applicable on orders above ₹299)!
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

                      <div>
                        <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5 flex items-center justify-between">
                          <span>Referral Code</span>
                          <span className="text-[10px] text-ink-light normal-case">Optional</span>
                        </label>
                        <div className="relative">
                          <Gift size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-rose" />
                          <input
                            type="text"
                            value={authReferralCode}
                            onChange={(e) => setAuthReferralCode(e.target.value.toUpperCase())}
                            placeholder="e.g. BLOOM-1234-567"
                            className="w-full pl-10 pr-4 py-2.5 bg-canvas/40 border border-canvas-line rounded-sm text-sm text-ink focus:outline-none focus:border-bark focus:bg-linen font-mono uppercase"
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
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs uppercase tracking-wider text-bark font-medium">
                        Password *
                      </label>
                      {!isRegisterMode && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowForgotPasswordModal(true);
                            setForgotEmail(authEmail || '');
                            setForgotStatus(null);
                          }}
                          className="text-[11px] text-rose hover:text-rose-deep font-medium hover:underline transition-colors"
                        >
                          Forgot / Set Password?
                        </button>
                      )}
                    </div>
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
                <div className="p-3 sm:p-4 bg-bark text-linen rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md border-l-4 border-amber-400">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ShieldAlert size={20} className="text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-serif text-sm sm:text-base font-medium text-linen truncate">
                          Administrator Session
                        </h4>
                        <span className="hidden sm:inline-block text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-mono">
                          Staff
                        </span>
                      </div>
                      <p className="text-[11px] text-parchment-200 line-clamp-1 sm:line-clamp-none">
                        Signed in as {user.email}. Atelier orders & catalog are managed in the portal.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <Link
                      to="/admin/dashboard"
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-bark font-medium text-xs uppercase tracking-wider rounded-sm transition-colors"
                    >
                      Admin Portal →
                    </Link>
                    <button
                      onClick={signOut}
                      className="px-2.5 py-1.5 border border-parchment-400 text-linen hover:bg-white/10 text-xs uppercase tracking-wider rounded-sm transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}

              {/* Atelier Member Hero Card */}
              <div className="bg-linen rounded-sm border border-canvas-line p-5 sm:p-8 shadow-soft">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between sm:justify-start gap-2.5">
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
                      {/* Mobile quick sign out */}
                      <button
                        onClick={signOut}
                        className="sm:hidden flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700 font-medium py-1 px-2 rounded hover:bg-red-50 transition-colors"
                      >
                        <LogOut size={13} />
                        Sign Out
                      </button>
                    </div>
                    <h1 className="heading-serif text-2xl sm:text-4xl text-bark">
                      Welcome to the Atelier, {profile?.full_name || user.email?.split('@')[0]}
                    </h1>
                    <p className="text-xs sm:text-sm text-ink-light flex flex-wrap items-center gap-2 sm:gap-3">
                      <span className="truncate max-w-[220px] sm:max-w-none">{user.email}</span>
                      {profile?.phone && <span>• +91 {profile.phone}</span>}
                      <span>• Member Since {new Date(profile?.created_at || user.created_at || Date.now()).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
                    </p>
                  </div>

                  {/* Loyalty & Quick Stat Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 self-stretch lg:self-auto">
                    {/* Stat 1: Points Balance (Conditional via Feature Flag) */}
                    {isLoyaltyEnabled && (
                      <div className="bg-parchment-50/80 p-3 sm:p-3.5 rounded-sm border border-canvas-line">
                        <div className="flex items-center gap-2 text-rose mb-1">
                          <Award size={16} />
                          <span className="text-[10px] uppercase tracking-wider text-ink-light font-medium">Petals</span>
                        </div>
                        <p className="text-xl font-serif text-bark font-semibold">
                          {loyalty?.points_balance || 0}
                        </p>
                        <p className="text-[10px] text-rose font-medium mt-0.5">
                          {formatPrice((loyalty?.points_balance || 0) * 0.5)} Store Credit
                        </p>
                      </div>
                    )}

                    {/* Stat 2: Orders Count */}
                    <div className="bg-parchment-50/80 p-3 sm:p-3.5 rounded-sm border border-canvas-line">
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

                    {/* Stat 3: Referral Code (Conditional via Feature Flag) */}
                    {isInfluencerEnabled && (
                      <div
                        onClick={copyReferralCode}
                        className="col-span-2 sm:col-span-1 bg-parchment-50/80 p-3 sm:p-3.5 rounded-sm border border-canvas-line cursor-pointer hover:border-bark transition-colors group"
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
                          {copiedCode ? 'Copied!' : 'Give 10%, Earn 50 Petals'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dashboard Tabs Container with subtle horizontal scroll fade on mobile */}
                <div className="relative mt-7 -mb-2">
                  <div className="flex overflow-x-auto gap-2 border-b border-canvas-line pb-2 scrollbar-none scroll-smooth">
                    <button
                      onClick={() => setActiveTab('orders')}
                      className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs uppercase tracking-wider font-medium rounded-sm transition-all whitespace-nowrap ${
                        activeTab === 'orders'
                          ? 'bg-bark text-linen shadow-sm'
                          : 'text-ink-light hover:text-bark hover:bg-canvas/50'
                      }`}
                    >
                      <ShoppingBag size={15} />
                      My Orders ({orders.length})
                    </button>

                    {isLoyaltyEnabled && (
                      <button
                        onClick={() => setActiveTab('loyalty')}
                        className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs uppercase tracking-wider font-medium rounded-sm transition-all whitespace-nowrap ${
                          activeTab === 'loyalty'
                            ? 'bg-bark text-linen shadow-sm'
                            : 'text-ink-light hover:text-bark hover:bg-canvas/50'
                        }`}
                      >
                        <Award size={15} />
                        Atelier Circle &amp; Points
                      </button>
                    )}

                    {isInfluencerEnabled && (
                      <button
                        onClick={() => setActiveTab('referrals')}
                        className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs uppercase tracking-wider font-medium rounded-sm transition-all whitespace-nowrap ${
                          activeTab === 'referrals'
                            ? 'bg-bark text-linen shadow-sm'
                            : 'text-ink-light hover:text-bark hover:bg-canvas/50'
                        }`}
                      >
                        <Gift size={15} />
                        Refer &amp; Earn
                      </button>
                    )}

                    <button
                      onClick={() => setActiveTab('addresses')}
                      className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs uppercase tracking-wider font-medium rounded-sm transition-all whitespace-nowrap ${
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
                      className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs uppercase tracking-wider font-medium rounded-sm transition-all whitespace-nowrap ${
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
                      className="hidden sm:flex items-center gap-2 px-4 py-2.5 text-xs uppercase tracking-wider font-medium rounded-sm text-red-600 hover:bg-red-50 transition-all ml-auto whitespace-nowrap"
                    >
                      <LogOut size={15} />
                      Sign Out
                    </button>
                  </div>
                  {/* Subtle right-edge scroll hint gradient on mobile */}
                  <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-10 bg-gradient-to-l from-linen via-linen/80 to-transparent sm:hidden" />
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
                    <div className="bg-linen p-8 sm:p-12 text-center rounded-sm border border-canvas-line shadow-soft">
                      <div className="w-16 h-16 rounded-full bg-rose/10 text-rose flex items-center justify-center mx-auto mb-4">
                        <Package size={28} />
                      </div>
                      <h3 className="heading-serif text-2xl text-bark mb-2">No Atelier Orders Yet</h3>
                      <p className="text-xs sm:text-sm text-ink-light max-w-md mx-auto mb-6">
                        Each Petal &amp; Bloom arrangement is patiently crocheted with archival combed cotton yarns to remain vibrant forever. Your future heirloom bouquets will appear here.
                      </p>
                      <Link
                        to="/shop"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-atelier-btn bg-bark text-linen hover:bg-rose-deep text-xs uppercase tracking-wider font-medium transition-all"
                      >
                        Explore Floral Collection
                        <ArrowRight size={14} />
                      </Link>

                      {/* Curated Atelier Bestsellers Showcase */}
                      {(() => {
                        const bestsellers = getBestsellers().slice(0, 3);
                        const displayProducts = bestsellers.length > 0 ? bestsellers : allProducts.slice(0, 3);
                        if (displayProducts.length === 0) return null;

                        return (
                          <div className="mt-10 pt-8 border-t border-canvas-line text-left">
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <h4 className="font-serif text-base sm:text-lg text-bark font-medium">
                                  Curated Atelier Bestsellers
                                </h4>
                                <p className="text-[11px] text-ink-light mt-0.5">
                                  Patron favorites handcrafted with everlasting botanical yarns
                                </p>
                              </div>
                              <Link
                                to="/shop"
                                className="text-xs text-rose hover:text-rose-deep font-medium flex items-center gap-1 shrink-0"
                              >
                                View All <ChevronRight size={13} />
                              </Link>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                              {displayProducts.map((product) => (
                                <div
                                  key={product.code}
                                  className="bg-parchment-50/70 border border-canvas-line rounded-sm p-3.5 flex flex-col justify-between hover:border-bark/40 transition-all group shadow-2xs"
                                >
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className="w-14 h-16 rounded-sm bg-canvas overflow-hidden shrink-0 border border-canvas-line flex items-center justify-center">
                                      {product.images?.[0] ? (
                                        <img
                                          src={product.images[0]}
                                          alt={product.name}
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                      ) : (
                                        <Package size={20} className="text-ink-light/40" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <h5 className="font-serif text-sm font-medium text-bark truncate">
                                        {product.name}
                                      </h5>
                                      <p className="text-xs font-serif font-semibold text-rose-deep mt-0.5">
                                        {formatPrice(product.price)}
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      addItem(product, { quantity: 1 });
                                      showNotification(`Added "${product.name}" to your bag.`, 'success');
                                    }}
                                    className="w-full py-1.5 rounded-sm bg-linen hover:bg-bark hover:text-linen text-bark text-xs font-medium border border-canvas-line transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer group"
                                  >
                                    <ShoppingBag size={12} className="text-rose group-hover:text-linen transition-colors" />
                                    <span>Add to Bag</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
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

                          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 self-end sm:self-auto">
                            <span className="font-serif text-lg font-semibold text-bark mr-1">
                              {formatPrice(order.total_in_paise / 100)}
                            </span>
                            {order.order_status === 'PENDING_PAYMENT' && (
                              <a
                                href={buildWhatsAppLink(
                                  `Hi The Petal & Bloom! Regarding my order #${order.order_number} for ${formatPrice(order.total_in_paise / 100)}. Please share your studio UPI QR code or UPI ID so I can complete payment.`
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3.5 py-1.5 rounded-sm bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-medium transition-all flex items-center gap-1.5 shadow-2xs"
                                title="Pay via WhatsApp UPI"
                              >
                                <MessageCircle size={13} />
                                <span>Pay via WhatsApp</span>
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenInvoice(order)}
                              className="px-3 py-1.5 rounded-sm border border-canvas-line text-xs font-medium text-bark hover:border-bark hover:bg-canvas/30 transition-all flex items-center gap-1.5 cursor-pointer"
                              title="View & Print Official Tax Invoice"
                            >
                              <FileText size={12} className="text-ink-light" />
                              <span>Invoice</span>
                            </button>
                            <Link
                              to={`/order-confirmation?order_id=${encodeURIComponent(order.order_number)}`}
                              className="px-3 py-1.5 rounded-sm border border-canvas-line text-xs font-medium text-bark hover:border-bark hover:bg-canvas/30 transition-all flex items-center gap-1.5"
                            >
                              Receipt
                              <ExternalLink size={12} />
                            </Link>
                            {['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.order_status) && (
                              <button
                                type="button"
                                onClick={() => handleOpenLiveTracking(order.order_number)}
                                className="px-3 py-1.5 rounded-sm bg-[#F0F5EE] border border-[#D1E0CD] text-[#2D5A27] text-xs font-medium hover:bg-[#e4ede1] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                title="View Live Delhivery Journey"
                              >
                                <Truck size={13} className="text-[#2D5A27]" />
                                <span>Live Courier</span>
                              </button>
                            )}
                            <Link
                              to={`/track?order_number=${encodeURIComponent(order.order_number)}`}
                              className="px-3.5 py-1.5 rounded-sm bg-rose text-linen text-xs font-medium hover:bg-rose-deep transition-all flex items-center gap-1.5"
                            >
                              Track
                              <ChevronRight size={14} />
                            </Link>
                          </div>
                        </div>

                        {/* Awaiting UPI Payment Settlement Banner */}
                        {order.order_status === 'PENDING_PAYMENT' && (
                          <div className="mt-3 p-3.5 rounded-sm bg-amber-50/90 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                            <div className="flex items-start sm:items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-amber-800">
                                <Clock size={16} />
                              </div>
                              <div>
                                <p className="font-semibold text-amber-950">
                                  Order Placed · Awaiting UPI Payment of {formatPrice(order.total_in_paise / 100)}
                                </p>
                                <p className="text-amber-800/90 text-[11px] mt-0.5">
                                  Send us a message on WhatsApp to get our studio UPI QR / ID. Share your payment screenshot to confirm your order and begin crafting.
                                </p>
                              </div>
                            </div>
                            <a
                              href={buildWhatsAppLink(
                                `Hi The Petal & Bloom! Regarding my order #${order.order_number} for ${formatPrice(order.total_in_paise / 100)}. Please share your studio UPI QR code or UPI ID so I can complete payment.`
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm bg-[#25D366] hover:bg-[#20bd5a] text-white font-medium text-xs transition-colors shrink-0 shadow-2xs"
                            >
                              <MessageCircle size={13} />
                              <span>Settle via WhatsApp</span>
                            </a>
                          </div>
                        )}

                        {/* Courier Dispatch & Tracking Number Waybill Banner */}
                        {order.shipments && order.shipments.length > 0 && order.shipments[0].awb_number && (
                          <div className="mt-3 px-3.5 py-2 rounded-sm bg-canvas/40 border border-canvas-line flex flex-wrap items-center justify-between gap-2.5 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="flex items-center gap-1.5 text-emerald-800 font-medium">
                                <Truck size={14} className="text-emerald-700 shrink-0" />
                                Courier: <strong className="text-bark font-semibold">{order.shipments[0].carrier || 'Standard Courier'}</strong>
                              </span>
                              <span className="text-ink-light hidden sm:inline">•</span>
                              <span className="text-ink-light font-medium">
                                AWB / Waybill:
                              </span>
                              <span className="font-mono font-bold text-bark bg-linen px-2 py-0.5 rounded border border-canvas-line text-[11px] select-all">
                                {order.shipments[0].awb_number}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyAwb(order.shipments![0].awb_number)}
                                className="p-1 hover:text-bark text-ink-light transition-colors rounded hover:bg-canvas cursor-pointer"
                                title="Copy AWB Number"
                              >
                                {copiedAwb === order.shipments[0].awb_number ? (
                                  <Check size={13} className="text-emerald-600" />
                                ) : (
                                  <Copy size={13} />
                                )}
                              </button>
                            </div>

                            {order.shipments[0].tracking_url && (
                              <a
                                href={safeUrl(order.shipments[0].tracking_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-rose hover:text-rose-deep font-medium flex items-center gap-1 hover:underline ml-auto sm:ml-0"
                              >
                                Live Courier Tracking ↗
                              </a>
                            )}
                          </div>
                        )}

                        {/* Crafting & Delivery 4-Step Timeline */}
                        {order.order_status !== 'CANCELLED' && (
                          <div className="py-4 sm:py-5 my-2 border-b border-canvas-line/60">
                            {/* Mobile Compact Segmented Tracker (< sm) */}
                            <div className="sm:hidden px-1">
                              <div className="flex items-center justify-between text-xs mb-2">
                                <span className="text-[11px] uppercase tracking-wider text-ink-light font-medium">
                                  Stage {getOrderStep(order.order_status)} of 4
                                </span>
                                <span className="text-xs text-emerald-800 font-medium font-serif flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                                  {order.order_status === 'DELIVERED'
                                    ? 'Delivered'
                                    : order.order_status === 'SHIPPED' || order.order_status === 'OUT_FOR_DELIVERY' || order.order_status === 'PACKED'
                                    ? (order.order_status === 'PACKED' ? 'Packed & Inspected' : 'Dispatched')
                                    : order.order_status === 'PROCESSING'
                                    ? 'Handcrafting'
                                    : order.order_status === 'PENDING_PAYMENT'
                                    ? 'Awaiting UPI'
                                    : 'Confirmed'}
                                </span>
                              </div>
                              <div className="grid grid-cols-4 gap-1.5">
                                {[
                                  { step: 1, label: 'Confirmed' },
                                  { step: 2, label: 'Crafting' },
                                  { step: 3, label: 'Dispatched' },
                                  { step: 4, label: 'Delivered' },
                                ].map((s) => {
                                  const currentStep = getOrderStep(order.order_status);
                                  const isCompleted = currentStep >= s.step;
                                  const isCurrent = currentStep === s.step;

                                  return (
                                    <div key={s.step} className="flex flex-col gap-1">
                                      <div
                                        className={`h-1.5 rounded-full transition-all duration-300 ${
                                          isCompleted
                                            ? 'bg-emerald-600'
                                            : 'bg-canvas-line'
                                        } ${isCurrent ? 'ring-1 ring-emerald-500/60' : ''}`}
                                      />
                                      <span
                                        className={`text-[9px] uppercase tracking-tight text-center truncate ${
                                          isCurrent
                                            ? 'text-bark font-semibold'
                                            : isCompleted
                                            ? 'text-emerald-800'
                                            : 'text-ink-light/60'
                                        }`}
                                      >
                                        {s.label}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Desktop / Tablet Timeline (>= sm) */}
                            <div className="hidden sm:flex relative items-center justify-between max-w-xl mx-auto px-4">
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

                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 shrink-0 self-end sm:self-center">
                                <span className="text-sm font-medium text-bark font-serif text-right sm:text-left">
                                  {formatPrice(((item.unit_price_in_paise || 0) * item.quantity) / 100)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleBuyAgain(item)}
                                  className="px-2.5 py-1 rounded-sm bg-linen hover:bg-bark hover:text-linen text-bark text-[11px] font-medium border border-canvas-line transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer group whitespace-nowrap"
                                  title="Add this bouquet to your bag"
                                >
                                  <RotateCcw size={11} className="text-rose group-hover:text-linen transition-colors" />
                                  <span>Buy Again</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Order Financial Breakdown & Studio Concierge */}
                        <div className="mt-4 pt-3.5 border-t border-canvas-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-parchment-50/50 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-4 rounded-b-sm">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-light">
                            <span>Subtotal: {formatPrice((order.subtotal_in_paise || order.total_in_paise) / 100)}</span>
                            {order.loyalty_points_redeemed && order.loyalty_points_redeemed > 0 ? (
                              <span className="text-rose font-medium">
                                Petals: -{formatPrice((order.loyalty_discount_in_paise || order.loyalty_points_redeemed * 50) / 100)} ({order.loyalty_points_redeemed} pts)
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

                          <div className="flex items-center gap-3 self-end sm:self-auto">
                            {['PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.order_status) && (
                              <span
                                className="text-[10px] uppercase tracking-wider font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded"
                                title="Made-to-order floral pieces are handcrafted individually and cannot be cancelled once crafting has commenced."
                              >
                                Bespoke Crafting · Non-Cancellable
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                triggerAssistance(
                                  `Hello The Petal & Bloom Atelier, I would like an update / have a question regarding my order #${order.order_number}.`
                                )
                              }
                              className="text-xs text-rose hover:text-rose-deep font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <MessageCircle size={13} />
                              Studio Concierge
                            </button>
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
                      Every bespoke bouquet crafted at The Petal & Bloom earns rewards. Earn 1 Petal Point for every ₹20 spent. Redeem points directly at checkout (1 Petal Point = ₹0.50, meaning 2 points = ₹1.00 off on orders above ₹299).
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
                          <li>• 1 Point per ₹20 spent</li>
                          <li>• Welcome Gift: 40 Points (₹20 value)</li>
                          <li>• 2 Points = ₹1.00 off on orders &gt; ₹299</li>
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
                      Share your unique code with friends. When they complete their first order, you will receive <strong>50 Petal Points</strong> (₹25 value) in your account (credited once you have made at least one purchase with us).
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
                    <div>
                      <h3 className="heading-serif text-2xl text-bark">Saved Delivery Addresses</h3>
                      <p className="text-xs text-ink-light mt-0.5">Manage your shipping destinations for 1-click checkout.</p>
                    </div>
                    <button
                      onClick={handleOpenAddAddress}
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
                        onClick={handleOpenAddAddress}
                        className="px-4 py-2 rounded-atelier-btn bg-bark text-linen text-xs uppercase tracking-wider font-medium hover:bg-rose-deep"
                      >
                        Add Address
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {addresses.map((addr) => {
                        const isGift = addr.recipient_name.toLowerCase().startsWith('gift:');
                        const cleanRecipientName = isGift
                          ? addr.recipient_name.replace(/^gift:\s*/i, '')
                          : addr.recipient_name;

                        return (
                          <div
                            key={addr.id}
                            className={`p-5 rounded-sm border shadow-soft relative transition-all ${
                              addr.is_default
                                ? 'bg-parchment-50/70 border-rose/40 ring-1 ring-rose/30 shadow-md'
                                : isGift
                                ? 'bg-rose/5 border-rose/30 ring-1 ring-rose/20 shadow-xs hover:border-rose/50'
                                : 'bg-linen border-canvas-line hover:border-canvas-line-hover'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isGift ? (
                                  <Gift size={16} className="text-rose shrink-0" />
                                ) : (
                                  <MapPin size={15} className={addr.is_default ? 'text-rose shrink-0' : 'text-ink-light shrink-0'} />
                                )}
                                <p className="font-serif font-semibold text-bark text-base truncate">
                                  {cleanRecipientName}
                                </p>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {isGift && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose/15 text-rose-deep border border-rose/30 flex items-center gap-1 shadow-2xs">
                                    <Gift size={10} className="text-rose" />
                                    Gift Recipient
                                  </span>
                                )}
                                {addr.is_default && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose/10 text-rose-deep border border-rose/30 flex items-center gap-1 shadow-2xs">
                                    <Sparkles size={10} className="text-rose" />
                                    Primary Delivery
                                  </span>
                                )}
                              </div>
                            </div>

                            <p className="text-xs text-ink-light mb-2 flex items-center gap-1.5">
                              <span>Phone: +91 {addr.phone}</span>
                              {isGift && <span className="text-[10px] text-rose font-medium">(Recipient courier call)</span>}
                            </p>
                            <p className="text-xs text-ink leading-relaxed">
                              {addr.address_line1}
                              {addr.address_line2 && `, ${addr.address_line2}`}
                              <br />
                              {addr.city}, {addr.state} — <span className="font-mono font-bold text-bark">{addr.pincode}</span>
                            </p>

                            <div className="mt-4 pt-3 border-t border-canvas-line flex items-center justify-between">
                              {!addr.is_default ? (
                                <button
                                  type="button"
                                  onClick={() => handleSetDefaultAddress(addr.id)}
                                  className="text-xs text-rose hover:text-rose-deep font-medium underline underline-offset-2 cursor-pointer"
                                >
                                  Set as Default
                                </button>
                              ) : (
                                <span className="text-[11px] text-emerald-800 font-medium flex items-center gap-1">
                                  <Check size={12} className="text-emerald-600" /> Primary destination
                                </span>
                              )}

                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditAddress(addr)}
                                  className="text-xs text-ink-light hover:text-bark flex items-center gap-1 font-medium transition-colors cursor-pointer"
                                >
                                  <Edit2 size={13} />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAddress(addr.id)}
                                  className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add / Edit Address Modal */}
                  {showAddressModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bark/40 backdrop-blur-xs">
                      <div className="bg-linen w-full max-w-lg rounded-sm border border-canvas-line shadow-2xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between pb-4 border-b border-canvas-line mb-6">
                          <h4 className="heading-serif text-2xl text-bark">
                            {editingAddressId ? 'Edit Delivery Address' : 'Add Delivery Address'}
                          </h4>
                          <button
                            onClick={() => {
                              setShowAddressModal(false);
                              setEditingAddressId(null);
                            }}
                            className="text-ink-light hover:text-bark text-sm"
                          >
                            ✕
                          </button>
                        </div>

                        <form onSubmit={handleSaveAddress} className="space-y-4">
                          {/* Gifting Address Toggle */}
                          <div
                            className={`p-3 rounded-sm border transition-all ${
                              isGiftAddress
                                ? 'bg-rose/10 border-rose/30 shadow-2xs'
                                : 'bg-canvas/30 border-canvas-line hover:border-canvas-line-hover'
                            }`}
                          >
                            <label className="flex items-center justify-between cursor-pointer">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                                    isGiftAddress ? 'bg-rose text-linen' : 'bg-linen border border-canvas-line text-rose'
                                  }`}
                                >
                                  <Gift size={14} />
                                </div>
                                <div>
                                  <span className="text-xs font-semibold text-bark block">
                                    This is a Gift Recipient Address
                                  </span>
                                  <span className="text-[10px] text-ink-light block">
                                    Tag with a Gift badge for sending floral surprises directly to family or friends
                                  </span>
                                </div>
                              </div>
                              <input
                                type="checkbox"
                                checked={isGiftAddress}
                                onChange={(e) => setIsGiftAddress(e.target.checked)}
                                className="w-4 h-4 accent-rose rounded cursor-pointer"
                              />
                            </label>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5 h-4 flex items-center">
                                {isGiftAddress ? "Recipient's Full Name *" : 'Recipient Name *'}
                              </label>
                              <input
                                type="text"
                                required
                                value={newRecipient}
                                onChange={(e) => setNewRecipient(e.target.value)}
                                placeholder={isGiftAddress ? "e.g. Ananya Sharma" : "Recipient name"}
                                className="w-full h-10 px-3 py-2 bg-canvas/40 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                              />
                            </div>

                            <div>
                              <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5 h-4 flex items-center justify-between">
                                <span>{isGiftAddress ? "Recipient's Mobile *" : 'Phone Number *'}</span>
                                {isGiftAddress && (
                                  <span className="text-[10px] text-rose font-normal lowercase">for courier call</span>
                                )}
                              </label>
                              <input
                                type="tel"
                                required
                                maxLength={10}
                                value={newPhone}
                                onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ''))}
                                placeholder="10-digit mobile"
                                className="w-full h-10 px-3 py-2 bg-canvas/40 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5 h-4 flex items-center">
                              Flat / House / Apartment / Street *
                            </label>
                            <input
                              type="text"
                              required
                              value={newLine1}
                              onChange={(e) => setNewLine1(e.target.value)}
                              placeholder="House no, Street name"
                              className="w-full h-10 px-3 py-2 bg-canvas/40 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                            />
                          </div>

                          <div>
                            <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5 h-4 flex items-center">
                              Landmark / Area (Optional)
                            </label>
                            <input
                              type="text"
                              value={newLine2}
                              onChange={(e) => setNewLine2(e.target.value)}
                              placeholder="Near Central Park"
                              className="w-full h-10 px-3 py-2 bg-canvas/40 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5 h-4 flex items-center">
                                PIN Code *
                              </label>
                              <div className="relative">
                                <input
                                  type="text"
                                  required
                                  maxLength={6}
                                  value={newPincode}
                                  onChange={(e) => handlePincodeChange(e.target.value)}
                                  placeholder="6-digit PIN"
                                  className="w-full h-10 pl-3 pr-20 py-2 bg-canvas/40 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark font-mono"
                                />
                                {pincodeLookupLoading && (
                                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-rose pointer-events-none flex items-center gap-1 text-[10px] font-sans">
                                    <Loader2 size={12} className="animate-spin" />
                                    <span className="hidden sm:inline">Checking</span>
                                  </div>
                                )}
                                {pincodeLookupSuccess && (
                                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-emerald-800 bg-emerald-100/90 border border-emerald-300/80 font-medium px-1.5 py-0.5 rounded flex items-center gap-1 shadow-xs pointer-events-none animate-in fade-in zoom-in-95 duration-200">
                                    <Check size={11} className="stroke-[2.5]" />
                                    <span>Auto-filled</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5 h-4 flex items-center">
                                City / District *
                              </label>
                              <input
                                type="text"
                                required
                                value={newCity}
                                onChange={(e) => setNewCity(e.target.value)}
                                placeholder="City"
                                className="w-full h-10 px-3 py-2 bg-canvas/40 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                              />
                            </div>

                            <div>
                              <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5 h-4 flex items-center">
                                State *
                              </label>
                              <select
                                required
                                value={newState}
                                onChange={(e) => setNewState(e.target.value)}
                                className="w-full h-10 px-3 py-2 bg-canvas/40 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                              >
                                <option value="">Select State</option>
                                {INDIAN_STATES.map((st) => (
                                  <option key={st} value={st}>
                                    {st}
                                  </option>
                                ))}
                              </select>
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
                              ) : editingAddressId ? (
                                'Update Address'
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

      {/* Official Tax Invoice Modal */}
      {selectedInvoiceOrder && (
        <InvoiceModal
          order={selectedInvoiceOrder}
          onClose={() => setSelectedInvoiceOrder(null)}
        />
      )}

      {/* Live Courier Journey Modal */}
      {trackingModalOrder && (
        <LiveCourierJourney
          variant="modal"
          orderNumber={trackingModalOrder}
          liveTracking={liveTrackingModalData?.liveTracking}
          shipment={liveTrackingModalData?.shipment}
          isRefreshing={trackingModalLoading}
          onRefresh={() => handleOpenLiveTracking(trackingModalOrder, true)}
          onClose={() => {
            setTrackingModalOrder(null);
            setLiveTrackingModalData(null);
          }}
        />
      )}

      {/* Forgot / Set Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bark/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-linen rounded-sm border border-canvas-line shadow-2xl p-6 sm:p-8">
            <button
              type="button"
              onClick={() => setShowForgotPasswordModal(false)}
              className="absolute top-4 right-4 p-1.5 text-ink-light hover:text-bark rounded-full hover:bg-canvas/50 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-rose/10 border border-rose/20 text-rose flex items-center justify-center mx-auto mb-3">
                <KeyRound size={22} />
              </div>
              <h3 className="heading-serif text-2xl text-bark mb-1.5">
                Set or Reset Password
              </h3>
              <p className="text-xs text-ink-light leading-relaxed">
                Enter your account email and registered mobile number to verify ownership and instantly create or update your password.
              </p>
            </div>

            {forgotStatus?.type === 'success' ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-sm text-xs text-emerald-800 leading-relaxed flex items-start gap-2.5">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">Ownership Verified</p>
                    <p>{forgotStatus.message}</p>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendPasswordReset} className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                    Account Email Address *
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-light" />
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-canvas/40 border border-canvas-line rounded-sm text-sm text-ink focus:outline-none focus:border-bark focus:bg-linen"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                    Registered Mobile Number *
                  </label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-light" />
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={forgotPhone}
                      onChange={(e) => setForgotPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="10-digit mobile number"
                      className="w-full pl-10 pr-4 py-2.5 bg-canvas/40 border border-canvas-line rounded-sm text-sm text-ink focus:outline-none focus:border-bark focus:bg-linen"
                    />
                  </div>
                </div>

                {forgotStatus?.type === 'error' && (
                  <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-sm">
                    {forgotStatus.message}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordModal(false)}
                    className="flex-1 py-2.5 rounded-atelier-btn border border-canvas-line text-xs uppercase tracking-wider font-medium text-bark hover:bg-canvas/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotSubmitting}
                    className="flex-1 py-2.5 rounded-atelier-btn bg-bark text-linen hover:bg-rose-deep text-xs uppercase tracking-wider font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {forgotSubmitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <ShieldAlert size={14} />
                        Verify & Set Password
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
