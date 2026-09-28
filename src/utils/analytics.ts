type EventName =
  | 'homepage_view'
  | 'product_view'
  | 'search'
  | 'filter_use'
  | 'quick_view'
  | 'add_to_cart'
  | 'whatsapp_click'
  | 'custom_builder_started'
  | 'custom_builder_completed'
  | 'gift_finder_started'
  | 'gift_finder_completed'
  | 'checkout_started'
  | 'purchase_completed'
  | 'instagram_click'
  | 'wishlist_add'
  | 'wishlist_remove';

interface EventData {
  [key: string]: string | number | boolean | undefined;
}

export function trackEvent(name: EventName, data?: EventData): void {
  if (typeof window === 'undefined') return;

  const payload = {
    event: name,
    ...data,
    timestamp: new Date().toISOString(),
    page: window.location.pathname,
  };

  if (typeof window.gtag === 'function') {
    window.gtag('event', name, payload);
  }

  if (typeof window.dataLayer !== 'undefined') {
    window.dataLayer.push(payload);
  }

  if (import.meta.env.DEV) {
    console.debug('[analytics]', name, data);
  }
}
