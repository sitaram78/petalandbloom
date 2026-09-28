import { Star, MessageCircle } from 'lucide-react';
import Reveal from '@/components/Reveal';
import WhatsAppButton from '@/components/WhatsAppButton';
import { generalEnquiryMessage } from '@/utils/whatsapp';

export default function ReviewsSection() {
  return (
    <div className="py-12 lg:py-16 bg-cream-100">
      <div className="container-lux">
        <Reveal>
          <p className="section-label text-center mb-3">Reviews</p>
          <h2 className="heading-serif text-2xl lg:text-3xl text-center mb-3">Be one of the first to share your bloom.</h2>
          <p className="text-sm text-brown-400 text-center max-w-md mx-auto mb-6">
            We are a young brand. As our customers receive their blooms, their stories will appear here.
          </p>
        </Reveal>

        <div className="max-w-md mx-auto text-center">
          <div className="flex justify-center gap-1 mb-4">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={20} className="text-cream-400" strokeWidth={1.5} />
            ))}
          </div>
          <p className="text-sm text-brown-500 mb-4">
            No reviews yet — but your bloom could be the first.
          </p>
          <WhatsAppButton
            message={generalEnquiryMessage()}
            label="Share your experience"
            variant="outline"
          />
        </div>
      </div>
    </div>
  );
}
