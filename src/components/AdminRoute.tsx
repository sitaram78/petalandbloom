import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';

export default function AdminRoute() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkRole(userId: string) {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle();

        if (mounted) {
          if (!error && profile && (profile.role === 'admin' || profile.role === 'super_admin')) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Admin verification error:', err);
        if (mounted) {
          setIsAdmin(false);
          setIsLoading(false);
        }
      }
    }

    // 1. Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        if (mounted) {
          setIsAdmin(false);
          setIsLoading(false);
        }
      } else {
        checkRole(session.user.id);
      }
    });

    // 2. Auth state transition listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        if (mounted) {
          setIsAdmin(false);
          setIsLoading(false);
        }
      } else {
        checkRole(session.user.id);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-parchment-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-rose" />
      </div>
    );
  }

  return isAdmin ? <Outlet /> : <Navigate to="/admin/login" replace />;
}
