import { useState, useMemo } from 'react';
import { ArrowLeft, ArrowRight, Check, MessageCircle, Clock, PenTool, Flower2, Palette, Package, FileText } from 'lucide-react';
import Reveal from '@/components/Reveal';
import WhatsAppButton from '@/components/WhatsAppButton';
import AtelierButton from '@/components/AtelierButton';
import { useSiteAssets, getDynamicAsset } from '@/context/SiteAssetsContext';
import { SITE_ASSET_KEYS } from '@/utils/siteAssetKeys';
import { formatPrice } from '@/data/products';
import { customBouquetBuilderMessage } from '@/utils/whatsapp';
import { trackEvent } from '@/utils/analytics';
import SEO from '@/components/SEO';

const bouquetSizes = [
  { label: '1 flower', flowers: 1, price: 499 },
  { label: '2 flowers', flowers: 2, price: 699 },
  { label: '3 flowers', flowers: 3, price: 899 },
  { label: '5 flowers', flowers: 5, price: 1299 },
  { label: '7 flowers', flowers: 7, price: 1599 },
  { label: '9 flowers', flowers: 9, price: 1999 },
];

const flowerTypes = ['Rose', 'Tulip', 'Daisy', 'Sunflower', 'Mixed', 'Surprise me'];
const colorOptions = ['Red', 'Pink', 'White', 'Lavender', 'Yellow', 'Cream', 'Sage', 'Custom mix'];
const wrappingOptions = [
  { label: 'Standard', price: 0 },
  { label: 'Premium', price: 79 },
];
const messageOptions = [
  { label: 'No message', price: 0 },
  { label: 'Personalised card', price: 49 },
];

const COLOR_MAP: Record<string, { active: string; inactive: string; textActive: string; textInactive: string }> = {
  'Red': { active: 'bg-rose-deep', inactive: 'bg-rose/20', textActive: 'text-linen', textInactive: 'text-rose-deep' },
  'Pink': { active: 'bg-rose', inactive: 'bg-rose/20', textActive: 'text-linen', textInactive: 'text-rose' },
  'White': { active: 'bg-canvas', inactive: 'bg-linen', textActive: 'text-bark', textInactive: 'text-bark/60' },
  'Lavender': { active: 'bg-purple-400', inactive: 'bg-purple-100', textActive: 'text-white', textInactive: 'text-purple-600' },
  'Yellow': { active: 'bg-yellow-500', inactive: 'bg-yellow-100', textActive: 'text-white', textInactive: 'text-yellow-700' },
  'Cream': { active: 'bg-canvas', inactive: 'bg-linen', textActive: 'text-bark', textInactive: 'text-bark/60' },
  'Sage': { active: 'bg-moss', inactive: 'bg-moss/20', textActive: 'text-linen', textInactive: 'text-moss' },
  'Custom mix': { active: 'bg-bark', inactive: 'bg-canvas', textActive: 'text-linen', textInactive: 'text-bark' },
};

