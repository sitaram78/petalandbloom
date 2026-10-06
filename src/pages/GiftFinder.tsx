import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Gift, Heart, Users, Sparkles, PartyPopper, Check } from 'lucide-react';
import Reveal from '@/components/Reveal';
import ProductCard from '@/components/ProductCard';
import WhatsAppButton from '@/components/WhatsAppButton';
import AtelierButton from '@/components/AtelierButton';
import { useProducts } from '@/context/ProductContext';
import { formatPrice } from '@/data/products';
import { useSiteAssets, getDynamicAsset } from '@/context/SiteAssetsContext';
import { SITE_ASSET_KEYS } from '@/utils/siteAssetKeys';
import { giftFinderMessage } from '@/utils/whatsapp';
import { trackEvent } from '@/utils/analytics';
import SEO from '@/components/SEO';
import { fetchOccasions, DEFAULT_OCCASIONS } from '@/services/occasionService';

const recipients = ['Partner', 'Friend', 'Mother', 'Sibling', 'Other'];
const budgets = [
  { label: 'Under ₹300', min: 0, max: 299 },
  { label: '₹300 – ₹500', min: 300, max: 500 },
  { label: '₹500 – ₹1,000', min: 500, max: 1000 },
  { label: '₹1,000 – ₹1,500', min: 1000, max: 1500 },
  { label: '₹1,500+', min: 1500, max: 99999 },
];

