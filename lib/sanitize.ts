import type { PageData, ProductConfidence, ProductHints } from '../shared-types/estimate';

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

/**
 * Check whether a string is a valid HTTP(S) URL.
 *
 * Blocks `javascript:`, `data:`, and `blob:` schemes to prevent script
 * injection from malicious content script responses.
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// HTML stripping
// ---------------------------------------------------------------------------

/**
 * Remove HTML tags from a string.
 *
 * This is a simple regex-based approach suitable for sanitising short
 * metadata strings (titles, hints). It does NOT aim to be a full HTML
 * sanitiser.
 */
export function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

// ---------------------------------------------------------------------------
// Hints sanitisation
// ---------------------------------------------------------------------------

/**
 * Validate and sanitise product hints extracted by the content script.
 *
 * All fields are optional; invalid values are silently dropped.
 */
export function sanitizeHints(raw: unknown): ProductHints {
  if (!raw || typeof raw !== 'object') return {};

  const d = raw as Record<string, unknown>;
  const hints: ProductHints = {};

  if (typeof d.jsonLd === 'boolean') {
    hints.jsonLd = d.jsonLd;
  }

  if (typeof d.name === 'string') {
    hints.name = stripHtml(d.name).substring(0, 500);
  }

  if (typeof d.price === 'string') {
    hints.price = stripHtml(d.price).substring(0, 100);
  }

  if (typeof d.image === 'string' && isValidUrl(d.image)) {
    hints.image = d.image.substring(0, 2000);
  }

  if (typeof d.manufacturer === 'string') {
    hints.manufacturer = stripHtml(d.manufacturer).substring(0, 300);
  }

  return hints;
}

// ---------------------------------------------------------------------------
// Confidence calculation
// ---------------------------------------------------------------------------

/**
 * Compute product-page confidence from sanitised hints.
 *
 * - **high**: JSON-LD Product structured data was found.
 * - **medium**: Open Graph or meta tag product signals were found.
 * - **low**: No product-specific metadata detected.
 */
export function calculateConfidence(hints: ProductHints): ProductConfidence {
  if (hints.jsonLd) return 'high';
  if (hints.name || hints.price) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Page data sanitisation
// ---------------------------------------------------------------------------

/**
 * Validate and sanitise the raw data returned by the content script.
 *
 * Returns `null` when the data is structurally invalid (missing URL, wrong
 * types, etc.), in which case the Side Panel should treat the page as
 * unextractable.
 *
 * @param raw - The untrusted value received via message passing from the
 *              content script.
 */
export function sanitizePageData(raw: unknown): PageData | null {
  if (!raw || typeof raw !== 'object') return null;

  const d = raw as Record<string, unknown>;

  // URL — required, must start with http(s)://
  const url =
    typeof d.url === 'string' && /^https?:\/\//.test(d.url)
      ? d.url.substring(0, 2000)
      : null;
  if (!url) return null;

  // Title — optional, strip HTML, cap length
  const title =
    typeof d.title === 'string' ? stripHtml(d.title).substring(0, 500) : '';

  // Images — array of valid HTTP(S) URLs, capped at 50
  const images = Array.isArray(d.images)
    ? d.images
        .filter(
          (s): s is string => typeof s === 'string' && isValidUrl(s),
        )
        .map((s) => s.substring(0, 2000))
        .slice(0, 50)
    : [];

  // Hints — validated separately
  const hints = sanitizeHints(d.hints);

  // Confidence — derived from sanitised hints
  const confidence = calculateConfidence(hints);

  return { url, title, images, hints, confidence };
}