export default function CustomBouquetBuilder() {
  const { assets } = useSiteAssets();
  const [step, setStep] = useState(0);
  const [size, setSize] = useState('');
  const [flowers, setFlowers] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [wrapping, setWrapping] = useState('');
  const [message, setMessage] = useState('');
  const [customMessage, setCustomMessage] = useState('');

  const totalSteps = 6;
  const steps = ['Size', 'Flowers', 'Colours', 'Wrapping', 'Message', 'Review'];

  const estimatedPrice = useMemo(() => {
    const sizeObj = bouquetSizes.find((s) => s.label === size);
    if (!sizeObj) return 0;
    let total = sizeObj.price;
    const wrapObj = wrappingOptions.find((w) => w.label === wrapping);
    if (wrapObj) total += wrapObj.price;
    const msgObj = messageOptions.find((m) => m.label === message);
    if (msgObj) total += msgObj.price;
    return total;
  }, [size, wrapping, message]);

  const preparationTime = useMemo(() => {
    const sizeObj = bouquetSizes.find((s) => s.label === size);
    if (!sizeObj) return '';
    if (sizeObj.flowers >= 7) return '6–10 days';
    if (sizeObj.flowers >= 3) return '5–7 days';
    return '3–5 days';
  }, [size]);

  const toggleArrayItem = (arr: string[], item: string, setter: (v: string[]) => void) => {
    if (arr.includes(item)) {
      setter(arr.filter((i) => i !== item));
    } else {
      setter([...arr, item]);
    }
  };

  const canProceed = useMemo(() => {
    switch (step) {
      case 0: return !!size;
      case 1: return flowers.length > 0;
      case 2: return colors.length > 0;
      case 3: return !!wrapping;
      case 4: return !!message;
      case 5: return true;
      default: return false;
    }
  }, [step, size, flowers, colors, wrapping, message]);

  const handleStart = () => {
    trackEvent('custom_builder_started');
  };

  const handleComplete = () => {
    trackEvent('custom_builder_completed', { size, estimatedPrice });
  };

  const buildMessage = () => {
    return customBouquetBuilderMessage({
      size,
      flowers,
      colors,
      wrapping,
      message: message === 'Personalised card' ? (customMessage || 'Yes') : 'No',
      estimatedPrice,
    });
  };

  return (
    <div className="bg-linen min-h-screen">
      <SEO
        title="Custom Bouquet Builder — The Petal & Bloom"
        description="Co-create your own unique crochet bouquet. Choose the size, flowers, colours, and details for a truly personal gift."
        canonicalPath="/custom-bouquet"
      />

      {/* Atelier Builder Header */}
      <section className="pt-16 pb-12 lg:pt-24 lg:pb-20">
        <div className="container-lux grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
          <div className="lg:col-span-7">
            <span className="font-serif italic text-sm text-rose mb-3 block uppercase tracking-widest">Studio Table</span>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-7xl text-bark leading-tight mb-6">
              Co-create your <br />own bloom.
            </h1>
            <p className="text-ink-light text-base sm:text-lg max-w-2xl leading-relaxed">
              A bespoke experience for those who see flowers as poetry. Assemble your arrangement step by step, with our studio assistant guiding you.
            </p>
          </div>
          <div className="lg:col-span-5">
            <div className="aspect-[16/9] rounded-atelier-img overflow-hidden shadow-soft">
              <img
                src={getDynamicAsset(assets, SITE_ASSET_KEYS.CUSTOM_BUILDER_HERO)}
                alt="Custom bouquet building"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 lg:py-24">
        <div className="container-lux grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24">

          {/* Left: The Studio Manifest (Composition) */}
          <div className="lg:col-span-4">
            <div className="sticky top-32 space-y-8">
              <div className="glass-panel border border-canvas-line p-8 rounded-atelier-panel shadow-soft animate-fade-up relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <PenTool size={80} className="text-bark" />
                </div>

                <h3 className="font-serif text-2xl text-bark mb-8 flex items-center gap-3">
                  The Composition
                </h3>

                <div className="space-y-6">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="w-10 h-10 rounded-full bg-canvas flex items-center justify-center text-rose border border-canvas-line shadow-sm">
                      <Clock size={16} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1">
                      <span className="block text-[10px] uppercase tracking-wider text-ink-light/60 font-semibold">Size</span>
                      <span className="text-bark font-medium">{size || 'Not selected'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="w-10 h-10 rounded-full bg-canvas flex items-center justify-center text-rose border border-canvas-line shadow-sm">
                      <Flower2 size={16} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1">
                      <span className="block text-[10px] uppercase tracking-wider text-ink-light/60 font-semibold">Flora</span>
                      <span className="text-bark font-medium">{flowers.length > 0 ? flowers.join(', ') : 'Not selected'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="w-10 h-10 rounded-full bg-canvas flex items-center justify-center text-rose border border-canvas-line shadow-sm">
                      <Palette size={16} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1">
                      <span className="block text-[10px] uppercase tracking-wider text-ink-light/60 font-semibold">Palette</span>
                      <span className="text-bark font-medium">{colors.length > 0 ? colors.join(', ') : 'Not selected'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="w-10 h-10 rounded-full bg-canvas flex items-center justify-center text-rose border border-canvas-line shadow-sm">
                      <Package size={16} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1">
                      <span className="block text-[10px] uppercase tracking-wider text-ink-light/60 font-semibold">Wrap</span>
                      <span className="text-bark font-medium">{wrapping || 'Not selected'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="w-10 h-10 rounded-full bg-canvas flex items-center justify-center text-rose border border-canvas-line shadow-sm">
                      <FileText size={16} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1">
                      <span className="block text-[10px] uppercase tracking-wider text-ink-light/60 font-semibold">Note</span>
                      <span className="text-bark font-medium">{message || 'Not selected'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-10 pt-8 border-t border-canvas-line flex justify-between items-end">
                  <div className="space-y-1">
                    <span className="block text-[10px] uppercase tracking-wider text-ink-light/60 font-semibold">Estimated Value</span>
                    <span className="font-serif text-4xl text-bark">{formatPrice(estimatedPrice)}</span>
                  </div>
                  {preparationTime && (
                    <div className="text-right">
                      <span className="block text-[10px] uppercase tracking-wider text-ink-light/60 font-semibold mb-1">Timeline</span>
                      <span className="text-xs text-ink-light font-medium">{preparationTime}</span>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-xs text-ink-light/60 text-center italic px-4 mt-8">
                "A bouquet is a silent conversation between the giver and the bloom."
              </p>
            </div>
          </div>

          {/* Right: The Tool Tray (Steps) */}
          <div className="lg:col-span-8">
            <div className="max-w-2xl mx-auto">
              {/* Progress */}
              <div className="flex items-center justify-between mb-16">
                {steps.map((s, i) => (
                  <div key={s} className="flex flex-col items-center gap-3 group">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-500 shadow-sm ${
                        i < step
                          ? 'bg-rose text-linen'
                          : i === step
                          ? 'bg-bark text-linen ring-4 ring-bark/10'
                          : 'bg-canvas text-ink-light'
                      }`}
                    >
                      {i < step ? <Check size={16} strokeWidth={2.5} /> : i + 1}
                    </div>
                    <span className={`text-[10px] uppercase tracking-widest transition-colors ${
                      i === step ? 'text-bark font-bold' : 'text-ink-light/40'
                    }`}>
                      {s}
                    </span>
                  </div>
                ))}
              </div>

              <div className="min-h-[450px]">
                {/* Step 1: Size */}
                {step === 0 && (
                  <Reveal>
                    <h2 className="font-serif text-4xl text-center text-bark mb-12">Determine the scale</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                      {bouquetSizes.map((s) => (
                        <button
                          key={s.label}
                          onClick={() => setSize(s.label)}
                          className={`p-8 rounded-atelier-btn border text-center transition-all duration-500 shadow-sm ${
                            size === s.label
                              ? 'bg-bark text-linen border-bark shadow-md scale-[1.02]'
                              : 'bg-canvas text-bark border-canvas-line hover:border-rose hover:bg-linen'
                          }`}
                        >
                          <span className="block font-serif text-xl">{s.label}</span>
                          <span className={`text-sm mt-2 block ${size === s.label ? 'text-linen/70' : 'text-rose font-medium'}`}>
                            {formatPrice(s.price)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </Reveal>
                )}

                {/* Step 2: Flowers */}
                {step === 1 && (
                  <Reveal>
                    <h2 className="font-serif text-4xl text-center text-bark mb-4">Select your flora</h2>
                    <p className="text-sm text-ink-light text-center mb-12 italic font-light">Combine species to create your own narrative</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                      {flowerTypes.map((f) => (
                        <button
                          key={f}
                          onClick={() => toggleArrayItem(flowers, f, setFlowers)}
                          className={`p-8 rounded-atelier-btn border text-center transition-all duration-500 shadow-sm ${
                            flowers.includes(f)
                              ? 'bg-bark text-linen border-bark shadow-md scale-[1.02]'
                              : 'bg-canvas text-bark border-canvas-line hover:border-rose hover:bg-linen'
                          }`}
                        >
                          <span className="font-serif text-xl">{f}</span>
                          {flowers.includes(f) && <Check size={18} className="inline ml-2" />}
                        </button>
                      ))}
                    </div>
                  </Reveal>
                )}

                {/* Step 3: Colours */}
                {step === 2 && (
                  <Reveal>
                    <h2 className="font-serif text-4xl text-center text-bark mb-4">Define the palette</h2>
                    <p className="text-sm text-ink-light text-center mb-12 italic font-light">Choose the tones that speak your emotion</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                      {colorOptions.map((c) => {
                        const style = COLOR_MAP[c] || COLOR_MAP['Custom mix'];
                        const isActive = colors.includes(c);
                        return (
                          <button
                            key={c}
                            onClick={() => toggleArrayItem(colors, c, setColors)}
                            className={`p-6 rounded-atelier-btn border text-center transition-all duration-500 shadow-sm ${
                              isActive
                                ? `${style.active} ${style.textActive} border-transparent shadow-md scale-[1.02]`
                                : `${style.inactive} ${style.textInactive} border-canvas-line hover:border-rose`
                            }`}
                          >
                            <span className="text-sm font-medium uppercase tracking-wider">{c}</span>
                            {isActive && <Check size={16} className="inline ml-1.5" />}
                          </button>
                        );
                      })}
                    </div>
                  </Reveal>
                )}

                {/* Step 4: Wrapping */}
                {step === 3 && (
                  <Reveal>
                    <h2 className="font-serif text-4xl text-center text-bark mb-12">Choose the finish</h2>
                    <div className="grid grid-cols-2 gap-8 max-w-md mx-auto">
                      {wrappingOptions.map((w) => (
                        <button
                          key={w.label}
                          onClick={() => setWrapping(w.label)}
                          className={`p-10 rounded-atelier-btn border text-center transition-all duration-500 shadow-sm ${
                            wrapping === w.label
                              ? 'bg-bark text-linen border-bark shadow-md scale-[1.02]'
                              : 'bg-canvas text-bark border-canvas-line hover:border-rose hover:bg-linen'
                          }`}
                        >
                          <span className="block font-serif text-2xl">{w.label}</span>
                          <span className={`text-sm mt-2 block ${wrapping === w.label ? 'text-linen/70' : 'text-rose font-medium'}`}>
                            {w.price === 0 ? 'Included' : formatPrice(w.price)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </Reveal>
                )}

                {/* Step 5: Message */}
                {step === 4 && (
                  <Reveal>
                    <h2 className="font-serif text-4xl text-center text-bark mb-12">Add a handwritten note</h2>
                    <div className="grid grid-cols-2 gap-8 max-w-md mx-auto mb-10">
                      {messageOptions.map((m) => (
                        <button
                          key={m.label}
                          onClick={() => setMessage(m.label)}
                          className={`p-8 rounded-atelier-btn border text-center transition-all duration-500 shadow-sm ${
                            message === m.label
                              ? 'bg-bark text-linen border-bark shadow-md scale-[1.02]'
                              : 'bg-canvas text-bark border-canvas-line hover:border-rose hover:bg-linen'
                          }`}
                        >
                          <span className="block font-serif text-lg">{m.label}</span>
                          <span className={`text-xs mt-1 block ${message === m.label ? 'text-linen/70' : 'text-rose font-medium'}`}>
                            {m.price === 0 ? 'Complimentary' : formatPrice(m.price)}
                          </span>
                        </button>
                      ))}
                    </div>
                    {message === 'Personalised card' && (
                      <div className="max-w-md mx-auto">
                        <textarea
                          value={customMessage}
                          onChange={(e) => setCustomMessage(e.target.value)}
                          placeholder="Write your heart out..."
                          rows={5}
                          className="input-field resize-none text-bark bg-linen border-canvas-line focus:border-rose shadow-sm"
                        />
                      </div>
                    )}
                  </Reveal>
                )}

                {/* Step 6: Review */}
                {step === 5 && (
                  <Reveal>
                    <h2 className="font-serif text-4xl text-center text-bark mb-12">The Final Review</h2>
                    <div className="glass-panel p-10 rounded-atelier-panel border border-canvas-line space-y-6 max-w-md mx-auto shadow-soft">
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-light font-medium">Bouquet size</span>
                        <span className="text-bark font-semibold">{size}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-light font-medium">Flora</span>
                        <span className="text-bark font-semibold">{flowers.join(', ')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-light font-medium">Palette</span>
                        <span className="text-bark font-semibold">{colors.join(', ')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-light font-medium">Wrapping</span>
                        <span className="text-bark font-semibold">{wrapping}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-light font-medium">Message</span>
                        <span className="text-bark font-semibold">
                          {message === 'Personalised card' ? (customMessage || 'Personalised card') : message}
                        </span>
                      </div>
                      <div className="pt-6 border-t border-canvas-line flex justify-between items-center">
                        <span className="text-sm text-ink-light font-medium">Total Estimated Value</span>
                        <span className="font-serif text-3xl text-bark">{formatPrice(estimatedPrice)}</span>
                      </div>
                    </div>

                    <div className="mt-12 flex flex-col sm:flex-row gap-6 justify-center">
                      <WhatsAppButton
                        message={buildMessage()}
                        label="Send to Studio Concierge"
                        className="flex-1 max-w-xs py-5 text-lg"
                      />
                      <AtelierButton variant="ghost" onClick={() => setStep(0)} className="max-w-xs py-5 text-lg">
                        Refine Selection
                      </AtelierButton>
                    </div>
                  </Reveal>
                )}
              </div>

              {/* Navigation */}
              {step < 5 && (
                <div className="flex justify-between mt-16">
                  <AtelierButton
                    variant="ghost"
                    onClick={() => {
                      if (step === 0) handleStart();
                      step > 0 && setStep(step - 1);
                    }}
                    disabled={step === 0}
                    className={step === 0 ? 'opacity-0 pointer-events-none' : ''}
                  >
                    <ArrowLeft size={18} className="mr-2" /> Back
                  </AtelierButton>
                  <AtelierButton
                    variant="primary"
                    onClick={() => {
                      if (step === 0) handleStart();
                      if (canProceed) setStep(step + 1);
                    }}
                    disabled={!canProceed}
                    className={!canProceed ? 'opacity-50 cursor-not-allowed' : ''}
                  >
                    Next Step <ArrowRight size={18} className="ml-2" />
                  </AtelierButton>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
