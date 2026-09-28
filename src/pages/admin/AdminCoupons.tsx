import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, Ticket } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import AdminLayout from '@/components/AdminLayout';

interface Coupon {
  id: string;
  code: string;
  recipient_name: string;
  discount_percent: number;
  expires_at: string | null;
  usage_limit: number | null;
  usage_count: number;
  active: boolean;
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ code: '', recipientName: '', discountPercent: 10, expiresAt: '', usageLimit: '' });

  const loadCoupons = async () => {
    const { data, error: fetchError } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setCoupons(data || []);
    setLoading(false);
  };

  useEffect(() => { loadCoupons(); }, []);

  const createCoupon = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const { error: insertError } = await supabase.from('coupons').insert({
      code: form.code.trim().toUpperCase(),
      recipient_name: form.recipientName.trim(),
      discount_percent: form.discountPercent,
      expires_at: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).toISOString() : null,
      usage_limit: form.usageLimit ? Number(form.usageLimit) : null,
    });
    if (insertError) setError(insertError.message);
    else {
      setForm({ code: '', recipientName: '', discountPercent: 10, expiresAt: '', usageLimit: '' });
      await loadCoupons();
    }
    setSaving(false);
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm('Delete this coupon?')) return;
    const { error: deleteError } = await supabase.from('coupons').delete().eq('id', id);
    if (deleteError) setError(deleteError.message);
    else setCoupons((current) => current.filter((coupon) => coupon.id !== id));
  };

  const toggleCoupon = async (coupon: Coupon) => {
    const { error: updateError } = await supabase.from('coupons').update({ active: !coupon.active }).eq('id', coupon.id);
    if (updateError) setError(updateError.message);
    else setCoupons((current) => current.map((item) => item.id === coupon.id ? { ...item, active: !item.active } : item));
  };

  return (
    <AdminLayout activePage="coupons">
      <main className="p-6 lg:p-10 max-w-6xl">
        <header className="mb-10">
          <p className="text-xs uppercase tracking-[0.3em] text-rose mb-2">Studio offers</p>
          <h1 className="heading-serif text-5xl text-ink">Coupons</h1>
          <p className="text-sm text-ink-light mt-2">Create transparent, recipient-specific discounts for checkout.</p>
        </header>

        <form onSubmit={createCoupon} className="glass-panel p-6 lg:p-8 border border-silk shadow-soft space-y-6 mb-10">
          <h2 className="heading-serif text-2xl text-ink flex items-center gap-2"><Ticket size={22} className="text-rose" /> Create coupon</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Code" className="input-field" />
            <input required value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} placeholder="Person name" className="input-field" />
            <input required type="number" min="1" max="100" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value) })} placeholder="Discount %" className="input-field" />
            <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className="input-field" aria-label="Expiry date" />
            <input type="number" min="1" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} placeholder="Usage limit" className="input-field" />
          </div>
          {error && <p className="text-sm text-rose">{error}</p>}
          <button disabled={saving} className="btn-primary px-6 py-3 flex items-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create coupon
          </button>
        </form>

        <section className="glass-panel border border-silk shadow-soft overflow-hidden">
          {loading ? <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-rose" /></div> : (
            <div className="divide-y divide-silk">
              {coupons.map((coupon) => (
                <div key={coupon.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-ink">{coupon.code} <span className="text-rose">{coupon.discount_percent}% off</span></p>
                    <p className="text-xs text-ink-light mt-1">For {coupon.recipient_name} · Used {coupon.usage_count}{coupon.usage_limit ? ` of ${coupon.usage_limit}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleCoupon(coupon)} className={`text-xs px-3 py-1 rounded-full border ${coupon.active ? 'text-sage-dark border-sage' : 'text-ink-light border-silk'}`}>
                      {coupon.active ? 'Active' : 'Inactive'}
                    </button>
                    <button onClick={() => deleteCoupon(coupon.id)} className="p-2 text-ink-light hover:text-rose" aria-label={`Delete ${coupon.code}`}><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
              {coupons.length === 0 && <p className="p-10 text-sm text-ink-light text-center">No coupons created yet.</p>}
            </div>
          )}
        </section>
      </main>
    </AdminLayout>
  );
}