export default function GiftFinder() {
  const { products, loading: productLoading } = useProducts();
  const { assets, loading: assetsLoading } = useSiteAssets();
  const [step, setStep] = useState(0);
  const [occasion, setOccasion] = useState('');
  const [recipient, setRecipient] = useState('');
  const [budget, setBudget] = useState('');

  // Dynamic Storefront Occasions
  const [activeOccasions, setActiveOccasions] = useState<Array<{ name: string; emoji?: string }>>([]);
  const [occasionsLoaded, setOccasionsLoaded] = useState<boolean>(false);

  useEffect(() => {
    async function loadOccasions() {
      try {
        const data = await fetchOccasions({ activeOnly: true });
        setActiveOccasions((data || []).map((o) => ({ name: o.name, emoji: o.emoji })));
      } catch (e) {
        console.warn('Could not load dynamic occasions for gift finder:', e);
      } finally {
        setOccasionsLoaded(true);
      }
    }
    loadOccasions();
  }, []);

  const occasionOptions = occasionsLoaded
    ? activeOccasions.map((o) => o.name)
    : DEFAULT_OCCASIONS.map((o) => o.name);

  const recommendations = useMemo(() => {
    if (!occasion || !recipient || !budget) return [];
    const budgetObj = budgets.find((b) => b.label === budget);
    if (!budgetObj) return [];

    return products
      .map((p) => {
        let score = 0;

        // 1. Budget Score (Highest Priority)
        const inBudget = p.price >= budgetObj.min && p.price <= budgetObj.max;
        if (inBudget) score += 10;

        // 2. Occasion Score (matches slug or name case-insensitively)
        const matchesOccasion = p.occasions?.some((o) => {
          const cleanO = o.toLowerCase().trim();
          const cleanOcc = occasion.toLowerCase().trim();
          return cleanO === cleanOcc || cleanO.includes(cleanOcc) || cleanOcc.includes(cleanO);
        });
        if (matchesOccasion) score += 5;

        // 3. Recipient Score
        const matchesRecipient = p.recipients?.some((r) =>
          r.toLowerCase().includes(recipient.toLowerCase()) ||
          recipient.toLowerCase().includes(r.toLowerCase())
        );
        if (matchesRecipient) score += 5;

        // 4. Bestseller Bonus
        if (p.bestseller) score += 2;

        return { product: p, score };
      })
      .filter((item) => item.score > 0) // Only suggest items that match at least one criteria
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((item) => item.product);
  }, [products, occasion, recipient, budget]);

  const isComplete = step === 3;

  const handleComplete = () => {
    setStep(3);
    trackEvent('gift_finder_completed', { occasion, recipient, budget });
  };

  const reset = () => {
    setStep(0);
    setOccasion('');
    setRecipient('');
    setBudget('');
  };

  const steps = ['Occasion', 'Recipient', 'Budget', 'Results'];
  const canProceed = step === 0 ? !!occasion : step === 1 ? !!recipient : step === 2 ? !!budget : true;

  if (productLoading || assetsLoading) {
    return (
      <div className="min-h-screen bg-linen flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-canvas" />
          <p className="font-serif text-bark text-lg">Finding the perfect gift...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-linen min-h-screen">
      <SEO
        title="Gift Finder — The Petal & Bloom"
        description="Not sure what to choose? Our interactive Gift Finder helps you find the perfect handmade bloom based on occasion, recipient, and budget."
        canonicalPath="/gift-finder"
      />

      {/* Atelier Gift Finder Header */}
      <section className="pt-16 pb-12 lg:pt-24 lg:pb-20">
        <div className="container-lux grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
          <div className="lg:col-span-7">
            <span className="font-serif italic text-sm text-rose mb-3 block uppercase tracking-widest">Studio Assistant</span>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-7xl text-bark leading-tight mb-6">
              Help me choose <br />the perfect gift.
            </h1>
            <p className="text-ink-light text-base sm:text-lg max-w-2xl leading-relaxed">
              Not sure where to start? Answer three quick questions and we'll suggest the perfect bloom from our atelier.
            </p>
          </div>
          <div className="lg:col-span-5">
            <div className="aspect-[16/9] rounded-atelier-img overflow-hidden shadow-soft">
              <img
                src={getDynamicAsset(assets, SITE_ASSET_KEYS.GIFT_FINDER_HERO)}
                alt="Gift Finder Experience"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-24 bg-linen">
        <div className="container-lux max-w-2xl">
          {/* Progress indicator */}
          {step < 3 && (
            <div className="flex items-center justify-center gap-2 mb-16">
              {steps.slice(0, 3).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                      i < step
                        ? 'bg-rose text-linen'
                        : i === step
                        ? 'bg-bark text-linen'
                        : 'bg-canvas text-ink-light'
                    }`}
                    aria-current={i === step ? 'step' : undefined}
                  >
                    {i < step ? <Check size={14} strokeWidth={2.5} /> : i + 1}
                  </div>
                  {i < 2 && <div className={`w-12 h-px ${i < step ? 'bg-rose' : 'bg-canvas-line'}`} />}
                </div>
              ))}
            </div>
          )}

          {/* Step 0: Occasion */}
          {step === 0 && (
            <Reveal>
              <p className="font-serif italic text-sm text-rose text-center mb-3 uppercase tracking-widest">Step 1 of 3</p>
              <h2 className="font-serif text-3xl text-center text-bark mb-12">What's the occasion?</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {occasionOptions.map((occ) => (
                  <button
                    key={occ}
                    onClick={() => setOccasion(occ)}
                    className={`p-5 rounded-atelier-btn border text-center transition-all duration-300 ${
                      occasion === occ
                        ? 'bg-bark text-linen border-bark'
                        : 'bg-canvas text-ink-light border-canvas-line hover:border-rose'
                    }`}
                  >
                    <span className="font-serif text-lg">{occ}</span>
                  </button>
                ))}
              </div>
            </Reveal>
          )}

          {/* Step 1: Recipient */}
          {step === 1 && (
            <Reveal>
              <p className="font-serif italic text-sm text-rose text-center mb-3 uppercase tracking-widest">Step 2 of 3</p>
              <h2 className="font-serif text-3xl text-center text-bark mb-12">Who is it for?</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {recipients.map((rec) => (
                  <button
                    key={rec}
                    onClick={() => setRecipient(rec)}
                    className={`p-5 rounded-atelier-btn border text-center transition-all duration-300 ${
                      recipient === rec
                        ? 'bg-bark text-linen border-bark'
                        : 'bg-canvas text-ink-light border-canvas-line hover:border-rose'
                    }`}
                  >
                    <span className="font-serif text-lg">{rec}</span>
                  </button>
                ))}
              </div>
            </Reveal>
          )}

          {/* Step 2: Budget */}
          {step === 2 && (
            <Reveal>
              <p className="font-serif italic text-sm text-rose text-center mb-3 uppercase tracking-widest">Step 3 of 3</p>
              <h2 className="font-serif text-3xl text-center text-bark mb-12">What's your budget?</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {budgets.map((b) => (
                  <button
                    key={b.label}
                    onClick={() => setBudget(b.label)}
                    className={`p-5 rounded-atelier-btn border text-center transition-all duration-300 ${
                      budget === b.label
                        ? 'bg-bark text-linen border-bark'
                        : 'bg-canvas text-ink-light border-canvas-line hover:border-rose'
                    }`}
                  >
                    <span className="font-serif text-lg">{b.label}</span>
                  </button>
                ))}
              </div>
            </Reveal>
          )}

          {/* Navigation buttons */}
          {step < 3 && (
            <div className="flex justify-between mt-16">
              <AtelierButton
                variant="ghost"
                onClick={() => step > 0 && setStep(step - 1)}
                disabled={step === 0}
                className={step === 0 ? 'opacity-0 pointer-events-none' : ''}
              >
                <ArrowLeft size={16} className="mr-2" /> Back
              </AtelierButton>
              {step < 2 ? (
                <AtelierButton
                  variant="primary"
                  onClick={() => canProceed && setStep(step + 1)}
                  disabled={!canProceed}
                  className={!canProceed ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  Next <ArrowRight size={16} className="ml-2" />
                </AtelierButton>
              ) : (
                <AtelierButton
                  variant="primary"
                  onClick={() => canProceed && handleComplete()}
                  disabled={!canProceed}
                  className={!canProceed ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  See recommendations <ArrowRight size={16} className="ml-2" />
                </AtelierButton>
              )}
            </div>
          )}

          {/* Results */}
          {isComplete && (
            <Reveal role="status" aria-live="polite">
              <div className="text-center mb-12">
                <div className="w-16 h-16 rounded-full bg-moss/20 flex items-center justify-center mx-auto mb-6 text-moss">
                  <PartyPopper size={28} strokeWidth={1.5} />
                </div>
                <h2 className="font-serif text-3xl text-bark mb-2">Here's what we found</h2>
                <p className="text-sm text-ink-light">
                  For a {occasion.toLowerCase()} gift for your {recipient.toLowerCase()}, {budget.toLowerCase()}
                </p>
              </div>


              {recommendations.length > 0 ? (
                <div className="grid grid-cols-2 gap-5">
                  {recommendations.map((p) => (
                    <ProductCard key={p.code} product={p} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-canvas rounded-atelier-panel">
                  <p className="font-serif text-xl text-bark mb-2">No blooms found in that range.</p>
                  <p className="text-sm text-ink-light mb-8">We couldn't find a perfect match for those filters.</p>
                </div>
              )}

              <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
                <AtelierButton variant="ghost" onClick={reset}>
                  Start over
                </AtelierButton>
                <WhatsAppButton
                  message={giftFinderMessage({ occasion, recipient, budget })}
                  label="Need help choosing? Ask on WhatsApp"
                  className="flex-1"
                />
              </div>
            </Reveal>
          )}
        </div>
      </section>
    </div>
  );
}
