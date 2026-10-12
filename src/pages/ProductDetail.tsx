import { useState, useEffect, useRef } from 'react';
import { useParams, Link, Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Heart, ShoppingBag, Clock, Truck,
  Check, Gift, Sparkles, Star, Palette, Search,
  ChevronDown, ChevronUp, Package, ShieldCheck
} from 'lucide-react';
import { formatPrice, getDiscountPercent } from '@/data/products';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import Reveal from '@/components/Reveal';
import ProductCard from '@/components/ProductCard';
import WhatsAppButton from '@/components/WhatsAppButton';
import CrossSell from '@/components/CrossSell';
import DeliveryEstimator from '@/components/DeliveryEstimator';
import ReviewsSection from '@/components/ReviewsSection';
import RecentlyViewed from '@/components/RecentlyViewed';
import SEO from '@/components/SEO';
import SectionHeading from '@/components/SectionHeading';
import AtelierButton from '@/components/AtelierButton';
import { productOrderMessage, productEnquiryMessage } from '@/utils/whatsapp';
import { howItWorksSteps } from '@/data/site';
import { trackEvent } from '@/utils/analytics';
import { useProducts } from '@/context/ProductContext';
import { generalEnquiryMessage } from '@/utils/whatsapp';
import { resolveHueStyle } from '@/utils/colorPalette';
import { useStoreSettings } from '@/context/StoreSettingsContext';

