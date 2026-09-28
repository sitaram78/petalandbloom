import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  canonicalPath?: string;
  ogType?: string;
  ogImage?: string;
  structuredData?: object;
}

const SITE_NAME = 'The Petal & Bloom';
const DEFAULT_DESCRIPTION = 'Handmade crochet flowers, bouquets, and gifts made in India. Custom colours, made to order, pan-India delivery.';
const DEFAULT_OG_IMAGE = '/logo.jpeg';

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setJsonLd(id: string, data: object) {
  const scriptId = `jsonld-${id}`;
  let el = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement('script');
    el.id = scriptId;
    el.type = 'application/ld+json';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export default function SEO({ title, description, canonicalPath, ogType = 'website', ogImage, structuredData }: SEOProps) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Handmade Crochet Flowers & Gifts`;
    document.title = fullTitle;

    const desc = description || DEFAULT_DESCRIPTION;
    setMeta('name', 'description', desc);

    const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
    const canonical = canonicalPath ? `${siteUrl}${canonicalPath}` : window.location.href;
    setLink('canonical', canonical);

    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:type', ogType);
    setMeta('property', 'og:image', ogImage || DEFAULT_OG_IMAGE);
    setMeta('property', 'og:url', canonical);
    setMeta('property', 'og:site_name', SITE_NAME);

    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', desc);
    setMeta('name', 'twitter:image', ogImage || DEFAULT_OG_IMAGE);

    if (structuredData) {
      setJsonLd('page', structuredData);
    }

    return () => {
      const el = document.getElementById('jsonld-page');
      if (el) el.remove();
    };
  }, [title, description, canonicalPath, ogType, ogImage, structuredData]);

  return null;
}
