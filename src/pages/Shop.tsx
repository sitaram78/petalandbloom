import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X, Search, ChevronDown, LayoutGrid, List, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import ProductGrid from '@/components/ProductGrid';
import ProductList from '@/components/ProductList';
import ProductSkeleton from '@/components/ProductSkeleton';
import Reveal from '@/components/Reveal';
import WhatsAppButton from '@/components/WhatsAppButton';
import SEO from '@/components/SEO';
import SectionHeading from '@/components/SectionHeading';
import AtelierButton from '@/components/AtelierButton';
import AtelierChip from '@/components/AtelierChip';
import { type ProductCategory, formatPrice } from '@/data/products';
import { occasions, budgetFilters, giftingOccasions } from '@/data/site';
import { buildWhatsAppLink, generalEnquiryMessage } from '@/utils/whatsapp';
import { trackEvent } from '@/utils/analytics';
import { useSiteAssets, getDynamicAsset } from '@/context/SiteAssetsContext';
import { useProducts } from '@/context/ProductContext';
import { filterProducts } from '@/utils/productSearch';
import { SITE_ASSET_KEYS } from '@/utils/siteAssetKeys';

const sortOptions = [
  { label: 'Recommended', value: 'featured' },
  { label: 'Newest', value: 'newest' },
  { label: 'Price: Low to High', value: 'price-asc' },
  { label: 'Price: High to Low', value: 'price-desc' },
];

const BLOB_SHAPES = [
  '60% 40% 30% 70% / 60% 30% 70% 40%',
  '30% 60% 70% 40% / 50% 60% 30% 60%',
  '70% 30% 40% 60% / 40% 50% 60% 50%',
  '40% 60% 60% 40% / 70% 30% 70% 30%',
  '50% 50% 30% 70% / 50% 40% 60% 50%',
  '60% 30% 70% 40% / 30% 70% 40% 60%',
  '40% 70% 60% 30% / 60% 40% 50% 50%',
];

