import { Link } from 'react-router-dom';
import { ArrowRight, Heart, Sparkles, Clock } from 'lucide-react';
import Reveal from '@/components/Reveal';
import SectionHeading from '@/components/SectionHeading';
import WhatsAppButton from '@/components/WhatsAppButton';
import AtelierButton from '@/components/AtelierButton';
import { useSiteAssets, getDynamicAsset } from '@/context/SiteAssetsContext';
import { SITE_ASSET_KEYS } from '@/utils/siteAssetKeys';
import { generalEnquiryMessage } from '@/utils/whatsapp';
import SEO from '@/components/SEO';

export default function About() {
  const { assets } = useSiteAssets();
  return (
    <div className="bg-linen">
      <SEO
        title="About the Studio — The Petal & Bloom"
        description="A small handmade brand based in Bhubaneswar, focused on creating meaningful, long-lasting crochet blooms — one stitch at a time."
        canonicalPath="/about"
      />

      {/* Atelier About Header */}
      <section className="pt-16 pb-12 lg:pt-24 lg:pb-20">
        <div className="container-lux grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
          <div className="lg:col-span-7">
            <span className="font-serif italic text-sm text-rose mb-3 block uppercase tracking-widest">The Studio</span>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-7xl text-bark leading-tight mb-6">
              A little studio built around<br />thoughtful gifting.
            </h1>
            <p className="text-ink-light text-base sm:text-lg max-w-2xl leading-relaxed">
              The Petal & Bloom is a small handmade brand focused on creating meaningful, long-lasting gifts — one stitch at a time.
            </p>
          </div>
          <div className="lg:col-span-5">
            <div className="aspect-[16/9] rounded-atelier-img overflow-hidden shadow-soft">
              <img
                src={getDynamicAsset(assets, SITE_ASSET_KEYS.ABOUT_HERO)}
                alt="Studio crafting"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-16 lg:py-24 bg-linen">
        <div className="container-lux max-w-3xl">
          <Reveal>
            <div className="prose prose-lg max-w-none">
              <p className="font-serif text-2xl sm:text-3xl text-bark leading-relaxed mb-10">
                We are a small handmade brand. Not a big company, not a factory, not a marketplace.
              </p>
              <p className="text-ink-light leading-relaxed mt-6 text-lg font-light">
                The Petal & Bloom began with a simple idea: fresh flowers are beautiful, but they fade.
                A handmade crochet bloom does not. It sits on a desk, a shelf, a bedside table —
                a quiet reminder of a moment worth keeping.
              </p>
              <p className="text-ink-light leading-relaxed mt-6 text-lg font-light">
                Every flower we make is shaped stitch by stitch by our small team of crochet makers.
                Every bouquet takes time. Every finished piece carries the character of the hands that made it —
                the slight variations, the soft imperfections, the warmth that only handmade things have.
              </p>
              <p className="text-ink-light leading-relaxed mt-6 text-lg font-light">
                We are based in India and we ship across the country. We make flowers, bouquets,
                keyrings, bags, home decor, and gift boxes. We take custom orders. We take bulk orders.
                We take the kind of orders where you message us and say, "I want something for someone,
                and I'm not sure what" — and we help you figure it out.
              </p>
              <p className="font-serif text-2xl text-bark leading-relaxed mt-16 italic border-l-4 border-rose pl-6 text-rose-deep">
                We believe a gift should feel personal. We believe handmade means something.
                And we believe that flowers that never fade are worth the time they take to make.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 lg:py-24 bg-canvas">
        <div className="container-lux">
          <SectionHeading
            label="What we believe"
            title="The little things that matter"
          />
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mt-12">
            {[
              {
                icon: Heart,
                title: 'Handmade means something',
                desc: 'Every petal is shaped by hand. Every piece is made by a person, not a machine. The slight variations are not flaws — they are the character of handmade work.',
              },
              {
                icon: Clock,
                title: 'Made slowly, made well',
                desc: 'We do not rush. A single flower takes hours. A bouquet takes days. We would rather make something beautiful slowly than something ordinary quickly.',
              },
              {
                icon: Sparkles,
                title: 'Personal, not mass-produced',
                desc: 'We take custom orders, custom colours, and personal messages. We help you choose. We make things for specific people and specific moments.',
              },
            ].map((value, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="bg-linen p-8 rounded-atelier-panel border border-canvas-line shadow-soft h-full transition-all duration-300 hover:shadow-md">
                  <div className="w-12 h-12 rounded-full bg-canvas flex items-center justify-center mb-5 text-rose">
                    <value.icon size={22} strokeWidth={1.5} />
                  </div>
                  <h3 className="font-serif text-xl text-bark mb-3">{value.title}</h3>
                  <p className="text-sm text-ink-light leading-relaxed">{value.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Process images */}
      <section className="py-16 lg:py-24 bg-linen">
        <div className="container-lux">
          <SectionHeading
            label="The process"
            title="Made by hand, stitch by stitch"
            subtitle="From yarn to finished bloom — every step happens in our small studio."
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            {[
              { img: getDynamicAsset(assets, SITE_ASSET_KEYS.ABOUT_PROCESS_YARN), label: 'Yarn' },
              { img: getDynamicAsset(assets, SITE_ASSET_KEYS.ABOUT_PROCESS_TEXTURE), label: 'Stitch by stitch' },
              { img: getDynamicAsset(assets, SITE_ASSET_KEYS.ABOUT_PROCESS_HANDS), label: 'Shaped by hand' },
              { img: getDynamicAsset(assets, SITE_ASSET_KEYS.ABOUT_PROCESS_FINISHED), label: 'Finished bloom' },
            ].map((step, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="group cursor-default">
                  <div className="aspect-[3/4] overflow-hidden rounded-atelier-img shadow-soft transition-transform duration-700 group-hover:scale-[1.02]">
                    <img src={step.img} alt={step.label} loading="lazy" className="w-full h-full object-cover" />
                  </div>
                  <p className="text-sm text-bark mt-4 text-center font-serif text-lg">{step.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-20 bg-bark-dark relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <img src={getDynamicAsset(assets, SITE_ASSET_KEYS.ABOUT_CTA_BG)} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="container-lux relative z-10 text-center">
          <Reveal>
            <h2 className="font-serif text-3xl lg:text-5xl text-linen mb-6">
              Let's make something for you.
            </h2>
            <p className="text-linen/70 max-w-md mx-auto mb-10 text-lg font-light">
              Browse our blooms, start a custom order, or just say hello on WhatsApp.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <AtelierButton variant="primary" className="bg-linen text-bark hover:bg-canvas px-10 py-4">
                Shop the blooms <ArrowRight size={18} className="ml-2" />
              </AtelierButton>
              <WhatsAppButton
                message={generalEnquiryMessage()}
                label="Say hello on WhatsApp"
                variant="outline"
                className="!border-linen/30 !text-linen hover:!bg-linen hover:!text-bark px-10 py-4"
              />
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
