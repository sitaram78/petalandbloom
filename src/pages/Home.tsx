import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Star, Heart, Clock, Palette, Truck, Gift, Sparkles, Users, Flower2 } from 'lucide-react';
import Reveal from '@/components/Reveal';
import SectionHeading from '@/components/SectionHeading';
import ProductCard from '@/components/ProductCard';
import WhatsAppButton from '@/components/WhatsAppButton';
import SEO from '@/components/SEO';
import AtelierButton from '@/components/AtelierButton';
import StitchDivider from '@/components/StitchDivider';
import { formatPrice } from '@/data/products';
import { useSiteAssets, getDynamicAsset } from '@/context/SiteAssetsContext';
import {
  trustStrip, addOns, giftingOccasions,
  brandInfo, budgetFilters, howItWorksSteps,
} from '@/data/site';
import { SITE_ASSET_KEYS } from '@/utils/siteAssetKeys';
import { customOrderMessage } from '@/utils/whatsapp';
import { trackEvent } from '@/utils/analytics';
import { useProducts } from '@/context/ProductContext';
import { useCart } from '@/context/CartContext';
import { useStoreSettings } from '@/context/StoreSettingsContext';
import OccasionMarquee from '@/components/OccasionMarquee';

const trustIcons: Record<string, any> = {
  Heart, Clock, Palette, Truck, Gift,
};

const occasionIcons: Record<string, any> = {
  Gift, Heart, Users, Sparkles, Flower2,
};

// Mapping for organic occasion blobs
const OCCASION_BLOBS = [
  {
    name: 'Anniversaries',
    count: '18 pieces',
    slug: 'Anniversary',
    key: SITE_ASSET_KEYS.HOME_OCCASION_ANNIVERSARY,
    color: 'bg-rose-400'
  },
  {
    name: 'Just because',
    count: '24 pieces',
    slug: 'Just Because',
    key: SITE_ASSET_KEYS.HOME_OCCASION_JUST_BECAUSE,
    color: 'bg-sage-400'
  },
  {
    name: 'Friendship',
    count: '12 pieces',
    slug: 'Friendship',
    key: SITE_ASSET_KEYS.HOME_OCCASION_FRIENDSHIP,
    color: 'bg-pink-400'
  },
  {
    name: "Mother's Day",
    count: '15 pieces',
    slug: "Mother's Day",
    key: SITE_ASSET_KEYS.HOME_OCCASION_MOTHERS_DAY,
    color: 'bg-rose-200'
  },
  {
    name: "Valentine's Day",
    count: '20 pieces',
    slug: "Valentine's Day",
    key: SITE_ASSET_KEYS.HOME_OCCASION_VALENTINES_DAY,
    color: 'bg-rose-500'
  },
];

