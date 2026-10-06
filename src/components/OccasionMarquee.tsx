import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, Copy, Check, Tag } from 'lucide-react';
import type { OccasionBannerSettings, OccasionTheme } from '@/context/StoreSettingsContext';

interface OccasionMarqueeProps {
  settings?: OccasionBannerSettings;
  variant?: 'strip' | 'topbar';
  className?: string;
}

const THEME_STYLES: Record<OccasionTheme, {
  stripBg: string;
  stripText: string;
  stripBorder: string;
  topbarBg: string;
  topbarText: string;
  pillBg: string;
  pillText: string;
  couponBorder: string;
  couponBg: string;
  accentIcon: string;
}> = {
  rose: {
    stripBg: 'bg-[#FBF4F5]',
    stripText: 'text-rose-deep',
    stripBorder: 'border-rose-200/60',
    topbarBg: 'bg-rose text-linen',
    topbarText: 'text-linen',
    pillBg: 'bg-rose text-linen',
    pillText: 'text-linen',
    couponBorder: 'border-rose/30',
    couponBg: 'bg-white/80 hover:bg-rose hover:text-white',
    accentIcon: 'text-rose',
  },
  gold: {
    stripBg: 'bg-[#FDF8EE]',
    stripText: 'text-[#684812]',
    stripBorder: 'border-amber-200/70',
    topbarBg: 'bg-[#8E631B] text-[#FFF9EF]',
    topbarText: 'text-[#FFF9EF]',
    pillBg: 'bg-[#8E631B] text-[#FFF9EF]',
    pillText: 'text-[#FFF9EF]',
    couponBorder: 'border-amber-400/50',
    couponBg: 'bg-white/80 hover:bg-[#8E631B] hover:text-white',
    accentIcon: 'text-amber-600',
  },
  sage: {
    stripBg: 'bg-[#F1F6EE]',
    stripText: 'text-[#3E4F32]',
    stripBorder: 'border-[#7C8B5C]/30',
    topbarBg: 'bg-[#52633E] text-linen',
    topbarText: 'text-linen',
    pillBg: 'bg-[#52633E] text-linen',
    pillText: 'text-linen',
    couponBorder: 'border-[#52633E]/30',
    couponBg: 'bg-white/80 hover:bg-[#52633E] hover:text-white',
    accentIcon: 'text-[#52633E]',
  },
  wine: {
    stripBg: 'bg-[#2E151C]',
    stripText: 'text-[#F8EAE3]',
    stripBorder: 'border-[#4E2430]',
    topbarBg: 'bg-[#2E151C] text-[#F8EAE3]',
    topbarText: 'text-[#F8EAE3]',
    pillBg: 'bg-[#512330] text-[#F8EAE3]',
    pillText: 'text-[#F8EAE3]',
    couponBorder: 'border-white/20',
    couponBg: 'bg-white/10 hover:bg-white hover:text-[#2E151C]',
    accentIcon: 'text-[#E8A5B8]',
  },
  linen: {
    stripBg: 'bg-canvas/35',
    stripText: 'text-bark',
    stripBorder: 'border-canvas-line',
    topbarBg: 'bg-bark text-linen',
    topbarText: 'text-linen',
    pillBg: 'bg-bark text-linen',
    pillText: 'text-linen',
    couponBorder: 'border-canvas-line',
    couponBg: 'bg-parchment-50 hover:bg-bark hover:text-linen',
    accentIcon: 'text-rose',
  },
};

export default function OccasionMarquee({ settings, variant = 'strip', className = '' }: OccasionMarqueeProps) {
  const [copied, setCopied] = useState(false);

  if (!settings || !settings.enabled || !settings.marqueeText) {
    return null;
  }

  const theme = THEME_STYLES[settings.theme] || THEME_STYLES.rose;
  const targetUrl = settings.targetUrl?.trim() || '/shop';

  const handleCopyCoupon = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!settings.couponCode) return;
    navigator.clipboard.writeText(settings.couponCode.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  // Repeated segment for seamless infinite scroll
  const renderItem = (keyPrefix: string) => (
    <div key={keyPrefix} className="inline-flex items-center gap-6 shrink-0 px-4">
      {settings.occasionTitle && (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] tracking-widest uppercase font-semibold shadow-2xs ${theme.pillBg} ${theme.pillText}`}>
          <Sparkles size={11} className="shrink-0" />
          {settings.occasionTitle}
        </span>
      )}

      <span className="font-serif italic text-sm tracking-wide">
        {settings.marqueeText}
      </span>

      {settings.couponCode && (
        <button
          type="button"
          onClick={handleCopyCoupon}
          title="Click to copy coupon code"
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono transition-all border cursor-pointer ${theme.couponBorder} ${theme.couponBg}`}
        >
          <Tag size={11} className="shrink-0" />
          <span>{settings.couponCode}</span>
          {copied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} className="opacity-60" />}
          <span className="text-[9px] font-sans uppercase tracking-wider opacity-75">
            {copied ? 'Copied' : 'Copy'}
          </span>
        </button>
      )}

      <Link
        to={targetUrl}
        className="inline-flex items-center gap-1 text-[11px] font-medium tracking-wider uppercase underline underline-offset-4 hover:opacity-80 transition-opacity"
      >
        <span>Shop Occasion</span>
        <ArrowRight size={12} />
      </Link>

      <span className="text-xs opacity-40 select-none">✦</span>
    </div>
  );

  // Variant A: Site-wide Top Announcement Bar
  if (variant === 'topbar') {
    return (
      <aside
        aria-label="Occasion announcement"
        className={`w-full py-1.5 px-4 text-xs font-medium text-center relative z-50 flex items-center justify-center gap-2 overflow-hidden shadow-xs transition-colors duration-300 ${theme.topbarBg} ${className}`}
      >
        <div className="flex items-center gap-2 truncate max-w-5xl mx-auto">
          {settings.occasionTitle && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase font-semibold tracking-wider bg-white/20">
              <Sparkles size={10} /> {settings.occasionTitle}
            </span>
          )}

          <span className="truncate text-xs font-serif italic tracking-wide">
            {settings.marqueeText}
          </span>

          {settings.couponCode && (
            <button
              type="button"
              onClick={handleCopyCoupon}
              className="shrink-0 inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-white/15 hover:bg-white/25 border border-white/20 transition-colors cursor-pointer"
            >
              <span>{settings.couponCode}</span>
              {copied ? <Check size={10} /> : <Copy size={10} />}
            </button>
          )}

          <Link
            to={targetUrl}
            className="shrink-0 inline-flex items-center gap-0.5 text-[11px] uppercase tracking-wider underline hover:opacity-90 ml-1 font-sans"
          >
            <span>Explore</span>
            <ArrowRight size={11} />
          </Link>
        </div>
      </aside>
    );
  }

  // Variant B: Home Page Running Marquee Strip (Continuous hardware-accelerated ticker)
  return (
    <section
      aria-label="Festive occasion sale marquee"
      className={`relative w-full py-3 overflow-hidden border-y transition-colors duration-300 ${theme.stripBg} ${theme.stripText} ${theme.stripBorder} ${className}`}
    >
      <div className="flex flex-nowrap w-max animate-marquee hover:[animation-play-state:paused] active:[animation-play-state:paused] select-none">
        {renderItem('group-1')}
        {renderItem('group-2')}
        {renderItem('group-3')}
        {renderItem('group-4')}
        {renderItem('group-5')}
        {renderItem('group-6')}
      </div>
    </section>
  );
}
