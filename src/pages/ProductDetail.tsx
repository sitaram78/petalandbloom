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
  const [isGiftSuiteOpen, setIsGiftSuiteOpen] = useState(false);

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
    .slice(0, 4);

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
    <div className="pt-6 sm:pt-8 border-t border-canvas-line/80 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <span className="text-[10px] uppercase tracking-[0.25em] text-rose font-semibold block mb-0.5">
            The Atelier Package
          </span>
          <h3 className="font-serif text-2xl text-bark">What is included in this piece</h3>
        </div>
        <span className="text-xs text-moss font-medium bg-moss/10 px-3 py-1 rounded-full border border-moss/20">
          ✓ Studio Inclusions ({packageInclusions.length})
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 pt-1">
        {packageInclusions.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2.5 text-xs text-bark font-medium leading-relaxed">
            <span className="w-4 h-4 rounded-full bg-moss/15 text-moss flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
              <Check size={11} strokeWidth={2.5} />
            </span>
            <span>{item}</span>
          </div>
        ))}
      </div>

      {/* Everlasting Botanical Craftsmanship Note - Subtle Editorial Ribbon */}
      <div className="pt-3 border-t border-canvas-line/60 flex items-start gap-3 text-xs text-ink-light leading-relaxed">
        <span className="w-5 h-5 rounded-full bg-rose/10 text-rose flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles size={13} />
        </span>
        <div>
          <span className="font-semibold text-bark block mb-0.5">Everlasting Artisan Guarantee</span>
          <span>
            Hand-sculpted with premium milk cotton yarn with flexible internal floral wire. 100% dust-resistant, hypoallergenic, and everlasting — requires zero watering or sunlight, preserving its beauty forever.
          </span>
        </div>
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
    <div className="pt-20 lg:pt-24 bg-linen pb-32 sm:pb-20 lg:pb-0 overflow-x-hidden">
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
      <section className="max-w-7xl mx-auto px-4 sm:px-10 lg:px-16 pb-24">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-12 items-start min-w-0">
          {/* Gallery - Left Column (6/12 balanced) */}
          <div className="lg:col-span-6 min-w-0">
            <Reveal>
              <div className="w-full max-w-[500px] xl:max-w-[540px] mx-auto lg:mx-0 space-y-4 sm:space-y-5">
                {/* Main Photo with Touch-Swipe and Controls */}
                <div
                  className="relative w-full aspect-[3/4] overflow-hidden rounded-2xl sm:rounded-3xl bg-white/90 border border-canvas-line/70 shadow-xs group select-none touch-pan-y overscroll-x-contain cursor-grab active:cursor-grabbing"
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
                    className="w-full h-full object-cover object-center transition-transform duration-500 hover:scale-105 pointer-events-none"
                  />

                  {totalImages > 1 && (
                    <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-bark/75 text-linen text-xs font-mono tracking-wider backdrop-blur-md flex items-center gap-1 shadow-sm select-none">
                      <span>{selectedImage + 1}</span>
                      <span className="opacity-40">/</span>
                      <span>{totalImages}</span>
                    </div>
                  )}
                </div>

                {/* Thumbnails: Exactly 3 visible across the full width, scrollable if > 3 */}
                {totalImages > 1 && (
                  <div className="w-full space-y-2">
                    <div
                      ref={thumbnailsContainerRef}
                      onWheel={(e) => {
                        if (totalImages > 3 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                          e.currentTarget.scrollLeft += e.deltaY;
                        }
                      }}
                      className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory scroll-smooth w-full select-none"
                      style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                      {product.images.map((img, i) => (
                        <button
                          key={i}
                          ref={(el) => (thumbnailButtonsRef.current[i] = el)}
                          onClick={() => setSelectedImage(i)}
                          className={`flex-shrink-0 snap-start w-[calc((100%-1.5rem)/3)] aspect-square rounded-xl sm:rounded-2xl overflow-hidden border transition-all duration-200 cursor-pointer relative group bg-white/90 ${
                            selectedImage === i
                              ? 'border-2 border-rose ring-2 ring-rose/25 shadow-xs'
                              : 'border-canvas-line hover:border-rose/50 opacity-80 hover:opacity-100'
                          }`}
                          aria-label={`View image ${i + 1} of ${product.name}`}
                          aria-pressed={selectedImage === i}
                        >
                          <img
                            src={img}
                            alt={`${product.name} view ${i + 1}`}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                          />
                        </button>
                      ))}
                    </div>

                    {totalImages > 3 && (
                      <div className="flex items-center justify-between text-xs text-ink-light pt-0.5 px-1">
                        <span className="text-[11px] font-mono">
                          {selectedImage + 1} of {totalImages} studio angles
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              thumbnailsContainerRef.current?.scrollBy({ left: -160, behavior: 'smooth' });
                            }}
                            className="w-6 h-6 rounded-full border border-canvas-line bg-white/80 hover:bg-white text-bark flex items-center justify-center text-xs transition-colors cursor-pointer"
                            aria-label="Scroll thumbnails left"
                          >
                            ‹
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              thumbnailsContainerRef.current?.scrollBy({ left: 160, behavior: 'smooth' });
                            }}
                            className="w-6 h-6 rounded-full border border-canvas-line bg-white/80 hover:bg-white text-bark flex items-center justify-center text-xs transition-colors cursor-pointer"
                            aria-label="Scroll thumbnails right"
                          >
                            ›
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Desktop only: Package Inclusions & Craftsmanship */}
                <div className="hidden lg:block">
                  {renderPackageInclusions()}
                </div>
              </div>
            </Reveal>
          </div>

          {/* Info - Right Column (6/12 balanced) */}
          <div className="lg:col-span-6 min-w-0">
            <Reveal delay={100}>
              <div className="sticky top-28 bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-7 lg:p-8 border border-canvas-line/80 shadow-xs space-y-4 sm:space-y-5">
                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  {product.bestseller && (
                    <span className="bg-bark text-linen text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full font-medium flex items-center gap-1 shadow-2xs">
                      <Star size={10} fill="currentColor" /> Studio Choice
                    </span>
                  )}
                  {product.madeToOrder && (
                    <span className="bg-canvas text-ink-light text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full font-medium border border-canvas-line">
                      Hand-sculpted to order
                    </span>
                  )}
                  {product.customisable && (
                    <span className="bg-moss/10 text-moss text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full font-medium flex items-center gap-1 border border-moss/20">
                      <Sparkles size={10} /> Customisable
                    </span>
                  )}
                </div>

                {/* Product Code & Title */}
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-rose font-medium mb-1">{product.code}</p>
                  <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl xl:text-5xl text-bark leading-tight font-medium">{product.name}</h1>
                </div>

                {/* Rating Badge with Smooth Scroll */}
                <div className="flex items-center gap-2">
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

                {/* Price & Wishlist Row */}
                <div className="flex items-center justify-between gap-3 pb-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-serif text-2xl sm:text-3xl lg:text-4xl text-rose-deep font-semibold">
                      {formatPrice(unitBasePrice + (quantity === 1 ? flatFees : 0))}
                    </span>
                    {lineTotalPrice > (product.price * quantity) && (
                      <span className="text-[10px] sm:text-[11px] text-ink-light font-sans bg-canvas px-2 sm:px-2.5 py-0.5 rounded-full border border-canvas-line">
                        Base {formatPrice(product.price * quantity)} + Upgrades (+₹{lineTotalPrice - (product.price * quantity)})
                      </span>
                    )}
                    {product.compareAtPrice && product.compareAtPrice > product.price && (
                      <>
                        <span className="text-xs sm:text-sm text-ink-light line-through">{formatPrice(product.compareAtPrice)}</span>
                        <span className="text-[10px] sm:text-xs text-moss font-semibold bg-moss/10 px-2 py-0.5 rounded-full">{getDiscountPercent(product)}% off</span>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleItem(product.code)}
                    className={`flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer py-1.5 px-2.5 sm:px-3 rounded-full border shrink-0 ${
                      isWishlisted(product.code)
                        ? 'text-rose border-rose/30 bg-rose/5'
                        : 'text-ink-light border-canvas-line hover:border-rose/40 hover:text-rose bg-white/60'
                    }`}
                    aria-label={isWishlisted(product.code) ? 'Remove from wishlist' : 'Add to wishlist'}
                  >
                    <Heart
                      size={14}
                      strokeWidth={1.5}
                      fill={isWishlisted(product.code) ? 'currentColor' : 'none'}
                    />
                    <span>{isWishlisted(product.code) ? 'Saved' : 'Save'}</span>
                  </button>
                </div>

                {/* Streamlined Atelier Fact Strip (Replaces Bulky Fact Sheet) */}
                <div className="py-2 px-3 sm:py-2.5 sm:px-3.5 rounded-xl sm:rounded-2xl bg-canvas/60 border border-canvas-line/70 flex items-center justify-between flex-wrap gap-1.5 sm:gap-2 text-xs">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-bark font-medium text-[11px] sm:text-xs">
                      {product.madeToOrder ? 'Handcrafted to order' : 'Limited studio batch'}
                    </span>
                    <span className="text-ink-muted">·</span>
                    <span className="text-ink-light text-[11px] sm:text-xs">
                      Ships in {product.preparationDays || '3–5 days'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 sm:gap-3 text-[10px] sm:text-[11px] text-ink-light">
                    <span className="inline-flex items-center gap-1">
                      <Truck size={12} className="text-rose" /> Pan-India
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Gift size={12} className="text-rose" /> Gift-ready
                    </span>
                  </div>
                </div>

                {/* Description with Read More / Show Less Toggle */}
                <div className="space-y-3">
                  <div className={`relative transition-all duration-300 ${!isDescExpanded && (product.description.length > 180 || product.longDescription) ? 'max-h-24 overflow-hidden' : ''}`}>
                    <p className="text-sm text-ink-light leading-relaxed font-light">
                      {product.description}
                    </p>
                    {product.longDescription && isDescExpanded && (
                      <div className="mt-3 p-4 bg-canvas/60 rounded-xl border-l-2 border-rose/50 italic text-ink-light leading-relaxed text-xs">
                        {product.longDescription}
                      </div>
                    )}
                    {!isDescExpanded && (product.description.length > 180 || product.longDescription) && (
                      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white/90 to-transparent pointer-events-none" />
                    )}
                  </div>

                  {(product.description.length > 180 || product.longDescription) && (
                    <button
                      type="button"
                      onClick={() => setIsDescExpanded(!isDescExpanded)}
                      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-rose hover:text-rose-deep transition-colors cursor-pointer"
                    >
                      <span>{isDescExpanded ? 'Show less' : 'Read full story'}</span>
                      {isDescExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  )}

                  {(product.featured || product.bouquetSize || product.recipients?.length) && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                      {product.featured && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose/30 bg-rose/5 px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-rose font-medium">
                          <Sparkles size={11} /> Featured
                        </span>
                      )}
                      {product.bouquetSize && (
                        <span className="text-bark bg-canvas/80 px-2.5 py-0.5 rounded-full border border-canvas-line text-xs">
                          <span className="text-ink-light mr-1 font-normal">Size:</span>
                          <span className="font-medium">{product.bouquetSize}</span>
                        </span>
                      )}
                      {product.recipients && product.recipients.length > 0 && (
                        <div className="inline-flex items-center gap-1">
                          <span className="text-ink-light text-xs mr-0.5">For:</span>
                          {product.recipients.map((recipient) => (
                            <span key={recipient} className="rounded-full border border-canvas-line bg-canvas px-2 py-0.5 text-[11px] text-bark">
                              {recipient}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Hue Selection */}
                {product.colors && product.colors.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-canvas-line/80">
                    <div className="flex justify-between items-center text-xs">
                      <label className="font-semibold text-bark uppercase tracking-wider text-[11px]">
                        Select Hue
                      </label>
                      {selectedColor && (
                        <span className="font-medium text-rose font-sans">
                          {selectedColor}{' '}
                          {resolveHueStyle(selectedColor).descriptor && (
                            <span className="text-[11px] text-ink-light font-normal italic ml-0.5">
                              ({resolveHueStyle(selectedColor).descriptor})
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
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
                            className={`px-4 py-2 text-xs rounded-full transition-all duration-200 font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose active:scale-95 ${
                              isSelected
                                ? 'shadow-xs scale-102 ring-1 ring-rose/40'
                                : 'bg-canvas/70 text-ink-light border border-canvas-line hover:border-rose/50 hover:text-bark'
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

                {/* Packaging & Presentation Selector - Compact 2-Column Grid */}
                <div className="space-y-2.5 pt-2 border-t border-canvas-line/80">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-bark uppercase tracking-wider text-[11px]">
                      Packaging &amp; Presentation
                    </label>
                    {currentPackagingFee > 0 && (
                      <span className="text-rose text-[11px] font-semibold">
                        +₹{currentPackagingFee} {isPerUnitPackaging ? '/ unit' : 'flat'}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {packagingOptions.map((opt) => {
                      const isSel = selectedPackaging === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSelectedPackaging(opt.id)}
                          className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between gap-1 cursor-pointer ${
                            isSel
                              ? 'bg-rose/5 border-rose ring-1 ring-rose/30 shadow-2xs'
                              : 'bg-white/80 border-canvas-line hover:border-rose/40 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <span className={`text-[11px] sm:text-xs font-semibold leading-tight ${isSel ? 'text-bark' : 'text-ink'}`}>
                              {opt.label}
                            </span>
                            <span className={`text-[9px] sm:text-[10px] font-bold shrink-0 px-1.5 sm:px-2 py-0.5 rounded-full ${
                              opt.fee === 0
                                ? 'bg-moss/10 text-moss'
                                : isSel
                                ? 'bg-rose text-linen'
                                : 'bg-canvas text-bark'
                            }`}>
                              {opt.badge}
                            </span>
                          </div>
                          <p className="text-[10px] sm:text-[11px] text-ink-light leading-tight line-clamp-2">
                            {opt.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Gift Touches & Notes - Collapsible Drawer */}
                <div className="pt-2 border-t border-canvas-line/80">
                  <button
                    type="button"
                    onClick={() => setIsGiftSuiteOpen(!isGiftSuiteOpen)}
                    className="w-full flex items-center justify-between py-1.5 text-xs font-semibold text-bark hover:text-rose transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                      <span>💌</span>
                      <span>Add Keepsake Greeting Card or Note</span>
                      {(addGreetingCard || addPersonalMessage) && (
                        <span className="text-[10px] font-bold text-rose bg-rose/10 px-2 py-0.5 rounded-full normal-case">
                          Active (+₹{currentGreetingFee + currentMessageFee})
                        </span>
                      )}
                    </span>
                    <span className="text-ink-light">
                      {isGiftSuiteOpen || addGreetingCard || addPersonalMessage ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </span>
                  </button>

                  {(isGiftSuiteOpen || addGreetingCard || addPersonalMessage) && (
                    <div className="pt-2.5 space-y-3 animate-fade-in">
                      <div className="grid grid-cols-2 gap-2">
                        <label className={`p-2 sm:p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                          addGreetingCard ? 'bg-rose/5 border-rose ring-1 ring-rose/30 shadow-2xs' : 'bg-white/80 border-canvas-line hover:border-canvas-line-hover'
                        }`}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={addGreetingCard}
                              onChange={(e) => setAddGreetingCard(e.target.checked)}
                              className="w-3.5 h-3.5 accent-rose rounded cursor-pointer shrink-0"
                            />
                            <span className="text-[11px] sm:text-xs font-medium text-bark truncate">Greeting Card</span>
                          </div>
                          <span className="text-[10px] font-bold text-rose shrink-0 ml-0.5">+₹{greetingCardFee}</span>
                        </label>

                        <label className={`p-2 sm:p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                          addPersonalMessage ? 'bg-rose/5 border-rose ring-1 ring-rose/30 shadow-2xs' : 'bg-white/80 border-canvas-line hover:border-canvas-line-hover'
                        }`}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={addPersonalMessage}
                              onChange={(e) => setAddPersonalMessage(e.target.checked)}
                              className="w-3.5 h-3.5 accent-rose rounded cursor-pointer shrink-0"
                            />
                            <span className="text-[11px] sm:text-xs font-medium text-bark truncate">Personal Note</span>
                          </div>
                          <span className="text-[10px] font-bold text-rose shrink-0 ml-0.5">+₹{personalisedMessageFee}</span>
                        </label>
                      </div>

                      {addGreetingCard && (
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-wider font-semibold text-ink-light flex justify-between">
                            <span>Handwritten Greeting Card Message</span>
                            <span>{greetingCardText.length}/200</span>
                          </label>
                          <textarea
                            rows={2}
                            maxLength={200}
                            value={greetingCardText}
                            onChange={(e) => setGreetingCardText(e.target.value)}
                            placeholder="Write your greeting note (e.g. Wishing you joy & happiness!)..."
                            className="w-full p-2.5 bg-white border border-canvas-line rounded-xl text-xs text-ink focus:outline-none focus:border-rose resize-none shadow-2xs"
                          />
                        </div>
                      )}

                      {addPersonalMessage && (
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-wider font-semibold text-ink-light flex justify-between">
                            <span>Personal Note (Tucked Inside Wrapping)</span>
                            <span>{personalMessageText.length}/150</span>
                          </label>
                          <textarea
                            rows={2}
                            maxLength={150}
                            value={personalMessageText}
                            onChange={(e) => setPersonalMessageText(e.target.value)}
                            placeholder="Personal note tucked inside wrapping (e.g. With love, always)..."
                            className="w-full p-2.5 bg-white border border-canvas-line rounded-xl text-xs text-ink focus:outline-none focus:border-rose resize-none shadow-2xs"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Immediate CTA Section & Ergonomic Stepper */}
                <div className="pt-3 border-t border-canvas-line/80 space-y-3">
                  <div className="flex items-center gap-2 sm:gap-3">
                    {/* Ergonomic Stepper */}
                    <div className="flex items-center border border-canvas-line bg-white/90 rounded-full p-1 shadow-2xs shrink-0">
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-sm font-semibold text-bark hover:bg-canvas rounded-full transition-colors focus-visible:outline-none cursor-pointer"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="px-2 sm:px-3 text-xs sm:text-sm text-bark min-w-[28px] sm:min-w-[32px] text-center font-medium font-mono" aria-live="polite">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity(quantity + 1)}
                        className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-sm font-semibold text-bark hover:bg-canvas rounded-full transition-colors focus-visible:outline-none cursor-pointer"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    {/* Primary Add to Collection CTA */}
                    <button
                      type="button"
                      onClick={handleAddToCart}
                      className="flex-1 min-w-0 py-3.5 sm:py-4 px-3 sm:px-6 text-xs sm:text-sm md:text-base bg-rose hover:bg-rose-deep text-linen border-none shadow-md rounded-full flex items-center justify-center gap-1.5 sm:gap-2 font-medium tracking-wide active:scale-95 transition-all cursor-pointer"
                    >
                      <ShoppingBag size={17} className="shrink-0" />
                      <span className="truncate">Add to Collection</span>
                      <span className="font-sans text-xs sm:text-sm font-normal opacity-90 shrink-0">({formatPrice(lineTotalPrice)})</span>
                    </button>
                  </div>

                  {/* WhatsApp Concierge Secondary */}
                  <WhatsAppButton
                    message={productEnquiryMessage(product)}
                    label="Inquire with Studio Concierge"
                    variant="outline"
                    className="w-full py-2.5 text-xs sm:text-sm rounded-full bg-white/80 hover:bg-white border-canvas-line"
                  />
                </div>

                {/* Delivery Estimation */}
                <div className="pt-2 border-t border-canvas-line/70">
                  <DeliveryEstimator preparationDays={product.preparationDays} />
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
      <section className="py-16 lg:py-24 bg-canvas/45 border-y border-canvas-line/80">
        <div className="container-lux">
          <Reveal>
            <div className="text-center max-w-xl mx-auto mb-12 lg:mb-16">
              <p className="text-[10px] uppercase tracking-[0.25em] text-rose font-semibold mb-1">
                The Atelier Process
              </p>
              <h2 className="font-serif text-3xl lg:text-4xl text-bark font-medium">From yarn to your doorstep</h2>
              <p className="text-xs sm:text-sm text-ink-light mt-2 leading-relaxed">
                Every petal is crocheted stitch-by-stitch by women artisans, steam-blocked, and packaged in keepsake gift boxes.
              </p>
            </div>
          </Reveal>
          <div className="relative">
            {/* Desktop / Tablet layout (sm:block): horizontal connected thread */}
            <div className="hidden sm:block">
              <div className="hidden lg:block absolute top-7 left-12 right-12 h-px bg-canvas-line" />
              <div className="grid grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-8 relative z-10">
                {howItWorksSteps.map((step, i) => (
                  <Reveal key={step.num} delay={i * 80}>
                    <div className="text-center group">
                      <div className="w-14 h-14 rounded-full bg-white border border-canvas-line/80 shadow-2xs flex items-center justify-center font-serif text-lg font-medium text-rose mx-auto mb-4 group-hover:border-rose group-hover:shadow-md transition-all">
                        {step.num}
                      </div>
                      <p className="text-sm font-medium text-bark leading-snug group-hover:text-rose-deep transition-colors">{step.label}</p>
                      <p className="text-xs text-ink-light mt-1.5 leading-relaxed">{step.desc}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>

            {/* Mobile layout (< 640px): Vertical Botanical Storyline connecting 01 to 05 */}
            <div className="sm:hidden relative pl-8 space-y-5 max-w-sm mx-auto">
              {/* Continuous vertical stem line */}
              <div className="absolute left-4 top-3 bottom-5 w-px bg-rose/30" />

              {howItWorksSteps.map((step, i) => (
                <Reveal key={step.num} delay={i * 60}>
                  <div className="relative flex items-start gap-3.5 group">
                    <div className="absolute -left-8 w-8 h-8 rounded-full bg-white border border-rose/40 shadow-xs flex items-center justify-center font-serif text-xs font-semibold text-rose z-10 group-hover:border-rose transition-colors">
                      {step.num}
                    </div>
                    <div className="pt-0.5">
                      <h4 className="text-xs font-semibold text-bark leading-snug">{step.label}</h4>
                      <p className="text-[11px] text-ink-light mt-0.5 leading-tight">{step.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Recently viewed */}
      <RecentlyViewed excludeCode={product.code} />

      {/* Related products */}
      {relatedProducts.length > 0 && (
        <section className="py-12 lg:py-24 bg-linen border-t border-canvas-line/80">
          <div className="container-lux">
            <Reveal>
              <div className="text-center max-w-xl mx-auto mb-8 lg:mb-12">
                <p className="text-[10px] uppercase tracking-[0.25em] text-rose font-semibold mb-1">
                  Atelier Pairings
                </p>
                <h2 className="font-serif text-2xl lg:text-4xl text-bark font-medium">You may also appreciate</h2>
                <p className="text-xs sm:text-sm text-ink-light mt-1.5">
                  Handcrafted companions from the same studio atelier.
                </p>
              </div>
            </Reveal>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
              {relatedProducts.map((p, i) => (
                <Reveal key={p.code} delay={i * 80}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Sticky Mobile Add to Bag Bar */}
      <div className="fixed bottom-16 left-0 right-0 z-40 sm:hidden bg-linen/95 backdrop-blur-md border-t border-canvas-line p-3 px-4 shadow-xl flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-serif text-bark truncate font-medium">{product.name}</p>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-sm font-serif font-bold text-rose-deep">{formatPrice(lineTotalPrice)}</span>
            {quantity > 1 && (
              <span className="text-[10px] text-ink-light font-sans">
                ({quantity} × {formatPrice(effectiveUnitPrice)})
              </span>
            )}
            {selectedPackaging !== 'standard' && (
              <span className="text-[9px] text-moss bg-moss/10 px-1.5 py-0.2 rounded-full font-sans font-medium">
                {currentPackaging.label.split(' ')[0]}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleAddToCart}
          className="px-5 py-2.5 bg-rose text-linen hover:bg-rose-deep text-xs uppercase tracking-wider font-semibold rounded-full shadow-md flex items-center gap-1.5 shrink-0 active:scale-95 transition-transform cursor-pointer"
        >
          <ShoppingBag size={14} /> Add to Bag
        </button>
      </div>
    </div>
  );
}
