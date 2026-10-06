import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, ShieldAlert } from 'lucide-react';
import { type PermissionKey, hasPermission } from '@/utils/rbac';
import type { CustomerProfile } from '@/context/AuthContext';

interface AdminRouteProps {
  requiredPermission?: PermissionKey;
}

export default function AdminRoute({ requiredPermission }: AdminRouteProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkRole(user: any) {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (mounted) {
          const STAFF_ROLES = ['super_admin', 'admin', 'operations', 'support', 'marketing'];
          const isFounder = user.email === 'admin@thepetalandbloom.in' || user.email === 'sitaramnayak8763@gmail.com';
          const role = isFounder
            ? 'super_admin'
            : (profile?.role || user.app_metadata?.role || user.user_metadata?.role || 'customer');

          const userIsStaff = STAFF_ROLES.includes(role);
          setIsStaff(Boolean(userIsStaff));

          if (userIsStaff) {
            if (!requiredPermission) {
              setHasAccess(true);
            } else {
              const activeProfile: CustomerProfile = profile ? {
                ...profile,
                role,
                permissions: Array.isArray(profile.permissions) && profile.permissions.length > 0
                  ? profile.permissions
                  : (Array.isArray(user.app_metadata?.permissions) ? user.app_metadata.permissions : []),
              } : {
                id: user.id,
                email: user.email,
                phone: user.phone || null,
                full_name: user.user_metadata?.full_name || null,
                role: role,
                permissions: Array.isArray(user.app_metadata?.permissions) ? user.app_metadata.permissions : [],
                referral_code: null,
                referred_by: null,
                created_at: new Date().toISOString(),
              };
              setHasAccess(hasPermission(activeProfile, requiredPermission));
            }
          } else {
            setHasAccess(false);
          }

          setIsLoading(false);
        }
      } catch (err) {
        console.error('Admin verification error:', err);
        if (mounted) {
          setIsStaff(false);
          setHasAccess(false);
          setIsLoading(false);
        }
      }
    }

    // 1. Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        if (mounted) {
          setIsStaff(false);
          setHasAccess(false);
          setIsLoading(false);
        }
      } else {
        checkRole(session.user);
      }
    });

    // 2. Auth state transition listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        if (mounted) {
          setIsStaff(false);
          setHasAccess(false);
          setIsLoading(false);
        }
      } else {
        checkRole(session.user);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [requiredPermission]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-parchment-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-rose" />
      </div>
    );
  }

  if (isStaff && !hasAccess) {
    return (
      <div className="min-h-screen bg-parchment-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-silk rounded-xl shadow-md p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose/10 text-rose flex items-center justify-center mx-auto">
            <ShieldAlert size={24} />
          </div>
          <h2 className="font-serif text-xl text-bark">Restricted Studio Access</h2>
          <p className="text-xs text-ink-light">
            Your current staff role does not have authorization to access this operational module {requiredPermission ? `("${requiredPermission}")` : ''}.
          </p>
          <a
            href="/admin/dashboard"
            className="inline-block px-5 py-2.5 bg-bark text-linen rounded-md text-xs font-medium hover:bg-bark/90 transition-colors"
          >
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return isStaff ? <Outlet /> : <Navigate to="/admin/login" replace />;
}
