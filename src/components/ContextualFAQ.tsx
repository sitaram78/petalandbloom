import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

interface ContextualFAQProps {
  faqs: { question: string; answer: string }[];
}

export default function ContextualFAQ({ faqs }: ContextualFAQProps) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {faqs.map((faq, i) => (
        <div key={i} className="bg-cream-50 rounded-sm border border-cream-300 overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
            aria-expanded={open === i}
          >
            <span className="font-serif text-base text-brown-800 pr-4">{faq.question}</span>
            {open === i ? (
              <Minus size={16} className="text-terracotta-500 flex-shrink-0" strokeWidth={1.5} />
            ) : (
              <Plus size={16} className="text-brown-400 flex-shrink-0" strokeWidth={1.5} />
            )}
          </button>
          {open === i && (
            <div className="px-5 pb-4 animate-fade-in">
              <p className="text-sm text-brown-500 leading-relaxed">{faq.answer}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
