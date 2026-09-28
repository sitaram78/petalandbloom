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
  const baseClass = variant === 'primary' ? 'btn-whatsapp' : 'btn-secondary';

  const handleClick = (e: React.MouseEvent) => {
    if (settings.conciergeChannelMode === 'IN_SYSTEM') {
      e.preventDefault();
      triggerAssistance(message);
    }
  };

  const dynamicLabel =
    settings.conciergeChannelMode === 'IN_SYSTEM' && label === 'Order on WhatsApp'
      ? 'Order via Atelier Chat'
      : label;

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
