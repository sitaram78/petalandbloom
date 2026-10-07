/**
 * SEC-12: Safe URL Protocol Validation
 * Sanitizes URLs to prevent Cross-Site Scripting (XSS) via `javascript:`, `vbscript:`, `data:` or other malicious schemes.
 * Only permits `http:`, `https:`, `mailto:`, `tel:` schemes, as well as safe relative paths and fragment anchors.
 */
export function safeUrl(url: string | null | undefined, fallback: string = '#'): string {
  if (!url || typeof url !== 'string') {
    return fallback;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return fallback;
  }

  // Safe relative paths (e.g. /products, /cart), but reject protocol-relative (//evil.com)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  // Check for safe anchor hashes (e.g. #section)
  if (trimmed.startsWith('#')) {
    return trimmed;
  }

  try {
    // Parse using standard URL API if absolute
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];
    if (ALLOWED_PROTOCOLS.includes(protocol)) {
      return trimmed;
    }
    return fallback;
  } catch {
    // If URL constructor fails, test for unsafe pseudo-protocols or unencoded control chars
    const cleanScheme = trimmed.replace(/[\u0000-\u001F\u007F-\u009F\s]/g, '').toLowerCase();
    if (
      cleanScheme.startsWith('javascript:') ||
      cleanScheme.startsWith('vbscript:') ||
      cleanScheme.startsWith('data:')
    ) {
      return fallback;
    }

    // Relative links without leading slash (e.g., "products/rose")
    if (!cleanScheme.includes(':')) {
      return trimmed;
    }

    return fallback;
  }
}
