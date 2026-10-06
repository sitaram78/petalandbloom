import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

export type StaffRole = 'customer' | 'super_admin' | 'admin' | 'operations' | 'support' | 'marketing';

export interface CustomerProfile {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  role: StaffRole;
  permissions?: string[];
  referral_code: string | null;
  referred_by: string | null;
  created_at: string;
}

export interface LoyaltyAccount {
  customer_id: string;
  points_balance: number;
  lifetime_points_earned: number;
  tier: 'FLORET' | 'BLOSSOM' | 'HEIRLOOM';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: CustomerProfile | null;
  loyalty: LoyaltyAccount | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isStaff: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string, fullName: string, phone: string, referredByCode?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: { full_name?: string; phone?: string }) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyAccount | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchUserData = async (currentUser: User) => {
    try {
      // 1. Fetch Profile
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (profileErr) {
        console.warn('Error fetching profile:', profileErr.message);
      } else if (profileData) {
        const isFounder = ['admin@thepetalandbloom.in', 'sitaramnayak8763@gmail.com'].includes((currentUser.email || '').toLowerCase().trim());
        const role = isFounder
          ? 'super_admin'
          : (profileData.role || currentUser.app_metadata?.role || currentUser.user_metadata?.role || 'customer');

        const permissions = Array.isArray(profileData.permissions) && profileData.permissions.length > 0
          ? profileData.permissions
          : (Array.isArray(currentUser.app_metadata?.permissions) && currentUser.app_metadata.permissions.length > 0
             ? currentUser.app_metadata.permissions
             : []);

        setProfile({
          ...profileData,
          role,
          permissions,
        } as CustomerProfile);
      }

      // 2. Fetch Loyalty Account
      const { data: loyaltyData, error: loyaltyErr } = await supabase
        .from('loyalty_accounts')
        .select('*')
        .eq('customer_id', currentUser.id)
        .maybeSingle();

      if (loyaltyErr) {
        console.warn('Error fetching loyalty account:', loyaltyErr.message);
      } else if (loyaltyData) {
        setLoyalty(loyaltyData as LoyaltyAccount);
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
    }
  };

  useEffect(() => {
    // Initial session load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen to auth state transitions
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          await fetchUserData(newSession.user);
        } else {
          setProfile(null);
          setLoyalty(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error ? new Error(error.message) : null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signUpWithEmail = async (email: string, password: string, fullName: string, phone: string, referredByCode?: string) => {
    try {
      const res = await fetch('/api/account/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName, phone, referredByCode }),
      });

      const data = await res.json();
      if (!data.success) {
        return { error: new Error(data.message || 'Registration failed.') };
      }

      // Automatically sign in the newly registered customer
      const { data: authData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInErr) {
        return { error: new Error(signInErr.message) };
      }

      if (authData.user) {
        await fetchUserData(authData.user);
      }

      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setLoyalty(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user);
    }
  };

  const updateProfile = async (updates: { full_name?: string; phone?: string }) => {
    if (!user) return { error: new Error('User not authenticated') };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;
      await refreshProfile();
      return { error: null };
    } catch (err: any) {
      return { error: new Error(err.message || 'Failed to update profile') };
    }
  };

  const isFounder = ['admin@thepetalandbloom.in', 'sitaramnayak8763@gmail.com'].includes((user?.email || '').toLowerCase().trim());
  const isSuperAdmin = profile?.role === 'super_admin' || isFounder;
  const isAdmin = profile?.role === 'admin' || isSuperAdmin;
  const isStaff = isSuperAdmin || ['admin', 'operations', 'support', 'marketing'].includes(profile?.role || '');

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loyalty,
        loading,
        isAdmin,
        isSuperAdmin,
        isStaff,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
