import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useStoreSettings } from '@/context/StoreSettingsContext';

interface WhatsAppButtonProps {
  message: string;
  label?: string;
  variant?: 'primary' | 'outline';
  className?: string;
}

export default function WhatsAppButton({
  message,
  label = 'Order on WhatsApp',
  variant = 'primary',
  className = '',
}: WhatsAppButtonProps) {
  const { triggerAssistance, buildWhatsAppUrl, settings } = useStoreSettings();
  let dynamicLabel = label;
  if (settings.conciergeChannelMode === 'IN_SYSTEM') {
    if (label === 'Order on WhatsApp') {
      dynamicLabel = 'Order via Atelier Chat';
    } else if (label.toLowerCase().includes('whatsapp')) {
      dynamicLabel = label.replace(/whatsapp/gi, 'Atelier Chat');
    }
  }

  const baseClass =
    variant === 'outline'
      ? 'btn-secondary'
      : settings.conciergeChannelMode === 'IN_SYSTEM'
      ? 'inline-flex items-center justify-center gap-2 px-8 py-4 bg-rose hover:bg-rose-deep text-white text-sm font-medium tracking-wide rounded-atelier-btn transition-all duration-300 shadow-soft active:scale-[0.98] whitespace-nowrap'
      : 'btn-whatsapp';

  const handleClick = (e: React.MouseEvent) => {
    if (settings.conciergeChannelMode === 'IN_SYSTEM') {
      e.preventDefault();
      triggerAssistance(message);
    }
  };

  return (
    <a
      href={buildWhatsAppUrl(message)}
      onClick={handleClick}
      target="_blank"
      rel="noopener noreferrer"
      className={`${baseClass} ${className}`}
    >
      <MessageCircle size={16} />
      {dynamicLabel}
    </a>
  );
}
