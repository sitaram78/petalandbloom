import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Reveal from '@/components/Reveal';

interface PolicyPageProps {
  title: string;
  label: string;
  sections: { heading: string; body: string[] }[];
}

export default function PolicyPage({ title, label, sections }: PolicyPageProps) {
  return (
    <div className="pt-20 lg:pt-24">
      <div className="container-lux py-4">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-brown-400 hover:text-terracotta-500 transition-colors">
          <ArrowLeft size={16} strokeWidth={1.5} />
          Back to home
        </Link>
      </div>

      <section className="container-lux pb-16">
        <Reveal>
          <p className="section-label mb-3">{label}</p>
          <h1 className="heading-serif text-4xl lg:text-5xl mb-10">{title}</h1>
        </Reveal>

        <div className="max-w-2xl space-y-8">
          {sections.map((section, i) => (
            <Reveal key={i} delay={i * 50}>
              <div>
                <h2 className="font-serif text-xl text-brown-800 mb-3">{section.heading}</h2>
                {section.body.map((para, j) => (
                  <p key={j} className="text-sm text-brown-500 leading-relaxed mb-3">{para}</p>
                ))}
              </div>
            </Reveal>
          ))}

          <div className="pt-6 border-t border-cream-300">
            <p className="text-sm text-brown-400">
              Questions about this policy? Reach out to us on WhatsApp or through our Contact page.
            </p>
            <Link to="/contact" className="inline-flex items-center gap-2 text-terracotta-500 hover:text-terracotta-600 transition-colors link-underline text-sm font-medium mt-2">
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
