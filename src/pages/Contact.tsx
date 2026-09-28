import { useState } from 'react';
import { Instagram, MessageCircle, Mail, Clock, Send } from 'lucide-react';
import Reveal from '@/components/Reveal';
import WhatsAppButton from '@/components/WhatsAppButton';
import AtelierButton from '@/components/AtelierButton';
import { brandInfo } from '@/data/site';
import { useSiteAssets, getDynamicAsset } from '@/context/SiteAssetsContext';
import { SITE_ASSET_KEYS } from '@/utils/siteAssetKeys';
import { buildWhatsAppLink, generalEnquiryMessage } from '@/utils/whatsapp';
import SEO from '@/components/SEO';

export default function Contact() {
  const { assets } = useSiteAssets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [product, setProduct] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parts = [
      'Hi The Petal & Bloom! I have an enquiry.',
      name && `Name: ${name}`,
      email && `Email: ${email}`,
      product && `Product of interest: ${product}`,
      message && `Message: ${message}`,
    ].filter(Boolean);
    const link = buildWhatsAppLink(parts.join('\n'));
    window.open(link, '_blank');
  };

  return (
    <div className="bg-linen min-h-screen">
      <SEO
        title="Contact the Studio — The Petal & Bloom"
        description="Message us on WhatsApp for the fastest response, or send us an enquiry. We are here to help you find the perfect bloom."
        canonicalPath="/contact"
      />

      {/* Atelier Contact Header */}
      <section className="pt-16 pb-12 lg:pt-24 lg:pb-20">
        <div className="container-lux grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
          <div className="lg:col-span-7">
            <span className="font-serif italic text-sm text-rose mb-3 block uppercase tracking-widest">Get in touch</span>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-7xl text-bark leading-tight mb-6">
              Start an order, <br />or just say hello.
            </h1>
            <p className="text-ink-light text-base sm:text-lg max-w-2xl leading-relaxed">
              Message us on WhatsApp for the fastest response, or send us an enquiry below. We typically reply within a few hours during business hours.
            </p>
          </div>
          <div className="lg:col-span-5">
            <div className="aspect-[16/9] rounded-atelier-img overflow-hidden shadow-soft">
              <img
                src={getDynamicAsset(assets, SITE_ASSET_KEYS.CONTACT_HERO)}
                alt="Studio contact"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-24 bg-linen">
        <div className="container-lux">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            {/* Contact methods */}
            <Reveal>
              <h2 className="font-serif text-3xl text-bark mb-8">Talk to the studio</h2>
              <div className="space-y-4">
                {/* WhatsApp */}
                <div className="flex items-center gap-5 p-6 bg-canvas rounded-atelier-panel border border-canvas-line transition-all duration-300 hover:border-rose/40">
                  <div className="w-12 h-12 rounded-full bg-moss/10 flex items-center justify-center flex-shrink-0 text-moss">
                    <MessageCircle size={22} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-serif text-lg text-bark">WhatsApp</h3>
                    <p className="text-sm text-ink-light mt-1">The fastest way to reach us. Order, enquire, or ask anything.</p>
                    <a
                      href={buildWhatsAppLink(generalEnquiryMessage())}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-rose hover:text-rose-deep mt-2 inline-block font-medium link-underline"
                    >
                      Message on WhatsApp →
                    </a>
                  </div>
                </div>

                {/* Instagram */}
                <div className="flex items-center gap-5 p-6 bg-canvas rounded-atelier-panel border border-canvas-line transition-all duration-300 hover:border-rose/40">
                  <div className="w-12 h-12 rounded-full bg-rose/10 flex items-center justify-center flex-shrink-0 text-rose">
                    <Instagram size={22} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-serif text-lg text-bark">Instagram</h3>
                    <p className="text-sm text-ink-light mt-1">Follow our latest blooms and share your gifts with us.</p>
                    <a
                      href={brandInfo.instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-rose hover:text-rose-deep mt-2 inline-block font-medium link-underline"
                    >
                      {brandInfo.instagram} →
                    </a>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-center gap-5 p-6 bg-canvas rounded-atelier-panel border border-canvas-line transition-all duration-300 hover:border-rose/40">
                  <div className="w-12 h-12 rounded-full bg-canvas-line/30 flex items-center justify-center flex-shrink-0 text-ink-light">
                    <Mail size={22} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-serif text-lg text-bark">Email</h3>
                    <p className="text-sm text-ink-light mt-1">
                      Email address coming soon. For now, please reach us on WhatsApp or Instagram.
                    </p>
                    <span className="text-xs text-ink-light/50 mt-2 inline-block italic">Coming soon</span>
                  </div>
                </div>

                {/* Business hours */}
                <div className="flex items-center gap-5 p-6 bg-canvas rounded-atelier-panel border border-canvas-line transition-all duration-300 hover:border-rose/40">
                  <div className="w-12 h-12 rounded-full bg-bark/10 flex items-center justify-center flex-shrink-0 text-bark">
                    <Clock size={22} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-serif text-lg text-bark">Business hours</h3>
                    <p className="text-sm text-ink-light mt-1">{brandInfo.businessHours}</p>
                    <p className="text-xs text-ink-light/60 mt-1 italic">{brandInfo.responseTime}</p>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Enquiry form */}
            <Reveal delay={150}>
              <div className="bg-canvas p-8 lg:p-10 rounded-atelier-panel border border-canvas-line shadow-soft">
                <h2 className="font-serif text-3xl text-bark mb-2">Send an enquiry</h2>
                <p className="text-sm text-ink-light mb-8">
                  Fill in the form and we will open a WhatsApp chat with your details pre-filled.
                </p>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-medium text-bark mb-2 uppercase tracking-wider">Your name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        className="input-field"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-bark mb-2 uppercase tracking-wider">Email (optional)</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="input-field"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-bark mb-2 uppercase tracking-wider">Product of interest (optional)</label>
                    <input
                      type="text"
                      value={product}
                      onChange={(e) => setProduct(e.target.value)}
                      placeholder="e.g. Trio of Petals, Custom Bouquet"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-bark mb-2 uppercase tracking-wider">Message</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tell us what you are looking for..."
                      rows={4}
                      className="input-field resize-none"
                      required
                    />
                  </div>
                  <AtelierButton type="submit" className="w-full py-4">
                    <Send size={18} className="mr-2" />
                    Send enquiry
                  </AtelierButton>
                </form>
                <div className="mt-8 pt-8 border-t border-canvas-line text-center">
                  <p className="text-xs text-ink-light mb-4 italic">Or reach us directly</p>
                  <WhatsAppButton message={generalEnquiryMessage()} label="Order on WhatsApp" className="w-full" />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
