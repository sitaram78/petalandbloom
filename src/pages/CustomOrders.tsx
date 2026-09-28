import { Link } from 'react-router-dom';
import { ArrowRight, MessageCircle, Sparkles } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Reveal from '@/components/Reveal';
import WhatsAppButton from '@/components/WhatsAppButton';
import SectionHeading from '@/components/SectionHeading';
import SEO from '@/components/SEO';
import { useSiteAssets, getDynamicAsset } from '@/context/SiteAssetsContext';
import { SITE_ASSET_KEYS } from '@/utils/siteAssetKeys';
import { addOns } from '@/data/site';
import { formatPrice } from '@/data/products';
import { customOrderMessage } from '@/utils/whatsapp';
import { trackEvent } from '@/utils/analytics';

export default function CustomOrders() {
  const { assets } = useSiteAssets();
  return (
    <div>
      <SEO
        title="Custom Crochet Bouquet — Made to Order"
        description="Create a custom crochet bouquet. Choose your flowers, colours, wrapping, and message. Handmade to order in India, pan-India delivery."
        canonicalPath="/custom"
      />

      <PageHeader
        label="Custom orders"
        title={<>Your flowers. Your colours. Your story.</>}
        subtitle="Not every story fits a standard bouquet. Create something uniquely yours — choose every detail, and we will handcraft it from scratch."
        image={getDynamicAsset(assets, SITE_ASSET_KEYS.CUSTOM_ORDERS_HERO)}
      />

      {/* Guided builder CTA */}
      <section className="py-12 bg-cream-50 border-b border-cream-200">
        <div className="container-lux text-center">
          <Reveal>
            <div className="inline-flex items-center gap-2 bg-terracotta-100 text-terracotta-700 px-4 py-2 rounded-sm text-sm font-medium mb-4">
              <Sparkles size={16} /> New: Step-by-step builder
            </div>
            <h2 className="heading-serif text-2xl lg:text-3xl mb-3">Build your bouquet step by step</h2>
            <p className="text-sm text-brown-500 max-w-md mx-auto mb-5">
              Prefer a guided experience? Our new builder walks you through each choice with live price calculation.
            </p>
            <Link to="/custom-bouquet" className="btn-primary">
              Try the guided builder <ArrowRight size={16} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* 4-step process */}
      <section className="py-16 lg:py-20 bg-cream-50">
        <div className="container-lux">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {[
              { num: '01', label: 'Choose your flowers', desc: 'Pick the types of blooms you love' },
              { num: '02', label: 'Choose your colours', desc: 'Match a mood, a room, or a person' },
              { num: '03', label: 'Add your message', desc: 'A handwritten note tucked inside' },
              { num: '04', label: 'We handcraft your bouquet', desc: 'Made to order in 5–10 days' },
            ].map((step, i) => (
              <Reveal key={step.num} delay={i * 100}>
                <div className="text-center lg:text-left">
                  <p className="font-serif text-5xl lg:text-6xl text-terracotta-300 mb-2">{step.num}</p>
                  <p className="text-base font-medium text-brown-700 leading-snug">{step.label}</p>
                  <p className="text-sm text-brown-400 mt-1">{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Add-ons */}
      <section className="py-16 lg:py-24 bg-cream-50">
        <div className="container-lux">
          <SectionHeading
            label="Add-ons"
            title={<>Make it a little more personal.</>}
            subtitle="Add a greeting card, a personalised message, name customisation, premium wrapping, or an extra flower."
          />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-12">
            {addOns.map((addon, i) => (
              <Reveal key={addon.name} delay={i * 60}>
                <div className="bg-cream-100 p-5 rounded-sm text-center h-full">
                  <h3 className="font-serif text-base text-brown-800 leading-tight">{addon.name}</h3>
                  <p className="text-xs text-brown-400 mt-1.5 leading-snug">{addon.description}</p>
                  <p className="text-sm font-medium text-terracotta-600 mt-3">
                    {addon.priceLabel || formatPrice(addon.price)}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-20 bg-terracotta-100">
        <div className="container-lux text-center">
          <Reveal>
            <h2 className="heading-serif text-3xl lg:text-4xl mb-4">
              Not sure where to start?
            </h2>
            <p className="text-brown-500 max-w-md mx-auto mb-6">
              Tell us about the person you are gifting for. We will help you choose the right flowers, colours, and size.
            </p>
            <WhatsAppButton
              message={customOrderMessage()}
              label="Talk to us on WhatsApp"
            />
          </Reveal>
        </div>
      </section>
    </div>
  );
}
