import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X, Search, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, List, Filter, Check } from 'lucide-react';
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
import { budgetFilters } from '@/data/site';
import { fetchOccasions, DEFAULT_OCCASIONS, type Occasion } from '@/services/occasionService';
import { buildWhatsAppLink, generalEnquiryMessage } from '@/utils/whatsapp';
import { trackEvent } from '@/utils/analytics';
import { useSiteAssets, getDynamicAsset } from '@/context/SiteAssetsContext';
import { useProducts } from '@/context/ProductContext';
import { filterProducts } from '@/utils/productSearch';
import { SITE_ASSET_KEYS } from '@/utils/siteAssetKeys';
import { useSwipeDownToClose } from '@/hooks/useSwipeDownToClose';

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
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // Swipe Down to Dismiss hook for Mobile Filter Drawer
  const {
    handleTouchStart: handleFilterTouchStart,
    handleTouchMove: handleFilterTouchMove,
    handleTouchEnd: handleFilterTouchEnd,
    triggerCloseWithAnimation: closeFilterDrawer,
    sheetStyle: filterSheetStyle,
    backdropOpacity: filterBackdropOpacity,
    isDragging: isFilterDragging,
  } = useSwipeDownToClose({
    onClose: () => setIsFilterDrawerOpen(false),
    threshold: 75,
  });

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setIsSortDropdownOpen(false);
      }
    };
    if (isSortDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isSortDropdownOpen]);

  // Prevent background scrolling when mobile filter drawer is open
  useEffect(() => {
    if (isFilterDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFilterDrawerOpen]);

  // Handle ESC key to dismiss filter drawer or sort dropdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFilterDrawerOpen) setIsFilterDrawerOpen(false);
        if (isSortDropdownOpen) setIsSortDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFilterDrawerOpen, isSortDropdownOpen]);

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

  // Dynamic Storefront Occasions
  const [dynamicOccasions, setDynamicOccasions] = useState<Occasion[]>([]);
  const [occasionsLoaded, setOccasionsLoaded] = useState<boolean>(false);

  useEffect(() => {
    async function fetchStoreOccasions() {
      try {
        const data = await fetchOccasions({ activeOnly: true });
        setDynamicOccasions(data || []);
      } catch (err) {
        console.warn('Error fetching store occasions:', err);
      } finally {
        setOccasionsLoaded(true);
      }
    }
    fetchStoreOccasions();
  }, []);

  const occasionChips = useMemo(() => {
    const list = occasionsLoaded ? dynamicOccasions : DEFAULT_OCCASIONS;
    return list.map((o) => ({
      label: o.name,
      value: o.slug,
      emoji: o.emoji,
    }));
  }, [dynamicOccasions, occasionsLoaded]);

  // Horizontal Occasion Rail Scroll State
  const occasionScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkOccasionScroll = () => {
    if (!occasionScrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = occasionScrollRef.current;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 6);
  };

  useEffect(() => {
    const timer = setTimeout(checkOccasionScroll, 120);
    const el = occasionScrollRef.current;
    if (!el) return () => clearTimeout(timer);

    el.addEventListener('scroll', checkOccasionScroll, { passive: true });
    window.addEventListener('resize', checkOccasionScroll);

    return () => {
      clearTimeout(timer);
      el.removeEventListener('scroll', checkOccasionScroll);
      window.removeEventListener('resize', checkOccasionScroll);
    };
  }, [occasionChips]);

  const scrollOccasions = (direction: 'left' | 'right') => {
    if (!occasionScrollRef.current) return;
    const scrollAmount = Math.max(260, occasionScrollRef.current.clientWidth * 0.6);
    occasionScrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

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

  const occasionName = useMemo(() => {
    if (!occasionFilter) return null;
    const clean = occasionFilter.toLowerCase().trim();
    const list = dynamicOccasions.length > 0 ? dynamicOccasions : DEFAULT_OCCASIONS;
    const match = list.find(
      (o) => o.slug.toLowerCase() === clean || o.name.toLowerCase() === clean
    );
    return match?.name || occasionFilter;
  }, [occasionFilter, dynamicOccasions]);

  const hasActiveFilter = occasionFilter || budgetFilter || searchQuery || customOnly || category !== 'all';

  const clearAllFilters = () => {
    setSearchParams({});
    setCustomOnly(false);
    setSort('featured');
  };

  const hasNoResults = filtered && filtered.length === 0 && searchQuery;

  const activeCategoryData = categories.find(c => c.value === category);

  const getOccasionAssetKey = (filter: string) => {
    const norm = filter.toLowerCase().trim();
    if (norm.includes('birth')) return SITE_ASSET_KEYS.HOME_OCCASION_BIRTHDAY;
    if (norm.includes('anniv')) return SITE_ASSET_KEYS.HOME_OCCASION_ANNIVERSARY;
    if (norm.includes('friend')) return SITE_ASSET_KEYS.HOME_OCCASION_FRIENDSHIP;
    if (norm.includes('just')) return SITE_ASSET_KEYS.HOME_OCCASION_JUST_BECAUSE;
    if (norm.includes('mother')) return SITE_ASSET_KEYS.HOME_OCCASION_MOTHERS_DAY;
    if (norm.includes('valen')) return SITE_ASSET_KEYS.HOME_OCCASION_VALENTINES_DAY;
    if (norm.includes('diwali') || norm.includes('festiv') || norm.includes('rakhi')) return SITE_ASSET_KEYS.HOME_OCCASION_FESTIVALS;
    return null;
  };

  const heroImage = useMemo(() => {
    if (occasionFilter) {
      const cleanOcc = occasionFilter.toLowerCase().trim();
      const matchedOcc = dynamicOccasions.find(
        (o) => o.slug.toLowerCase() === cleanOcc || o.name.toLowerCase() === cleanOcc
      );

      if (matchedOcc) {
        // 1. Check Studio Visuals asset for this occasion hero banner
        const studioAsset = getDynamicAsset(assets, SITE_ASSET_KEYS.OCCASION_HERO(matchedOcc.slug));
        if (studioAsset) return studioAsset;

        // 2. Check direct occasion database banner_image_url
        if (matchedOcc.banner_image_url) return matchedOcc.banner_image_url;
      }

      // 3. Fallback to legacy home occasion visual if present
      const occasionKey = getOccasionAssetKey(occasionFilter);
      if (occasionKey) {
        const legacyAsset = getDynamicAsset(assets, occasionKey);
        if (legacyAsset) return legacyAsset;
      }
    }

    if (category !== 'all' && activeCategoryData) {
      return getDynamicAsset(assets, `cat_${activeCategoryData.value}_hero`);
    }

    return getDynamicAsset(assets, SITE_ASSET_KEYS.SHOP_HERO_DEFAULT);
  }, [assets, occasionFilter, dynamicOccasions, category, activeCategoryData]);

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
      <div className="sticky top-16 z-30 bg-linen/90 backdrop-blur-md border-y border-canvas-line py-3 sm:py-4">
        <div className="container-lux flex flex-col gap-[0.8rem] sm:gap-6">
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

            {/* Mobile Toolbar Header Row */}
            <div className="flex sm:hidden items-center justify-between w-full gap-2">
              {/* Filter Drawer Trigger Button */}
              <button
                type="button"
                onClick={() => setIsFilterDrawerOpen(true)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border transition-all text-xs font-medium shadow-sm ${
                  hasActiveFilter
                    ? 'bg-rose text-white border-rose font-semibold'
                    : 'bg-white border-silk text-ink-light hover:border-rose hover:text-ink'
                }`}
              >
                <SlidersHorizontal size={13} />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-white text-rose font-bold text-[10px] flex items-center justify-center ml-0.5">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              <div className="flex items-center gap-2">
                {/* Compact Custom Sort Dropdown (Opens downwards) */}
                <div ref={sortDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsSortDropdownOpen((prev) => !prev)}
                    aria-label="Sort products"
                    aria-haspopup="listbox"
                    aria-expanded={isSortDropdownOpen}
                    className="flex items-center gap-1.5 text-xs text-bark bg-white border border-silk rounded-full px-3 py-1.5 shadow-sm font-medium hover:border-rose transition-colors"
                  >
                    <span>{sortOptions.find((opt) => opt.value === sort)?.label || 'Sort'}</span>
                    <ChevronDown
                      size={12}
                      className={`text-ink-light transition-transform duration-200 ${
                        isSortDropdownOpen ? 'rotate-180 text-rose' : ''
                      }`}
                    />
                  </button>

                  {isSortDropdownOpen && (
                    <div
                      role="listbox"
                      aria-label="Sort options"
                      className="absolute top-full right-0 mt-2 w-44 bg-white/95 backdrop-blur-md border border-silk rounded-2xl shadow-xl py-1.5 z-50 animate-fade-in"
                    >
                      {sortOptions.map((opt) => {
                        const isSelected = sort === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              setSort(opt.value);
                              setIsSortDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 text-xs text-left transition-colors ${
                              isSelected
                                ? 'bg-rose/10 text-rose font-medium'
                                : 'text-ink-light hover:text-bark hover:bg-canvas/40'
                            }`}
                          >
                            <span>{opt.label}</span>
                            {isSelected && <Check size={12} className="text-rose flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Inline Grid / List View Toggle */}
                <div className="flex items-center border border-silk rounded-full overflow-hidden bg-white shadow-sm p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    aria-label="Grid view"
                    className={`p-1.5 rounded-full transition-colors ${viewMode === 'grid' ? 'bg-bark text-linen' : 'text-ink-light hover:bg-canvas'}`}
                  >
                    <LayoutGrid size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    aria-label="List view"
                    className={`p-1.5 rounded-full transition-colors ${viewMode === 'list' ? 'bg-bark text-linen' : 'text-ink-light hover:bg-canvas'}`}
                  >
                    <List size={13} />
                  </button>
                </div>
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
                  type="button"
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                  className={`p-2 rounded transition-colors ${viewMode === 'grid' ? 'bg-bark text-linen' : 'border border-canvas-line text-ink-light hover:bg-canvas'}`}
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                  className={`p-2 rounded transition-colors ${viewMode === 'list' ? 'bg-bark text-linen' : 'border border-canvas-line text-ink-light hover:bg-canvas'}`}
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Occasion Scroll Rail with Desktop Arrow Controls */}
          <div className="relative group/occ w-full">
            {canScrollLeft && (
              <button
                type="button"
                onClick={() => scrollOccasions('left')}
                aria-label="Scroll occasions left"
                className="hidden md:flex absolute -left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/95 border border-canvas-line shadow-sm items-center justify-center text-bark hover:bg-canvas hover:scale-105 transition-all"
              >
                <ChevronLeft size={16} />
              </button>
            )}

            <div
              ref={occasionScrollRef}
              className="flex items-center justify-start gap-2.5 overflow-x-auto pb-1 scrollbar-hide scroll-smooth px-1 sm:px-6 w-full"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {/* Quick Customisable toggle directly on mobile rail */}
              <div className="flex sm:hidden flex-shrink-0">
                <AtelierChip
                  variant="toggle"
                  active={customOnly}
                  onClick={() => setCustomOnly(!customOnly)}
                >
                  Customisable
                </AtelierChip>
              </div>

              {occasionChips.map((occ) => {
                const isActive =
                  occasionFilter.toLowerCase() === occ.value.toLowerCase() ||
                  occasionFilter.toLowerCase() === occ.label.toLowerCase();

                return (
                  <div key={occ.value} className="flex-shrink-0">
                    <AtelierChip
                      variant="occasion"
                      active={isActive}
                      onClick={() => {
                        const params = new URLSearchParams(searchParams);
                        if (isActive) {
                          params.delete('occasion');
                        } else {
                          params.set('occasion', occ.value);
                        }
                        setSearchParams(params);
                      }}
                    >
                      {occ.emoji && <span>{occ.emoji}</span>}
                      <span>{occ.label}</span>
                    </AtelierChip>
                  </div>
                );
              })}
            </div>

            {canScrollRight && (
              <button
                type="button"
                onClick={() => scrollOccasions('right')}
                aria-label="Scroll occasions right"
                className="hidden md:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/95 border border-canvas-line shadow-sm items-center justify-center text-bark hover:bg-canvas hover:scale-105 transition-all"
              >
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Slide-Up Mobile Filter Drawer */}
      {isFilterDrawerOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-bark/60 backdrop-blur-sm transition-opacity"
            style={{ opacity: filterBackdropOpacity }}
            onClick={closeFilterDrawer}
            aria-hidden="true"
          />

          {/* Slide-Up Sheet Container */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filter and sort creations"
            style={filterSheetStyle}
            className={`fixed inset-x-0 bottom-0 max-h-[85vh] bg-linen rounded-t-3xl shadow-2xl flex flex-col z-10 border-t border-silk ${
              !isFilterDragging ? 'animate-slide-up' : ''
            }`}
          >
            {/* Grab Handle Bar (Interactive Swipe-Down Area) */}
            <div
              className="pt-3 pb-2 flex justify-center cursor-grab active:cursor-grabbing select-none touch-none"
              onTouchStart={handleFilterTouchStart}
              onTouchMove={handleFilterTouchMove}
              onTouchEnd={handleFilterTouchEnd}
            >
              <div
                className={`h-1.5 rounded-full transition-all duration-150 ${
                  isFilterDragging ? 'w-12 bg-bark/45 scale-y-110' : 'w-10 bg-bark/20'
                }`}
              />
            </div>

            {/* Drawer Header (Also swipeable) */}
            <div
              className="px-6 py-2.5 border-b border-silk/80 flex items-center justify-between select-none touch-none"
              onTouchStart={handleFilterTouchStart}
              onTouchMove={handleFilterTouchMove}
              onTouchEnd={handleFilterTouchEnd}
            >
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-xl text-bark">Filters</h3>
                {activeFilterCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose text-white">
                    {activeFilterCount} active
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-xs text-rose font-medium hover:underline tracking-wide uppercase"
                  >
                    Reset All
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeFilterDrawer}
                  className="p-1.5 rounded-full hover:bg-canvas text-ink-light hover:text-ink transition-colors"
                  aria-label="Close filters"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 scrollbar-hide">
              {/* Section 1: Categories */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-bark">Category</h4>
                  {category !== 'all' && (
                    <button
                      type="button"
                      onClick={() => handleCategoryChange('all')}
                      className="text-[11px] text-rose hover:underline"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
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
              </div>

              {/* Section 2: Occasions & Celebrations */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-bark">Occasion &amp; Gifting</h4>
                  {occasionFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        const params = new URLSearchParams(searchParams);
                        params.delete('occasion');
                        setSearchParams(params);
                      }}
                      className="text-[11px] text-rose hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {occasionChips.map((occ) => {
                    const isActive =
                      occasionFilter.toLowerCase() === occ.value.toLowerCase() ||
                      occasionFilter.toLowerCase() === occ.label.toLowerCase();

                    return (
                      <AtelierChip
                        key={occ.value}
                        variant="occasion"
                        active={isActive}
                        onClick={() => {
                          const params = new URLSearchParams(searchParams);
                          if (isActive) {
                            params.delete('occasion');
                          } else {
                            params.set('occasion', occ.value);
                          }
                          setSearchParams(params);
                        }}
                      >
                        {occ.emoji && <span>{occ.emoji}</span>}
                        <span>{occ.label}</span>
                      </AtelierChip>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Attributes */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-bark mb-3">Studio Options</h4>
                <div className="flex">
                  <AtelierChip
                    variant="toggle"
                    active={customOnly}
                    onClick={() => setCustomOnly(!customOnly)}
                  >
                    Customisable only
                  </AtelierChip>
                </div>
              </div>

              {/* Section 4: Sort */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-bark mb-3">Sort Order</h4>
                <div className="grid grid-cols-2 gap-2">
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSort(opt.value)}
                      className={`px-3 py-2.5 rounded-lg text-xs font-medium text-left transition-all border ${
                        sort === opt.value
                          ? 'bg-bark text-linen border-bark shadow-sm font-semibold'
                          : 'bg-white border-silk text-ink hover:border-rose'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sticky Bottom Apply Button */}
            <div className="p-4 bg-linen border-t border-silk shadow-lg">
              <AtelierButton
                variant="primary"
                className="w-full justify-center py-3.5 text-sm font-medium tracking-wider shadow-sm"
                onClick={closeFilterDrawer}
              >
                View {filtered.length} {filtered.length === 1 ? 'Bloom' : 'Blooms'}
              </AtelierButton>
            </div>
          </div>
        </div>
      )}

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