export default function Home() {
  const { products, getBestsellers, getFeatured, loading: productLoading } = useProducts();
  const { assets, loading: assetsLoading } = useSiteAssets();
  const { addItem } = useCart();
  const { settings } = useStoreSettings();
  const [seasonCategory, setSeasonCategory] = useState<string>('All');
  const [featuredImageIndex, setFeaturedImageIndex] = useState(0);
  const [featuredSelectedColor, setFeaturedSelectedColor] = useState('');
  const bestsellers = getBestsellers();
  const featuredProduct = getFeatured()[0];

  const seasonProducts = (() => {
    if (!products) return [];
    let filtered = [...products];
    if (seasonCategory === 'Bouquets') filtered = filtered.filter(p => p.category === 'bouquets');
    else if (seasonCategory === 'Single stems') filtered = filtered.filter(p => p.category === 'flowers');
    else if (seasonCategory === 'Customisable only') filtered = filtered.filter(p => p.customisable);
    return filtered.slice(0, 3);
  })();

  useEffect(() => {
    trackEvent('homepage_view');
  }, []);

  if (productLoading || assetsLoading) {
    return (
      <div className="min-h-screen bg-linen flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-canvas" />
          <p className="font-serif text-bark text-lg">Preparing the Studio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden bg-linen">
      <SEO
        title="Handmade Crochet Flowers, Bouquets & Gifts"
        description="Handmade crochet flowers, bouquets, and gifts made in India. Custom colours, made to order, pan-India delivery. Flowers that never fade."
        canonicalPath="/"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'Store',
          name: 'The Petal & Bloom',
          description: 'Handmade crochet flowers, bouquets, and gifts made in India.',
          url: 'https://petal-bloom-d2c-webs-k5dq.bolt.host',
        }}
      />
      
      
      {/* 01. THE THESIS: Hero Section (KEEP EXACT) */}
      <section className="relative min-h-screen flex items-center justify-center bg-linen">
        <div className="absolute inset-0">
          <img
            src={getDynamicAsset(assets, 'home_hero_primary')}
            alt="Handmade crochet bouquet"
            className="w-full h-full object-cover animate-gentle-zoom"
          />
          <div className="absolute inset-0 bg-bark/10 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-b from-linen/30 via-transparent to-linen" />
        </div>

        <div className="container-lux relative z-10 text-center translate-y-12 lg:translate-y-24">
          <Reveal>
            <p className="font-serif italic text-sm text-rose mb-8 tracking-[0.4em] animate-fade-up uppercase">Handmade in India</p>
            <h1 className="font-serif text-6xl sm:text-7xl lg:text-9xl text-bark text-balance animate-fade-up leading-[1.05]" style={{ animationDelay: '0.2s' }}>
              Flowers that<br />never fade.
            </h1>
            <p className="mt-10 text-lg sm:text-2xl text-ink-light leading-relaxed max-w-3xl mx-auto animate-fade-up font-light" style={{ animationDelay: '0.4s' }}>
              Hand-sculpted crochet blooms and thoughtful gifts, created slowly to be given meaningfully.
            </p>
            <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-6 animate-fade-up" style={{ animationDelay: '0.6s' }}>
              <Link to="/shop">
                <AtelierButton variant="primary" className="text-lg px-12 py-5">
                  Explore the Studio <ArrowRight size={20} className="ml-2" />
                </AtelierButton>
              </Link>
              <Link to="/custom-bouquet">
                <AtelierButton variant="ghost" className="text-lg px-12 py-5">
                  Co-create a Bouquet
                </AtelierButton>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Festive Occasion & Seasonal Sale Running Marquee */}
      {settings.occasionBanner?.enabled &&
        (settings.occasionBanner.placement === 'home_only' || settings.occasionBanner.placement === 'both') && (
          <OccasionMarquee settings={settings.occasionBanner} variant="strip" />
      )}

      <div className="container-lux">
        <StitchDivider />
      </div>

      {/* 02. TRUST STRIP */}
      <section className="py-12 bg-canvas/30 border-b border-canvas-line">
        <div className="container-lux">
          <div className="flex flex-wrap items-center justify-center gap-x-16 gap-y-8 opacity-80">
            {trustStrip.map((item, i) => {
              const Icon = trustIcons[item.icon] || Heart;
              return (
                <div key={i} className="flex items-center gap-4 text-ink-light">
                  <Icon size={20} strokeWidth={1.5} className="text-rose" />
                  <span className="text-xs sm:text-sm font-medium tracking-[0.2em] uppercase">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 03. PHILOSOPHY */}
      <section className="py-32 lg:py-48 bg-linen text-center">
        <div className="container-lux">
          <div className="max-w-3xl mx-auto space-y-8">
            <Reveal>
              <span className="font-serif italic text-sm text-rose mb-4 block">Why crochet</span>
              <h2 className="font-serif text-5xl lg:text-7xl text-bark leading-tight mb-8">An heirloom of affection.</h2>
            </Reveal>
            <Reveal delay={100}>
              <div className="space-y-6 text-lg text-ink-light leading-relaxed font-light">
                <p>
                  Fresh flowers are a fleeting beauty — a week, if you're lucky, before the bin. We wanted to make something that could hold the same feeling without the countdown.
                </p>
                <p>
                  Every bloom is built stitch by stitch from cotton yarn, shaped by hand over hours, not minutes — so what you're giving isn't just a flower. It's proof someone sat down and made something, on purpose, for someone else.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 04. OCCASIONS */}
      <section className="py-24 sm:py-32 lg:py-48 bg-canvas">
        <div className="container-lux">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-20">
            <Reveal>
              <span className="font-serif italic text-sm text-rose mb-3 block">Shop by moment</span>
              <h2 className="font-serif text-5xl lg:text-7xl text-bark leading-tight">What's the occasion?</h2>
            </Reveal>
            <Reveal delay={100}>
              <Link to="/shop" className="text-sm text-ink-light font-medium hover:text-rose transition-colors underline underline-offset-4">
                See all occasions
              </Link>
            </Reveal>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-12">
            {OCCASION_BLOBS.slice(0, 3).map((blob, i) => (
              <Reveal key={blob.name} delay={i * 100}>
                <Link
                  to={`/shop?occasion=${blob.slug}`}
                  className="group block"
                >
                  <div
                    className={`aspect-square ${blob.color} rounded-[40%_60%_70%_30%/40%_50%_60%_50%] transition-all duration-500 group-hover:scale-105 shadow-soft overflow-hidden relative`}
                  >
                    <img
                      src={getDynamicAsset(assets, blob.key)}
                      alt={blob.name}
                      className="w-full h-full object-cover mix-blend-multiply opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                    />
                  </div>
                  <div className="mt-8 flex items-baseline justify-between">
                    <h3 className="font-serif text-2xl text-bark">{blob.name}</h3>
                    <span className="text-xs text-ink-light font-light">{blob.count}</span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 05. NEW THIS SEASON (Shop Preview) */}
      <section className="py-32 lg:py-48 bg-linen">
        <div className="container-lux">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
            <Reveal>
              <span className="font-serif italic text-sm text-rose mb-3 block">From the studio</span>
              <h2 className="font-serif text-5xl lg:text-7xl text-bark leading-tight">New this season</h2>
            </Reveal>
            <Reveal delay={100}>
              <Link to="/shop" className="text-sm text-ink-light font-medium hover:text-rose transition-colors underline underline-offset-4">
                View the full shop
              </Link>
            </Reveal>
          </div>

          <div className="flex flex-wrap gap-3 mb-16">
            {['All', 'Bouquets', 'Flowers'].map((filter, i) => (
              <button
                key={filter}
                onClick={() => setSeasonCategory(filter)}
                className={`px-5 py-2 rounded-full text-sm border transition-all ${seasonCategory === filter ? 'bg-bark text-linen border-bark' : 'border-canvas-line text-ink-light hover:border-rose'}`}
              >
                {filter}
              </button>
            ))}
            <button
              onClick={() => setSeasonCategory('Customisable only')}
              className={`px-5 py-2 rounded-full text-sm border transition-all ${seasonCategory === 'Customisable only' ? 'bg-bark text-linen border-bark' : 'border-sage-400 text-sage-700 hover:bg-sage-400/10'}`}
            >
              Customisable only
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
            {seasonProducts.map((product, i) => (
              <Reveal key={product.code} delay={i * 100}>
                <ProductCard product={product} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 06. PRODUCT DETAIL PREVIEW */}
      <section className="py-32 lg:py-48 bg-canvas">
        <div className="container-lux">
          <Reveal className="mb-12">
            <span className="font-serif italic text-sm text-rose">A closer look — product page</span>
          </Reveal>
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-start">
            <Reveal className="lg:col-span-7">
              <div className="relative aspect-square sm:aspect-[4/5] overflow-hidden rounded-atelier-img bg-linen shadow-soft">
                {featuredProduct && (
                  <img
                    src={featuredProduct.images[featuredImageIndex]}
                    alt={featuredProduct.name}
                    className="w-full h-full object-cover transition-opacity duration-500"
                  />
                )}
              </div>
              <div className="flex gap-4 mt-6">
                {featuredProduct?.images.slice(0, 3).map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setFeaturedImageIndex(i)}
                    className={`w-20 h-20 rounded-sm overflow-hidden border-2 transition-all ${featuredImageIndex === i ? 'border-rose scale-105' : 'border-transparent opacity-70 hover:opacity-100'}`}
                  >
                    <img src={img} className="w-full h-full object-cover" alt="" />
                  </button>
                ))}
              </div>
            </Reveal>
            <Reveal delay={100} className="lg:col-span-5">
              {featuredProduct ? (
                <div className="bg-linen p-6 sm:p-10 rounded-[2px_30px_2px_30px] shadow-soft space-y-8">
                  <div>
                    <span className="text-xs text-ink-light font-light">{featuredProduct.code}</span>
                    <h2 className="font-serif text-3xl sm:text-4xl text-bark mt-2">{featuredProduct.name}</h2>
                    <p className="font-serif text-2xl text-rose mt-4">{formatPrice(featuredProduct.price)}</p>
                    <p className="text-ink-light mt-6 leading-relaxed font-light">
                      {featuredProduct.description}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <p className="text-xs uppercase tracking-wider text-ink font-medium">Colour</p>
                    <div className="flex flex-wrap gap-3">
                      {featuredProduct.colors?.map((color) => (
                        <button
                          key={color}
                          onClick={() => setFeaturedSelectedColor(color)}
                          className={`px-4 py-2 rounded-full text-sm border transition-all ${featuredSelectedColor === color ? 'bg-bark text-linen border-bark' : 'border-canvas-line text-ink-light hover:border-rose'}`}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <AtelierButton
                      variant="primary"
                      className="w-full justify-center py-4"
                      onClick={() => addItem(featuredProduct, { color: featuredSelectedColor || undefined, quantity: 1 })}
                    >
                      Add to bag
                    </AtelierButton>
                    <AtelierButton
                      variant="ghost"
                      className="w-full justify-center py-4"
                      onClick={() => window.open(`https://wa.me/${brandInfo.whatsappNumber}?text=${encodeURIComponent(customOrderMessage())}`, '_blank')}
                    >
                      Add a handwritten note
                    </AtelierButton>
                  </div>
                </div>
              ) : (
                <div className="bg-linen p-6 sm:p-10 rounded-[2px_30px_2px_30px] shadow-soft">
                  <h2 className="font-serif text-3xl sm:text-4xl text-bark">A new studio choice is coming soon.</h2>
                  <p className="text-ink-light mt-6 leading-relaxed font-light">
                    We are preparing the next featured piece by hand. Explore the full collection while it is being finished.
                  </p>
                  <Link to="/shop" className="inline-block mt-8 text-sm text-ink-light font-medium underline underline-offset-4 hover:text-rose transition-colors">
                    Explore the full shop
                  </Link>
                </div>
              )}
            </Reveal>
          </div>
        </div>
      </section>

      {/* 07. PROCESS: Stitch by Stitch */}
      <section className="py-32 lg:py-48 bg-bark text-linen">
        <div className="container-lux">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <Reveal>
              <span className="font-serif italic text-sm text-rose mb-4 block uppercase tracking-widest">The craft</span>
              <h2 className="font-serif text-5xl lg:text-7xl text-linen leading-tight">Stitch by stitch.</h2>
            </Reveal>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-12">
            {[
              { num: '01', title: 'Yarn is chosen', desc: 'Cotton, dyed to hold colour through years, not seasons.' },
              { num: '02', title: 'Petals are looped', desc: 'Each petal is a single continuous stitch, shaped by hand.' },
              { num: '03', title: 'Blooms are built', desc: 'Petals are layered and wired into full, dimensional flowers.' },
              { num: '04', title: 'Arranged & wrapped', desc: 'Composed by eye, then wrapped in linen and twine.' },
              { num: '05', title: 'Sent your way', desc: 'Boxed flat-safe and shipped within 6 working days.' },
            ].map((step, i) => (
              <Reveal key={step.num} delay={i * 100}>
                <div className="space-y-4">
                  <span className="font-serif italic text-4xl text-rose">{step.num}</span>
                  <h4 className="font-serif text-xl text-linen">{step.title}</h4>
                  <p className="text-sm text-linen/60 leading-relaxed">{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="container-lux">
        <StitchDivider variant="dark" />
      </div>

      {/* 08. CLOSING CTA */}
      <section className="py-32 lg:py-48 bg-linen relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(225,214,188,0.3)_0%,transparent_70%)]" />
        <div className="container-lux relative z-10 text-center">
          <Reveal>
            <span className="font-serif italic text-sm text-rose mb-4 block">Still deciding?</span>
            <h2 className="font-serif text-6xl lg:text-8xl text-bark mb-12 leading-tight">
              Ready to give a gift<br />that stays?
            </h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
              <Link to="/shop">
                <AtelierButton variant="primary" className="text-lg px-16 py-6">
                  Shop the Collections <ArrowRight size={22} className="ml-2" />
                </AtelierButton>
              </Link>
              <Link to="/custom-bouquet">
                <AtelierButton variant="ghost" className="text-lg px-16 py-6">
                  Design a Custom Piece
                </AtelierButton>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
