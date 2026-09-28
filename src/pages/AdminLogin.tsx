import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import Reveal from '@/components/Reveal';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('No user session returned. Please check your credentials.');
      }

      // Verify admin role immediately
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileErr) {
        console.error('Error fetching admin profile:', profileErr);
        throw new Error('Unable to verify studio permissions: ' + profileErr.message);
      }

      if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
        await supabase.auth.signOut();
        throw new Error('Access denied: Customer accounts cannot log in to the Studio Admin Portal. Please use the Customer Account page (/account).');
      }

      navigate('/admin/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-parchment-50 flex items-center justify-center p-6">
      <Reveal>
        <div className="w-full max-w-md glass-panel p-10 rounded-sm shadow-soft border border-silk">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.3em] text-rose mb-3">Atelier Access</p>
            <h1 className="heading-serif text-4xl text-ink mb-2">Admin Portal</h1>
            <p className="text-sm text-ink-light font-light">Please authenticate to manage the botanical studio.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-xs uppercase tracking-wider text-ink font-medium ml-1">
                Studio Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-10"
                  placeholder="admin@petalbloom.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-xs uppercase tracking-wider text-ink font-medium ml-1">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-10"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 text-xs text-rose bg-rose/10 rounded-sm border border-rose/20 text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-4 flex items-center justify-center gap-2 text-sm font-medium transition-all duration-500"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Enter Studio'
              )}
            </button>
          </form>
        </div>
      </Reveal>
    </div>
  );
}
