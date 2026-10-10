import { useState, useEffect, useRef } from 'react';
import { useParams, Link, Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Heart, ShoppingBag, Clock, Truck,
  Check, Gift, Sparkles, Star, Palette, Search
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

export default function ProductDetail() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { products, getProductByCode, loading } = useProducts();
  const product = code ? getProductByCode(code) : undefined;
  const { addItem } = useCart();
  const { toggleItem, isWishlisted } = useWishlist();
  const { addRecentlyViewed } = useRecentlyViewed();

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
  const [giftWrap, setGiftWrap] = useState(false);
  const [personalMessage, setPersonalMessage] = useState('');

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

  const handleAddToCart = () => {
    addItem(product, {
      color: selectedColor || undefined,
      quantity,
      giftWrap,
      message: personalMessage || undefined,
    });
    trackEvent('add_to_cart', { code: product.code, quantity });
  };

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

                <div className="flex items-center gap-6 mb-10">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-serif text-4xl text-rose-deep">
                      {product.priceLabel || formatPrice(product.price)}
                    </span>
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

                <div className="space-y-6 mb-10">
                  <p className="text-lg text-ink-light leading-relaxed font-light">
                    {product.description}
                  </p>
                  {product.longDescription && (
                    <div className="p-6 bg-canvas rounded-sm border-l-4 border-rose/50 italic text-ink-light leading-relaxed">
                      {product.longDescription}
                    </div>
                  )}

                  {(product.featured || product.bouquetSize || product.recipients?.length) && (
                    <div className="space-y-4 pt-2">
                      {product.featured && (
                        <div className="inline-flex items-center gap-2 rounded-full border border-rose/30 bg-rose/5 px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-rose">
                          <Sparkles size={12} /> Featured in Collection
                        </div>
                      )}

                      {product.bouquetSize && (
                        <div className="text-sm text-bark">
                          <span className="font-medium uppercase tracking-wider text-ink-light mr-2">Product size</span>
                          {product.bouquetSize}
                        </div>
                      )}

                      {product.recipients && product.recipients.length > 0 && (
                        <div className="text-sm text-bark">
                          <span className="font-medium uppercase tracking-wider text-ink-light mr-2">Ideal for</span>
                          <div className="inline-flex flex-wrap gap-2 mt-2">
                            {product.recipients.map((recipient) => (
                              <span key={recipient} className="rounded-full border border-canvas-line bg-canvas px-2.5 py-1 text-xs text-bark">
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

                  <div className="space-y-4">
                    <label htmlFor="personal-message" className="block text-sm font-medium text-bark uppercase tracking-wider">
                      Personalised message <span className="text-ink-light font-normal lowercase italic"> (optional, ₹39)</span>
                    </label>
                    <div className="p-4 border-2 border-dashed border-canvas-line rounded-atelier-panel bg-linen/50">
                      <textarea
                        id="personal-message"
                        value={personalMessage}
                        onChange={(e) => setPersonalMessage(e.target.value)}
                        placeholder="For Amma, happy 60th — with love"
                        className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm text-ink-light placeholder-ink-light/40 resize-none h-12 leading-relaxed"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-4 cursor-pointer group">
                    <button
                      onClick={() => setGiftWrap(!giftWrap)}
                      className={`w-6 h-6 rounded-sm border-2 flex items-center justify-center transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose ${
                        giftWrap ? 'bg-moss border-moss' : 'border-canvas-line group-hover:border-rose'
                      }`}
                      aria-label="Toggle gift wrapping"
                      aria-pressed={giftWrap}
                    >
                      {giftWrap && <Check size={14} className="text-linen" strokeWidth={3} />}
                    </button>
                    <span className="text-sm text-ink-light group-hover:text-bark transition-colors">
                      Add premium gift wrapping <span className="text-ink-light/60">(₹79)</span>
                    </span>
                  </label>
                </div>

                {/* Delivery Estimation */}
                <div className="mb-10">
                  <DeliveryEstimator preparationDays={product.preparationDays} />
                </div>

                {/* CTAs */}
                <div className="flex flex-col gap-4">
                  <AtelierButton onClick={handleAddToCart} className="w-full py-6 text-lg bg-rose hover:bg-rose-deep text-linen border-none">
                    <ShoppingBag size={22} className="mr-2" />
                    Add to Collection
                  </AtelierButton>
                  <WhatsAppButton
                    message={productOrderMessage(product)}
                    label="Order via Gift Concierge"
                    variant="outline"
                    className="w-full py-6 text-lg border-bark text-bark hover:bg-bark hover:text-linen"
                  />
                  <WhatsAppButton
                    message={productEnquiryMessage(product)}
                    label="Inquire about this piece"
                    variant="outline"
                    className="w-full py-6 text-lg"
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Cross-sell */}
      <CrossSell />

      {/* Story and Detail Sections */}
      {product.whatsIncluded && product.whatsIncluded.length > 0 && (
        <section className="py-24 lg:py-32 bg-canvas">
          <div className="container-lux">
            <div className="grid md:grid-cols-2 gap-16">
              <Reveal delay={100}>
                <SectionHeading
                  label="The Package"
                  title="What is included"
                  center={false}
                />
                <ul className="space-y-4 mt-6">
                  {product.whatsIncluded.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-ink-light">
                      <span className="w-5 h-5 rounded-full bg-moss-soft flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check size={12} className="text-linen" strokeWidth={2.5} />
                      </span>
                      <span className="text-sm leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </div>
        </section>
      )}

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
          <p className="text-sm font-serif font-bold text-rose-deep">{formatPrice(product.price)}</p>
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
