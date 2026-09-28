import { Link } from 'react-router-dom';
import Reveal from '@/components/Reveal';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-parchment-50 flex items-center justify-center p-6">
      <Reveal>
        <div className="text-center space-y-6 max-w-md">
          <h1 className="heading-serif text-6xl text-ink opacity-20">404</h1>
          <div className="space-y-2">
            <h2 className="heading-serif text-3xl text-ink">A Lost Petal</h2>
            <p className="text-ink-light font-light">
              The page you are looking for has drifted away or never existed in our studio.
            </p>
          </div>
          <div className="pt-4">
            <Link
              to="/shop"
              className="btn-primary inline-flex items-center gap-2 px-8 py-3"
            >
              Return to Gallery
            </Link>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
