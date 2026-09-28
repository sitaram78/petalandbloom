import { MessageCircle } from 'lucide-react';
import { buildWhatsAppLink } from '@/utils/whatsapp';

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
  const baseClass = variant === 'primary' ? 'btn-whatsapp' : 'btn-secondary';
  return (
    <a
      href={buildWhatsAppLink(message)}
      target="_blank"
      rel="noopener noreferrer"
      className={`${baseClass} ${className}`}
    >
      <MessageCircle size={16} />
      {label}
    </a>
  );
}