export default function ShopPage() {
  const { products, loading: productLoading } = useProducts();
  const { assets, loading: assetsLoading } = useSiteAssets();
  const [searchParams, setSearchParams] = useSearchParams();
  const occasionFilter = searchParams.get('occasion') || '';
  const budgetFilter = searchParams.get('budget') || '';
  const searchQuery = searchParams.get('search') || '';
  const category = searchParams.get('category') || 'all';

  const [categories, setCategories] = useState<{ label: string; value: string; image_url?: string }[]>([]);
  const [sort, setSort] = useState('featured');
  const [customOnly, setCustomOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(false);

  const handleCategoryChange = (val: ProductCategory | 'all') => {
    const params = new URLSearchParams(searchParams);
    if (val === 'all') {
      params.delete('category');
    } else {
      params.set('category', val);
    }
    setSearchParams(params);
  };

  useEffect(() => {
    async function fetchCategories() {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('name, slug, image_url')
          .order('display_order', { ascending: true });

        if (!error && data && data.length > 0) {
          const mapped = data.map(c => ({
            label: c.name,
            value: c.slug,
            image_url: c.image_url
          }));
          setCategories(mapped);
        } else {
          setCategories([]);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
        setCategories([]);
      }
    }
    fetchCategories();
  }, []);

  useEffect(() => {
    if (occasionFilter || budgetFilter || searchQuery) {
      const params = new URLSearchParams(searchParams);
      params.delete('category');
      setSearchParams(params);
    }
    if (searchQuery) {
      trackEvent('search', { query: searchQuery });
    }
    if (occasionFilter || budgetFilter) {
      trackEvent('filter_use', { occasion: occasionFilter, budget: budgetFilter });
    }
  }, [occasionFilter, budgetFilter, searchQuery]);

  const activeBudget = budgetFilters.find((b) => b.param === budgetFilter);

  const filtered = useMemo(() => {
    if (!products) return [];

    let result = filterProducts(products, {
      query: searchQuery,
      category,
      occasion: occasionFilter,
      customOnly,
      validCategories: categories.map(c => c.value),
    });

    if (activeBudget) {
      result = result.filter((p) => p?.price >= activeBudget.min && p?.price <= activeBudget.max);
    }

    if (sort === 'price-asc') {
      result = [...result].sort((a, b) => Number(a?.price || 0) - Number(b?.price || 0));
    } else if (sort === 'price-desc') {
      result = [...result].sort((a, b) => Number(b?.price || 0) - Number(a?.price || 0));
    } else if (sort === 'newest') {
      result = [...result].sort((a, b) => (b?.isNew ? 1 : 0) - (a?.isNew ? 1 : 0));
    } else {
      result = [...result].sort((a, b) => (b?.featured ? 1 : 0) - (a?.featured ? 1 : 0));
    }

    return result;
  }, [products, category, occasionFilter, activeBudget, customOnly, searchQuery, sort, categories]);

  const occasionName = occasions.find((o) => o.filter === occasionFilter)?.name;
  const hasActiveFilter = occasionFilter || budgetFilter || searchQuery || customOnly || category !== 'all';

  const clearAllFilters = () => {
    setSearchParams({});
    setCustomOnly(false);
    setSort('featured');
  };

  const hasNoResults = filtered && filtered.length === 0 && searchQuery;

  const activeCategoryData = categories.find(c => c.value === category);

  const getOccasionAssetKey = (filter: string) => {
    const occasion = occasions.find(o => o.filter === filter);
    if (!occasion) return null;

    const mapping: Record<string, string> = {
      'Birthday': SITE_ASSET_KEYS.HOME_OCCASION_BIRTHDAY,
      'Anniversary': SITE_ASSET_KEYS.HOME_OCCASION_ANNIVERSARY,
      'Friendship': SITE_ASSET_KEYS.HOME_OCCASION_FRIENDSHIP,
      'Just Because': SITE_ASSET_KEYS.HOME_OCCASION_JUST_BECAUSE,
      "Mother's Day": SITE_ASSET_KEYS.HOME_OCCASION_MOTHERS_DAY,
      "Valentine's Day": SITE_ASSET_KEYS.HOME_OCCASION_VALENTINES_DAY,
      'Festivals': SITE_ASSET_KEYS.HOME_OCCASION_FESTIVALS,
    };

    return mapping[occasion.filter] || null;
  };

  const heroImage = useMemo(() => {
    if (occasionFilter) {
      const occasionKey = getOccasionAssetKey(occasionFilter);
      if (occasionKey) return getDynamicAsset(assets, occasionKey);
    }

    if (category !== 'all' && activeCategoryData) {
      return getDynamicAsset(assets, `cat_${activeCategoryData.value}_hero`);
    }

    return getDynamicAsset(assets, SITE_ASSET_KEYS.SHOP_HERO_DEFAULT);
  }, [assets, occasionFilter, category, activeCategoryData]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (category !== 'all') count++;
    if (occasionFilter) count++;
    if (budgetFilter) count++;
    if (customOnly) count++;
    return count;
  }, [category, occasionFilter, budgetFilter, customOnly]);

  if (productLoading || assetsLoading) {
    return (
      <div className="bg-linen min-h-screen">
        <div className="container-lux py-24 text-center">
          <h2 className="font-serif text-3xl text-bark mb-8">Loading Collection...</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-linen min-h-screen">
      <SEO
        title="Shop All Handmade Crochet Blooms & Gifts"
        description="Browse our full collection of handmade crochet flowers, bouquets, keyrings, bags, and gift boxes."
        canonicalPath="/shop"
      />

      <section className="pt-16 pb-12 lg:pt-24 lg:pb-20">
        <div className="container-lux grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
          <div className="lg:col-span-7">
            <span className="font-serif italic text-sm text-rose mb-3 block uppercase tracking-widest">
              {hasNoResults ? 'Search' : occasionName ? `${occasionName} collection` : category !== 'all' ? `${activeCategoryData?.label || category} collection` : 'Shop all'}
            </span>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-7xl text-bark leading-tight mb-6">
              {hasNoResults
                ? "No blooms found"
                : occasionName
                ? `Curated for ${occasionName}`
                : searchQuery
                ? `Search: "${searchQuery}"`
                : category !== 'all'
                ? `${activeCategoryData?.label || category} Collection`
                : 'Every bloom, one studio table.'
              }
            </h1>
            <p className="text-ink-light text-base sm:text-lg max-w-2xl leading-relaxed">
              {hasNoResults
                ? `We couldn't find any pieces matching "${searchQuery}". Try a different keyword or explore our full studio.`
                : occasionName
                ? `Handmade crochet blooms and gifts specifically curated for ${occasionName.toLowerCase()}.`
                : category !== 'all'
                ? `Explore our curated selection of ${activeCategoryData?.label || category}s, handcrafted stitch by stitch.`
                : 'Sixty-two pieces, each stitched to order — from single stems to full bouquets, gift boxes, and pieces you can shape yourself.'
              }
            </p>
          </div>
          <div className="lg:col-span-5">
            <div className="aspect-[16/9] rounded-atelier-img overflow-hidden shadow-soft">
              <img
                src={heroImage}
                alt="Studio Gallery"
                loading="lazy"
                className="w-full h-full object-cover transition-opacity duration-500"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Category Rail */}
      <section className="pb-12">
        <div className="container-lux">
          <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
            <button
              onClick={() => handleCategoryChange('all')}
              className="flex-shrink-0 flex flex-col items-center gap-3 group w-24"
            >
              <div className={`w-20 h-20 transition-all duration-300 overflow-hidden ${category === 'all' ? 'scale-110 ring-2 ring-rose' : 'group-hover:scale-105'} relative shadow-sm`}
                   style={{
                     borderRadius: BLOB_SHAPES[0],
                     background: '#4A4238'
                   }}>
                <div className="w-full h-full flex items-center justify-center text-white font-serif italic text-sm">All</div>
              </div>
              <span className={`text-xs font-medium transition-colors ${category === 'all' ? 'text-rose-deep' : 'text-ink-light'}`}>All</span>
            </button>

            {categories.map((cat, idx) => {
              const catImage = getDynamicAsset(assets, `cat_${cat.value}_hero`);
              return (
                <button
                  key={cat.value}
                  onClick={() => handleCategoryChange(cat.value as ProductCategory)}
                  className="flex-shrink-0 flex flex-col items-center gap-3 group w-24"
                >
                  <div className={`w-20 h-20 transition-all duration-300 overflow-hidden ${category === cat.value ? 'scale-110 ring-2 ring-rose' : 'group-hover:scale-105'} relative shadow-sm`}
                       style={{
                         borderRadius: BLOB_SHAPES[(idx + 1) % BLOB_SHAPES.length],
                         background: catImage ? 'none' : '#CBB89A'
                       }}>
                    {catImage ? (
                      <img src={catImage} alt={cat.label} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-serif italic text-sm">
                        {cat.label[0]}
                      </div>
                    )}
                  </div>
                  <span className={`text-xs font-medium transition-colors ${category === cat.value ? 'text-rose-deep' : 'text-ink-light'}`}>
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Toolbar */}
      <div className="sticky top-16 z-30 bg-linen/90 backdrop-blur-md border-y border-canvas-line py-4">
        <div className="container-lux flex flex-col gap-6">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">

            {/* Desktop Categories - Hidden on Mobile */}
            <div className="hidden sm:flex flex-wrap justify-center lg:justify-start gap-3">
              <AtelierChip
                active={category === 'all'}
                onClick={() => handleCategoryChange('all')}
              >
                All Categories
              </AtelierChip>
              {categories.map((cat) => (
                <AtelierChip
                  key={cat.value}
                  active={category === cat.value}
                  onClick={() => handleCategoryChange(cat.value as ProductCategory)}
                >
                  {cat.label}
                </AtelierChip>
              ))}
            </div>

            {/* Mobile Toolbar Header */}
            <div className="flex sm:hidden items-center justify-between w-full gap-4">
              <button
                onClick={() => setIsToolbarExpanded(!isToolbarExpanded)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all text-xs font-medium ${
                  hasActiveFilter ? 'bg-rose text-white border-rose' : 'bg-white border-silk text-ink-light hover:border-rose'
                }`}
              >
                <Filter size={14} />
                {isToolbarExpanded ? 'Close Filters' : `Filters ${activeFilterCount > 0 && `(${activeFilterCount})`}`}
              </button>

              <div className="flex items-center gap-2 text-sm text-ink-light">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="bg-transparent border-none focus:ring-0 cursor-pointer hover:text-bark transition-colors p-0 m-0 text-xs"
                >
                  {sortOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
            </div>

            {/* Desktop Controls */}
            <div className="hidden sm:flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              <AtelierChip
                variant="toggle"
                active={customOnly}
                onClick={() => setCustomOnly(!customOnly)}
              >
                Customisable only
              </AtelierChip>
              <div className="flex items-center gap-2 text-sm text-ink-light">
                <span className="font-medium">Sort:</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="bg-transparent border-none focus:ring-0 cursor-pointer hover:text-bark transition-colors p-0 m-0"
                >
                  {sortOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded transition-colors ${viewMode === 'grid' ? 'bg-bark text-linen' : 'border border-canvas-line text-ink-light hover:bg-canvas'}`}
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded transition-colors ${viewMode === 'list' ? 'bg-bark text-linen' : 'border border-canvas-line text-ink-light hover:bg-canvas'}`}
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Expandable Mobile Filters */}
          {isToolbarExpanded && (
            <div className="sm:hidden flex flex-col gap-6 animate-fade-in py-4 border-t border-silk">
              <div className="flex flex-wrap justify-center gap-2">
                <AtelierChip
                  active={category === 'all'}
                  onClick={() => handleCategoryChange('all')}
                >
                  All Categories
                </AtelierChip>
                {categories.map((cat) => (
                  <AtelierChip
                    key={cat.value}
                    active={category === cat.value}
                    onClick={() => handleCategoryChange(cat.value as ProductCategory)}
                  >
                    {cat.label}
                  </AtelierChip>
                ))}
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                {giftingOccasions.map((occ) => (
                  <AtelierChip
                    key={occ}
                    variant="occasion"
                    active={occasionFilter === occ}
                    onClick={() => {
                      const params = new URLSearchParams(searchParams);
                      if (occasionFilter === occ) {
                        params.delete('occasion');
                      } else {
                        params.set('occasion', occ);
                      }
                      setSearchParams(params);
                    }}
                  >
                    {occ}
                  </AtelierChip>
                ))}
              </div>

              <div className="flex justify-center">
                <AtelierChip
                  variant="toggle"
                  active={customOnly}
                  onClick={() => setCustomOnly(!customOnly)}
                >
                  Customisable only
                </AtelierChip>
              </div>
            </div>
          )}

          {/* Occasion scroll - Hidden on mobile */}
          <div className="hidden sm:flex items-center justify-start lg:justify-center gap-3 overflow-x-auto pb-2 scrollbar-hide px-6">
            {giftingOccasions.map((occ) => (
              <AtelierChip
                key={occ}
                variant="occasion"
                active={occasionFilter === occ}
                onClick={() => {
                  const params = new URLSearchParams(searchParams);
                  if (occasionFilter === occ) {
                    params.delete('occasion');
                  } else {
                    params.set('occasion', occ);
                  }
                  setSearchParams(params);
                }}
              >
                {occ}
              </AtelierChip>
            ))}
          </div>

          {/* Mobile ViewMode buttons */}
          <div className="flex sm:hidden justify-center gap-1 py-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition-colors ${viewMode === 'grid' ? 'bg-bark text-linen' : 'border border-canvas-line text-ink-light hover:bg-canvas'}`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition-colors ${viewMode === 'list' ? 'bg-bark text-linen' : 'border border-canvas-line text-ink-light hover:bg-canvas'}`}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="container-lux py-16">
        <div className="flex justify-between items-baseline mb-12">
          <p className="text-sm text-ink-light font-light">
            <strong className="text-bark font-medium">{filtered?.length || 0}</strong> pieces
          </p>
          {hasActiveFilter && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-rose hover:text-rose-deep transition-colors flex items-center gap-1.5 font-medium uppercase tracking-widest"
            >
              <X size={12} /> Clear filters
            </button>
          )}
        </div>

        {filtered && filtered.length > 0 ? (
          viewMode === 'grid' ? (
            <ProductGrid products={filtered} columns={3} />
          ) : (
            <ProductList products={filtered} />
          )
        ) : (
          <Reveal className="text-center py-32 max-w-lg mx-auto">
            <div className="w-20 h-20 rounded-full bg-canvas mx-auto mb-8 flex items-center justify-center">
              <Search size={32} strokeWidth={1} className="text-ink-light" />
            </div>
            <h2 className="font-serif text-3xl text-bark mb-4">No blooms found.</h2>
            <p className="text-sm text-ink-light leading-relaxed mb-12">
              We couldn't find a bloom matching those filters. Try adjusting your selection or explore our full studio.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <AtelierButton variant="ghost" onClick={clearAllFilters}>
                Clear filters
              </AtelierButton>
              <AtelierButton variant="primary" onClick={() => setSearchParams({})}>
                Browse all
              </AtelierButton>
              <WhatsAppButton message={generalEnquiryMessage()} label="Talk to us" variant="outline" className="px-8 py-3" />
            </div>
          </Reveal>
        )}
      </div>
    </div>
  );
}
