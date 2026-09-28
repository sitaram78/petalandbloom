import { Link } from 'react-router-dom';
import { Instagram, MessageCircle, Mail, Heart } from 'lucide-react';
import { brandInfo, footerPolicyLinks } from '@/data/site';
import { buildWhatsAppLink, generalEnquiryMessage } from '@/utils/whatsapp';
import { useNavigation } from '@/context/NavigationContext';

export default function Footer() {
  const { navItems } = useNavigation();
  const topLevelNav = navItems.filter(item => !item.parent_id).sort((a, b) => a.order - b.order);

  const infoPaths = ['/contact', '/custom'];
  const infoNav = navItems
    .filter(item => infoPaths.includes(item.path || ''))
    .sort((a, b) => a.order - b.order);

  return (
    <footer className="bg-bark-dark text-linen mt-10">
      <div className="container-lux py-10 lg:py-16">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-10">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <h3 className="font-serif text-2xl font-medium text-linen mb-4">
              THE PETAL<span className="text-rose"> &amp; </span>BLOOM
            </h3>
            <p className="text-sm text-linen/60 leading-relaxed mb-6">
              Handmade crochet blooms and thoughtful gifts, created slowly to be given meaningfully.
            </p>
            <p className="text-base font-serif italic text-rose/60">
              {brandInfo.secondaryMessage}
            </p>
          </div>



          {/* Shop links */}
          <div className="space-y-4">
            <h4 className="text-[10px] uppercase tracking-[0.2em] text-parchment-50/40 mb-4 font-semibold">Explore</h4>
            <ul className="space-y-2">
              {topLevelNav.map((link) => (
                <li key={link.id}>
                  <Link
                    to={link.path || '#'}
                    className="text-sm text-linen/60 hover:text-rose transition-colors duration-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>


          {/* Info links */}
          <div className="space-y-4">
            <h4 className="text-[10px] uppercase tracking-[0.2em] text-parchment-50/40 mb-4 font-semibold">Information</h4>
            <ul className="space-y-2">
              {infoNav.map((link) => (
                <li key={link.id}>
                  <Link
                    to={link.path || '#'}
                    className="text-sm text-linen/60 hover:text-rose transition-colors duration-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <h4 className="text-[10px] uppercase tracking-[0.2em] text-linen/40 mb-3 mt-8 font-semibold">Policies</h4>
            <ul className="space-y-2">
              {footerPolicyLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-sm text-linen/60 hover:text-rose transition-colors duration-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect */}
          <div className="space-y-4 col-span-2 lg:col-span-1">
            <h4 className="text-[10px] uppercase tracking-[0.2em] text-linen/40 mb-4 font-semibold">Connect</h4>
            <div className="flex items-center gap-3 mb-6">
              <a
                href={brandInfo.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full border border-linen/20 flex items-center justify-center hover:border-rose hover:text-rose transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2 focus-visible:ring-offset-bark-dark"
                aria-label="Follow on Instagram"
              >
                <Instagram size={18} strokeWidth={1.5} />
              </a>
              <a
                href={buildWhatsAppLink(generalEnquiryMessage())}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full border border-linen/20 flex items-center justify-center hover:border-rose hover:text-rose transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2 focus-visible:ring-offset-bark-dark"
                aria-label="Message on WhatsApp"
              >
                <MessageCircle size={18} strokeWidth={1.5} />
              </a>
              <span
                className="w-10 h-10 rounded-full border border-linen/20 flex items-center justify-center text-linen/30 cursor-not-allowed"
                aria-label="Email (coming soon)"
              >
                <Mail size={18} strokeWidth={1.5} />
              </span>
            </div>
            <p className="text-xs text-linen/50 leading-relaxed">
              {brandInfo.businessHours}
            </p>
            <p className="text-xs text-linen/30 mt-1 italic">
              {brandInfo.responseTime}
            </p>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-linen/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-linen/40 tracking-wide">
            © {new Date().getFullYear()} The Petal &amp; Bloom. Handmade in India.
          </p>
          <p className="text-xs text-linen/40 flex items-center gap-1.5">
            Made with <Heart size={12} className="text-rose" fill="currentColor" /> and yarn
          </p>
        </div>
      </div>
    </footer>

  );
}