export default function ProductDetail() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { products, getProductByCode, loading } = useProducts();
  const product = code ? getProductByCode(code) : undefined;
  const { addItem } = useCart();
  const { toggleItem, isWishlisted } = useWishlist();
  const { addRecentlyViewed } = useRecentlyViewed();
  const { settings } = useStoreSettings();

  // Dynamic packaging fees from store settings (with graceful defaults)
  const greetingCardFee = (settings.businessRules?.greetingCardFeePaise ?? 4900) / 100;
  const personalisedMessageFee = (settings.businessRules?.personalisedMessageFeePaise ?? 3900) / 100;
  const bouquetLuxuryWrapUpgradeFee = (settings.businessRules?.bouquetLuxuryWrapUpgradeFeePaise ?? 5900) / 100;
  const stemBouquetWrapFee = (settings.businessRules?.stemBouquetWrapFeePaise ?? 7900) / 100;
  const luxuryGiftBoxFee = (settings.businessRules?.luxuryGiftBoxFeePaise ?? 14900) / 100;

  const handleBackToStudio = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/shop');
    }
  };

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  // Category-Aware Packaging & Gift Options State
  const [selectedPackaging, setSelectedPackaging] = useState<'standard' | 'luxury_wrap' | 'bouquet_wrap' | 'gift_box'>('standard');
  const [addGreetingCard, setAddGreetingCard] = useState(false);
  const [greetingCardText, setGreetingCardText] = useState('');
  const [addPersonalMessage, setAddPersonalMessage] = useState(false);
  const [personalMessageText, setPersonalMessageText] = useState('');

  // Gallery swipe and thumbnail tracking
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isSwiping = useRef<boolean>(false);
  const isMouseDown = useRef<boolean>(false);
  const mouseStartX = useRef<number | null>(null);
  const thumbnailButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const thumbnailsContainerRef = useRef<HTMLDivElement | null>(null);

  const totalImages = product?.images?.length || 0;

  const goToPrevImage = () => {
    if (totalImages <= 1) return;
    setSelectedImage((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const goToNextImage = () => {
    if (totalImages <= 1) return;
    setSelectedImage((prev) => (prev < totalImages - 1 ? prev + 1 : prev));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = true;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isSwiping.current || touchStartX.current === null) return;
    const touch = e.changedTouches[0];
    if (touch) {
      const diffX = touchStartX.current - touch.clientX;
      const diffY = touchStartY.current !== null ? touchStartY.current - touch.clientY : 0;
      // Trigger if horizontal movement dominates vertical scroll and exceeds 30px
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 30) {
        if (diffX > 0) {
          goToNextImage();
        } else {
          goToPrevImage();
        }
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
    isSwiping.current = false;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isMouseDown.current = true;
    mouseStartX.current = e.clientX;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isMouseDown.current || mouseStartX.current === null) return;
    const diffX = mouseStartX.current - e.clientX;
    if (Math.abs(diffX) > 30) {
      if (diffX > 0) {
        goToNextImage();
      } else {
        goToPrevImage();
      }
    }
    isMouseDown.current = false;
    mouseStartX.current = null;
  };

  const handleMouseLeave = () => {
    isMouseDown.current = false;
    mouseStartX.current = null;
  };

  // Smoothly center the active thumbnail in the thumbnail scroll container without jarring page scroll
  useEffect(() => {
    const container = thumbnailsContainerRef.current;
    const activeThumbnail = thumbnailButtonsRef.current[selectedImage];
    if (container && activeThumbnail) {
      const targetLeft = activeThumbnail.offsetLeft;
      const targetWidth = activeThumbnail.offsetWidth;
      const containerWidth = container.offsetWidth;
      const scrollTarget = targetLeft - (containerWidth / 2) + (targetWidth / 2);
      container.scrollTo({
        left: Math.max(0, scrollTarget),
        behavior: 'smooth',
      });
    }
  }, [selectedImage]);

  useEffect(() => {
    if (product) {
      trackEvent('product_view', { code: product.code, name: product.name });
      addRecentlyViewed(product.code);
      window.scrollTo(0, 0);
    }
  }, [product, addRecentlyViewed]);

  if (loading) {
    return (
      <div className="min-h-screen bg-linen flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-canvas" />
          <p className="font-serif text-bark text-lg">Loading Product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-linen flex flex-col items-center justify-center p-6 text-center">
        <Reveal>
          <div className="w-20 h-20 bg-canvas rounded-full flex items-center justify-center mx-auto mb-6">
            <Search size={32} className="text-bark opacity-30" />
          </div>
          <h1 className="font-serif text-4xl text-bark mb-4">Piece not found</h1>
          <p className="text-ink-light max-w-md mx-auto mb-10 leading-relaxed">
            The bloom you're looking for might have found a new home or is currently being hand-sculpted in our studio.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <AtelierButton variant="primary" onClick={() => window.location.href = '/shop'}>
              Explore the Studio
            </AtelierButton>
            <WhatsAppButton
              message={generalEnquiryMessage()}
              label="Ask the Studio Assistant"
              variant="outline"
              className="px-8 py-3"
            />
          </div>
        </Reveal>
      </div>
    );
  }

  const relatedProducts = products
    .filter((p) => p.category === product.category && p.code !== product.code)
    .slice(0, 3);

  const isBouquet = product.category === 'bouquets' || product.name.toLowerCase().includes('bouquet');
  const isFlowers = product.category === 'flowers' || product.name.toLowerCase().includes('stem');

  const packageInclusions: string[] = (product.whatsIncluded && product.whatsIncluded.length > 0)
    ? product.whatsIncluded
    : isBouquet
    ? [
        product.bouquetSize ? `${product.bouquetSize} Handcrafted Bloom Stems` : 'Handcrafted Botanical Bloom Stems',
        'Korean Waterproof Matte Paper Wrap',
        'Layered Parisian Satin Ribbon & Wax Seal',
        'Botanical Care & Longevity Instruction Card',
      ]
    : isFlowers
    ? [
        'Handcrafted Botanical Bloom Stem',
        'Flexible Shape-Holding Wire Core',
        'Eco-Friendly Protective Sleeve',
        'Botanical Care & Dust-Free Guide',
      ]
    : [
        'Handcrafted Atelier Creation',
        'Studio Dust-Free Protection Packaging',
        'Authenticity & Care Instruction Note',
      ];

  const packagingOptions = isBouquet
    ? [
        {
          id: 'standard' as const,
          label: 'Standard Floral Wrap',
          badge: 'Included (Free)',
          fee: 0,
          desc: 'Complimentary Korean waterproof matte wrap with satin ribbon',
        },
        {
          id: 'luxury_wrap' as const,
          label: 'Upgrade to Luxury Silk Wrap',
          badge: `+₹${bouquetLuxuryWrapUpgradeFee}`,
          fee: bouquetLuxuryWrapUpgradeFee,
          desc: 'Textured luxury imported wrap with layered Parisian satin bow',
        },
        {
          id: 'gift_box' as const,
          label: 'Pack in Luxury Rigid Gift Box',
          badge: `+₹${luxuryGiftBoxFee}`,
          fee: luxuryGiftBoxFee,
          desc: 'Hard-shell keepsake luxury presentation box with satin ribbon',
        },
      ]
    : isFlowers
    ? [
        {
          id: 'standard' as const,
          label: 'Individual Stem Sleeves',
          badge: 'Included (Free)',
          fee: 0,
          desc: 'Protective eco-friendly botanical sleeve for individual stems',
        },
        {
          id: 'bouquet_wrap' as const,
          label: 'Wrap as a Finished Bouquet',
          badge: `+₹${stemBouquetWrapFee}`,
          fee: stemBouquetWrapFee,
          desc: 'Full bouquet wrapping, folds, tissue layers, and satin bow',
        },
        {
          id: 'gift_box' as const,
          label: 'Pack in Luxury Rigid Gift Box',
          badge: `+₹${luxuryGiftBoxFee}`,
          fee: luxuryGiftBoxFee,
          desc: 'Hard-shell keepsake luxury presentation box with satin ribbon',
        },
      ]
    : [
        {
          id: 'standard' as const,
          label: 'Standard Studio Packaging',
          badge: 'Included (Free)',
          fee: 0,
          desc: 'Secure studio packaging & protective eco wrap',
        },
        {
          id: 'gift_box' as const,
          label: 'Luxury Rigid Gift Box & Ribbon',
          badge: `+₹${luxuryGiftBoxFee}`,
          fee: luxuryGiftBoxFee,
          desc: 'Hard-shell keepsake presentation box with satin ribbon',
        },
      ];

  const currentPackaging = packagingOptions.find((o) => o.id === selectedPackaging) || packagingOptions[0];
  const isPerUnitPackaging = selectedPackaging === 'luxury_wrap';
  const currentPackagingFee = currentPackaging.fee;
  const currentGreetingFee = addGreetingCard ? greetingCardFee : 0;
  const currentMessageFee = addPersonalMessage ? personalisedMessageFee : 0;

  // Multiplier-aware pricing:
  // - Bouquet luxury silk wrap (+₹59) applies per bouquet unit.
  // - Loose stem bouquet assembly (+₹79) & gift box (+₹149) apply flat once per line item.
  // - Keepsake greeting card (+₹49) & personal note (+₹39) apply flat once per line item.
  const unitBasePrice = product.price + (isPerUnitPackaging ? currentPackagingFee : 0);
  const flatFees = (!isPerUnitPackaging ? currentPackagingFee : 0) + currentGreetingFee + currentMessageFee;
  const lineTotalPrice = (unitBasePrice * quantity) + flatFees;
  const effectiveUnitPrice = Math.round(lineTotalPrice / quantity);

  const handleAddToCart = () => {
    const packagingDesc = currentPackaging.fee > 0 ? `${currentPackaging.label} (+₹${currentPackaging.fee})` : currentPackaging.label;
    const parts = [
      `Packaging: ${packagingDesc}`,
      addGreetingCard && greetingCardText.trim()
        ? `Greeting Card Note (+₹${greetingCardFee}): "${greetingCardText.trim()}"`
        : addGreetingCard
        ? `Greeting Card (+₹${greetingCardFee})`
        : null,
      addPersonalMessage && personalMessageText.trim()
        ? `Personal Note (+₹${personalisedMessageFee}): "${personalMessageText.trim()}"`
        : addPersonalMessage
        ? `Personalised Note (+₹${personalisedMessageFee})`
        : null,
    ].filter(Boolean);

    addItem(
      product,
      {
        color: selectedColor || undefined,
        quantity,
        giftWrap: selectedPackaging !== 'standard' || addGreetingCard || addPersonalMessage,
        message: parts.length > 0 ? parts.join(' | ') : undefined,
        packagingTier: selectedPackaging,
        packagingLabel: currentPackaging.label,
        hasGreetingCard: addGreetingCard,
        greetingCardMessage: greetingCardText.trim() || undefined,
        hasPersonalNote: addPersonalMessage,
        personalNoteMessage: personalMessageText.trim() || undefined,
        basePrice: product.price,
        packagingFee: currentPackagingFee,
        packagingMultiplier: isPerUnitPackaging ? 'per_unit' : 'flat',
        cardFee: currentGreetingFee,
        noteFee: currentMessageFee,
        unitPrice: unitBasePrice,
      }
    );
    trackEvent('add_to_cart', { code: product.code, quantity });
  };

  const renderPackageInclusions = () => (
    <div className="pt-6 sm:pt-8 border-t border-canvas-line/80 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <span className="text-[10px] uppercase tracking-[0.25em] text-rose font-semibold block mb-0.5">
            The Atelier Package
          </span>
          <h3 className="font-serif text-2xl text-bark">What is included in this piece</h3>
        </div>
        <span className="text-xs text-ink-light bg-canvas px-2.5 py-1 rounded-full border border-canvas-line">
          {packageInclusions.length} studio items
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {packageInclusions.map((item, idx) => (
          <div
            key={idx}
            className="flex items-start gap-2.5 p-3.5 rounded-sm bg-white/80 border border-canvas-line hover:border-rose/40 transition-colors shadow-2xs"
          >
            <span className="w-5 h-5 rounded-full bg-moss/15 text-moss flex items-center justify-center shrink-0 mt-0.5">
              <Check size={12} strokeWidth={2.5} />
            </span>
            <span className="text-xs text-bark font-medium leading-relaxed">{item}</span>
          </div>
        ))}
      </div>

      {/* Everlasting Botanical Craftsmanship Note */}
      <div className="p-4 rounded-sm bg-linen border border-canvas-line space-y-2">
        <div className="flex items-center gap-2 text-rose font-medium text-xs">
          <Sparkles size={14} />
          <span className="uppercase tracking-wider font-semibold">Everlasting Artisan Guarantee</span>
        </div>
        <p className="text-xs text-ink-light leading-relaxed">
          Hand-sculpted with premium milk cotton yarn with flexible internal floral wire. 100% dust-resistant, hypoallergenic, and everlasting — requires zero watering or sunlight, preserving its beauty forever.
        </p>
      </div>
    </div>
  );

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    sku: product.code,
    brand: { '@type': 'Brand', name: 'The Petal & Bloom' },
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
    },
  };

  return (
    <div className="pt-20 lg:pt-24 bg-linen">
      <SEO
        title={product.name}
        description={product.description}
        canonicalPath={`/product/${product.code}`}
        ogType="product"
        ogImage={product.images?.[0] || '/placeholder-bloom.svg'}
        structuredData={structuredData}
      />

      {/* Breadcrumb */}
      <div className="container-lux py-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-ink-light">
          <button
            type="button"
            onClick={handleBackToStudio}
            className="inline-flex items-center gap-2 hover:text-rose transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} strokeWidth={1.5} />
            Back to Studio
          </button>
        </nav>
      </div>

      {/* Product main */}
      <section className="container-lux pb-24">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-24">
          {/* Gallery - Left Column (7/12) */}
          <div className="lg:col-span-7">
            <Reveal>
              <div className="space-y-6 sm:space-y-8">
                {/* Main Photo with Touch-Swipe and Controls */}
                <div
                  className="relative aspect-[4/5] overflow-hidden rounded-atelier-img bg-canvas shadow-soft group select-none touch-pan-y overscroll-x-contain cursor-grab active:cursor-grabbing"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
                  onMouseDown={handleMouseDown}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                >
                  <img
                    src={product.images?.[selectedImage] || '/placeholder-bloom.svg'}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-700 hover:scale-105 pointer-events-none"
                  />

                  {totalImages > 1 && (
                    <div className="absolute bottom-3.5 right-3.5 px-3 py-1 rounded-full bg-bark/70 text-linen text-xs font-mono tracking-wider backdrop-blur-md flex items-center gap-1 shadow-sm select-none">
                      <span>{selectedImage + 1}</span>
                      <span className="opacity-40">/</span>
                      <span>{totalImages}</span>
                    </div>
                  )}
                </div>

                {/* Thumbnails: Exactly 3 on mobile screen + smooth horizontal scroll */}
                {totalImages > 1 && (
                  <div
                    ref={thumbnailsContainerRef}
                    className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory scroll-smooth w-full"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                  >
                    {product.images.map((img, i) => (
                      <button
                        key={i}
                        ref={(el) => (thumbnailButtonsRef.current[i] = el)}
                        onClick={() => setSelectedImage(i)}
                        className={`flex-shrink-0 snap-start w-[calc((100%-1.5rem)/3)] sm:w-24 aspect-[3/4] overflow-hidden rounded-atelier-img border-2 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose ${
                          selectedImage === i
                            ? 'border-rose shadow-md ring-2 ring-rose/30 ring-offset-2 ring-offset-linen'
                            : 'border-canvas-line hover:border-rose/50 opacity-80 hover:opacity-100'
                        }`}
                        aria-label={`View image ${i + 1} of ${product.name}`}
                        aria-pressed={selectedImage === i}
                      >
                        <img
                          src={img}
                          alt={`${product.name} view ${i + 1}`}
                          loading="lazy"
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Desktop only: Package Inclusions & Craftsmanship (Balances left and right columns on desktop) */}
                <div className="hidden lg:block">
                  {renderPackageInclusions()}
                </div>
              </div>
            </Reveal>
          </div>

          {/* Info - Right Column (5/12) */}
          <div className="lg:col-span-5">
            <Reveal delay={100}>
              <div className="sticky top-32 glass-panel p-8 rounded-atelier-panel shadow-soft">
                <div className="flex items-center gap-3 mb-6 flex-wrap">
                  {product.bestseller && (
                    <span className="bg-bark text-linen text-[10px] uppercase tracking-wider px-3 py-1 rounded-sm font-medium flex items-center gap-1">
                      <Star size={10} fill="currentColor" /> Studio Choice
                    </span>
                  )}
                  {product.madeToOrder && (
                    <span className="bg-canvas text-ink-light text-[10px] uppercase tracking-wider px-3 py-1 rounded-sm font-medium">
                      Hand-sculpted to order
                    </span>
                  )}
                  {product.customisable && (
                    <span className="bg-moss/10 text-moss text-[10px] uppercase tracking-wider px-3 py-1 rounded-sm font-medium flex items-center gap-1">
                      <Sparkles size={10} /> Customisable
                    </span>
                  )}
                </div>

                <p className="text-xs uppercase tracking-[0.3em] text-rose mb-3">{product.code}</p>
                <h1 className="font-serif text-5xl lg:text-6xl mb-3 leading-tight text-bark">{product.name}</h1>

                {/* Rating Badge with Smooth Scroll */}
                <div className="flex items-center gap-2 mb-6">
                  <div className="flex items-center gap-0.5 text-rose">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={13} className="fill-rose text-rose" />
                    ))}
                  </div>
                  <a
                    href="#reviews"
                    className="text-xs text-ink-light hover:text-bark underline underline-offset-4 transition-colors font-medium"
                  >
                    5.0 · Verified Patron Reviews
                  </a>
                </div>

                <div className="flex items-center gap-6 mb-8">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-serif text-4xl text-rose-deep">
                      {formatPrice(unitBasePrice + (quantity === 1 ? flatFees : 0))}
                    </span>
                    {lineTotalPrice > (product.price * quantity) && (
                      <span className="text-[11px] text-ink-light font-sans bg-canvas px-2.5 py-1 rounded-sm border border-canvas-line">
                        Base {formatPrice(product.price * quantity)} + Upgrades (+₹{lineTotalPrice - (product.price * quantity)})
                      </span>
                    )}
                    {product.compareAtPrice && product.compareAtPrice > product.price && (
                      <>
                        <span className="text-sm text-ink-light line-through">{formatPrice(product.compareAtPrice)}</span>
                        <span className="text-xs text-rose font-medium">{getDiscountPercent(product)}% off</span>
                      </>
                    )}
                  </div>
                  {product.preparationDays && (
                    <span className="text-sm text-moss font-medium">
                      In the studio · ships in {product.preparationDays}
                    </span>
                  )}
                  <button
                    onClick={() => toggleItem(product.code)}
                    className={`ml-auto flex items-center gap-2 text-sm transition-colors duration-300 ${
                      isWishlisted(product.code) ? 'text-rose' : 'text-ink-light hover:text-rose'
                    }`}
                    aria-label={isWishlisted(product.code) ? 'Remove from wishlist' : 'Add to wishlist'}
                  >
                    <Heart
                      size={20}
                      strokeWidth={1.5}
                      fill={isWishlisted(product.code) ? 'currentColor' : 'none'}
                    />
                    {isWishlisted(product.code) ? 'Saved' : 'Save'}
                  </button>
                </div>

                {/* Studio Batch Availability */}
                <div className="mb-6 p-3 bg-canvas/40 border border-canvas-line rounded-sm flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-bark font-medium">
                      {product.madeToOrder ? 'Handcrafted to order' : 'Limited studio batch'}
                    </span>
                  </div>
                  <span className="text-ink-light">
                    {product.preparationDays ? `Artisan timeline: ${product.preparationDays}` : 'Ships in 3–5 days'}
                  </span>
                </div>

                {/* Description with Read More / Show Less Toggle */}
                <div className="space-y-4 mb-8">
                  <div className={`relative transition-all duration-300 ${!isDescExpanded && (product.description.length > 180 || product.longDescription) ? 'max-h-24 overflow-hidden' : ''}`}>
                    <p className="text-base text-ink-light leading-relaxed font-light">
                      {product.description}
                    </p>
                    {product.longDescription && isDescExpanded && (
                      <div className="mt-4 p-5 bg-canvas rounded-sm border-l-4 border-rose/50 italic text-ink-light leading-relaxed text-sm">
                        {product.longDescription}
                      </div>
                    )}
                    {!isDescExpanded && (product.description.length > 180 || product.longDescription) && (
                      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-linen to-transparent pointer-events-none" />
                    )}
                  </div>

                  {(product.description.length > 180 || product.longDescription) && (
                    <button
                      type="button"
                      onClick={() => setIsDescExpanded(!isDescExpanded)}
                      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-rose hover:text-rose-deep transition-colors"
                    >
                      <span>{isDescExpanded ? 'Show less' : 'Read full story'}</span>
                      {isDescExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  )}

                  {(product.featured || product.bouquetSize || product.recipients?.length) && (
                    <div className="space-y-3 pt-2">
                      {product.featured && (
                        <div className="inline-flex items-center gap-2 rounded-full border border-rose/30 bg-rose/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-rose">
                          <Sparkles size={12} /> Featured in Collection
                        </div>
                      )}

                      {product.bouquetSize && (
                        <div className="text-sm text-bark">
                          <span className="font-medium uppercase tracking-wider text-ink-light mr-2">Product size:</span>
                          {product.bouquetSize}
                        </div>
                      )}

                      {product.recipients && product.recipients.length > 0 && (
                        <div className="text-sm text-bark">
                          <span className="font-medium uppercase tracking-wider text-ink-light mr-2">Ideal for:</span>
                          <div className="inline-flex flex-wrap gap-1.5 mt-1.5">
                            {product.recipients.map((recipient) => (
                              <span key={recipient} className="rounded-full border border-canvas-line bg-canvas px-2.5 py-0.5 text-xs text-bark">
                                {recipient}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Studio Fact Sheet */}
                <div className="grid grid-cols-2 gap-8 mb-10 py-8 border-y border-canvas-line">
                  <div className="flex items-start gap-4">
                    <Clock size={20} className="text-rose flex-shrink-0 mt-1" strokeWidth={1.5} />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-ink-light font-semibold">Timeline</p>
                      <p className="text-sm text-bark font-medium">{product.preparationDays || '3–5 days'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <Truck size={20} className="text-rose flex-shrink-0 mt-1" strokeWidth={1.5} />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-ink-light font-semibold">Shipping</p>
                      <p className="text-sm text-bark font-medium">Pan-India delivery</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <Palette size={20} className="text-rose flex-shrink-0 mt-1" strokeWidth={1.5} />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-ink-light font-semibold">Palette</p>
                      <p className="text-sm text-bark font-medium">
                        {product.customisable ? 'Custom colours available' : 'Studio standard'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <Gift size={20} className="text-rose flex-shrink-0 mt-1" strokeWidth={1.5} />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-ink-light font-semibold">Presentation</p>
                      <p className="text-sm text-bark font-medium">Gift-ready wrapping</p>
                    </div>
                  </div>
                </div>

                {/* Customization Area */}
                <div className="space-y-8 mb-10">
                  {product.colors && product.colors.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-bark mb-4 uppercase tracking-wider">
                        Select Hue{' '}
                        {selectedColor && (
                          <span className="font-normal normal-case text-rose font-sans">
                            — {selectedColor}{' '}
                            {resolveHueStyle(selectedColor).descriptor && (
                              <span className="text-xs text-ink-light font-normal italic ml-1">
                                ({resolveHueStyle(selectedColor).descriptor})
                              </span>
                            )}
                          </span>
                        )}
                      </label>
                      <div className="flex flex-wrap gap-3">
                        {product.colors.map((color) => {
                          const isSelected = selectedColor === color;
                          const hueStyle = resolveHueStyle(color);
                          return (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setSelectedColor(isSelected ? '' : color)}
                              style={
                                isSelected
                                  ? {
                                      background: hueStyle.background,
                                      color: hueStyle.color,
                                      border: hueStyle.border || '1px solid transparent',
                                      textShadow: hueStyle.textShadow || 'none',
                                    }
                                  : undefined
                              }
                              className={`px-5 py-2.5 text-sm rounded-full transition-all duration-300 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose active:scale-95 ${
                                isSelected
                                  ? 'shadow-md scale-105'
                                  : 'bg-linen text-ink-light border border-canvas-line hover:border-rose/50 hover:text-bark'
                              }`}
                              aria-pressed={isSelected}
                            >
                              {color}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-bark uppercase tracking-wider">Quantity</label>
                    <div className="flex items-center border border-canvas-line bg-linen rounded-full px-1 py-1">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-8 h-8 flex items-center justify-center text-bark hover:bg-canvas rounded-full transition-colors focus-visible:outline-none"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="px-4 text-base text-bark min-w-[40px] text-center font-medium" aria-live="polite">{quantity}</span>
                      <button
                        onClick={() => setQuantity(quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center text-bark hover:bg-canvas rounded-full transition-colors focus-visible:outline-none"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Packaging & Presentation Selector */}
                  <div className="space-y-3 pt-2 border-t border-canvas-line/80">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-bark uppercase tracking-wider">
                        Packaging &amp; Presentation
                      </label>
                      {currentPackagingFee > 0 && (
                        <span className="text-rose text-[11px] font-semibold">
                          +₹{currentPackagingFee}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {packagingOptions.map((opt) => {
                        const isSel = selectedPackaging === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setSelectedPackaging(opt.id)}
                            className={`w-full text-left p-3.5 rounded-sm border transition-all flex items-start justify-between gap-3 ${
                              isSel
                                ? 'bg-rose/5 border-rose ring-1 ring-rose/30 shadow-2xs'
                                : 'bg-linen/50 border-canvas-line hover:border-canvas-line-hover'
                            }`}
                          >
                            <div className="space-y-0.5 flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                  isSel ? 'border-rose bg-rose' : 'border-ink-muted'
                                }`}>
                                  {isSel && <span className="w-1.5 h-1.5 rounded-full bg-linen" />}
                                </span>
                                <span className={`text-xs font-semibold ${isSel ? 'text-bark' : 'text-ink'}`}>
                                  {opt.label}
                                </span>
                              </div>
                              <p className="text-[11px] text-ink-light pl-5.5 leading-snug">
                                {opt.desc}
                              </p>
                            </div>
                            <span className={`text-xs font-medium shrink-0 px-2 py-0.5 rounded-full text-[10px] ${
                              opt.fee === 0
                                ? 'bg-moss/10 text-moss'
                                : isSel
                                ? 'bg-rose text-linen font-semibold'
                                : 'bg-canvas text-bark'
                            }`}>
                              {opt.badge}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Gift Touches & Notes (Optional Add-ons) */}
                  <div className="space-y-3 pt-2 border-t border-canvas-line/80">
                    <label className="block text-xs font-semibold text-bark uppercase tracking-wider">
                      Gift Touches &amp; Notes
                    </label>

                    {/* Handwritten Greeting Card */}
                    <div className={`p-3.5 rounded-sm border transition-all space-y-2 ${
                      addGreetingCard ? 'bg-canvas/40 border-rose/40' : 'bg-linen/40 border-canvas-line'
                    }`}>
                      <label className="flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={addGreetingCard}
                            onChange={(e) => setAddGreetingCard(e.target.checked)}
                            className="w-4 h-4 accent-rose rounded cursor-pointer"
                          />
                          <span className="text-xs font-medium text-bark">
                            Handwritten Keepsake Greeting Card
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-rose">
                          +₹{greetingCardFee}
                        </span>
                      </label>
                      {addGreetingCard && (
                        <div className="pt-2 pl-6">
                          <textarea
                            rows={2}
                            maxLength={200}
                            value={greetingCardText}
                            onChange={(e) => setGreetingCardText(e.target.value)}
                            placeholder="Write your greeting note (e.g. Wishing you joy & happiness!)..."
                            className="w-full p-2.5 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-rose resize-none"
                          />
                          <span className="text-[10px] text-ink-light block text-right mt-0.5">
                            {greetingCardText.length}/200 chars
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Personalised Message Note */}
                    <div className={`p-3.5 rounded-sm border transition-all space-y-2 ${
                      addPersonalMessage ? 'bg-canvas/40 border-rose/40' : 'bg-linen/40 border-canvas-line'
                    }`}>
                      <label className="flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={addPersonalMessage}
                            onChange={(e) => setAddPersonalMessage(e.target.checked)}
                            className="w-4 h-4 accent-rose rounded cursor-pointer"
                          />
                          <span className="text-xs font-medium text-bark">
                            Personalised Note Card (Inside Packaging)
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-rose">
                          +₹{personalisedMessageFee}
                        </span>
                      </label>
                      {addPersonalMessage && (
                        <div className="pt-2 pl-6">
                          <textarea
                            rows={2}
                            maxLength={150}
                            value={personalMessageText}
                            onChange={(e) => setPersonalMessageText(e.target.value)}
                            placeholder="Personal note tucked inside wrapping (e.g. With love, always)..."
                            className="w-full p-2.5 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-rose resize-none"
                          />
                          <span className="text-[10px] text-ink-light block text-right mt-0.5">
                            {personalMessageText.length}/150 chars
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Delivery Estimation */}
                <div className="mb-10">
                  <DeliveryEstimator preparationDays={product.preparationDays} />
                </div>

                {/* CTAs */}
                <div className="flex flex-col gap-3.5">
                  <AtelierButton onClick={handleAddToCart} className="w-full py-5 text-base sm:text-lg bg-rose hover:bg-rose-deep text-linen border-none shadow-md">
                    <ShoppingBag size={20} className="mr-2" />
                    Add to Collection {lineTotalPrice > 0 ? `(${formatPrice(lineTotalPrice)})` : ''}
                  </AtelierButton>
                  <WhatsAppButton
                    message={productEnquiryMessage(product)}
                    label="Inquire about this piece"
                    variant="outline"
                    className="w-full py-4 text-base"
                  />
                </div>
              </div>
            </Reveal>

            {/* Mobile only: Package Inclusions & Craftsmanship rendered AFTER the Buy Panel & Description */}
            <div className="block lg:hidden mt-8">
              {renderPackageInclusions()}
            </div>
          </div>
        </div>
      </section>

      {/* Cross-sell */}
      <CrossSell />

      {/* Reviews Section */}
      <ReviewsSection productCode={product.code} productName={product.name} />

      {/* Process Guide */}
      <section className="pt-24 lg:pt-32 pb-12 lg:pb-16 bg-bark text-linen">
        <div className="container-lux">
          <Reveal>
            <SectionHeading
              label="The Journey"
              title="From yarn to your doorstep."
              center={true}
              className="text-linen"
            />
          </Reveal>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 mt-16">
            {howItWorksSteps.map((step, i) => (
              <Reveal key={step.num} delay={i * 80}>
                <div className="text-center">
                  <p className="font-serif text-4xl lg:text-5xl text-rose italic mb-3">{step.num}</p>
                  <p className="text-sm font-medium text-linen leading-snug">{step.label}</p>
                  <p className="text-xs text-linen/70 mt-2 leading-snug hidden sm:block">{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Recently viewed */}
      <RecentlyViewed excludeCode={product.code} />

      {/* Related products */}
      {relatedProducts.length > 0 && (
        <section className="pt-24 lg:pt-32 pb-12 lg:pb-16 bg-linen">
          <div className="container-lux">
            <Reveal>
              <SectionHeading
                title="You may also appreciate"
                center={true}
              />
            </Reveal>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 mt-12">
              {relatedProducts.map((p, i) => (
                <Reveal key={p.code} delay={i * 80}>
                  <ProductCard product={p} variant="compact" />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Sticky Mobile Add to Bag Bar */}
      <div className="fixed bottom-14 left-0 right-0 z-40 sm:hidden bg-linen/95 backdrop-blur-md border-t border-canvas-line p-3 px-4 shadow-xl flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-serif text-bark truncate">{product.name}</p>
          <p className="text-sm font-serif font-bold text-rose-deep">{formatPrice(effectiveUnitPrice)}</p>
        </div>
        <button
          onClick={handleAddToCart}
          className="px-6 py-2.5 bg-rose text-linen hover:bg-rose-deep text-xs uppercase tracking-wider font-semibold rounded-full shadow-md flex items-center gap-1.5 shrink-0"
        >
          <ShoppingBag size={14} /> Add to Bag
        </button>
      </div>
    </div>
  );
}
