/**
 * Self-contained page content extraction function for AI processing.
 *
 * This function is passed as the `func` parameter to
 * `browser.scripting.executeScript()`, which means it runs in the page context
 * with NO access to extension APIs, imports, or closures. Everything it needs
 * must be defined inline.
 *
 * Returns rendered page text (truncated to 100 KB) and images with alt text
 * (capped at 50) for sending to the backend instead of server-side scraping.
 */
export function extractPageContent(): {
  pageText: string;
  images: Array<{ url: string; alt: string }>;
} {
  const MAX_TEXT_BYTES = 100_000;
  const MAX_IMAGES = 50;

  // Capture rendered text from the visible DOM
  let pageText = document.body.innerText ?? '';
  if (pageText.length > MAX_TEXT_BYTES) {
    pageText = pageText.slice(0, MAX_TEXT_BYTES);
  }

  // Collect images that have meaningful alt text (most useful for AI)
  const images: Array<{ url: string; alt: string }> = [];
  document.querySelectorAll('img').forEach((img) => {
    if (images.length >= MAX_IMAGES) return;
    const src = img.src;
    const alt = (img.alt ?? '').trim();
    if (src && src.startsWith('http') && alt) {
      images.push({ url: src, alt });
    }
  });

  return { pageText, images };
}

/**
 * Self-contained page data extraction function.
 *
 * This function is passed as the `func` parameter to
 * `browser.scripting.executeScript()`, which means it runs in the page context
 * with NO access to extension APIs, imports, or closures. Everything it needs
 * must be defined inline.
 *
 * Returns a plain object matching the PageData shape:
 * ```
 * {
 *   url: string;
 *   title: string;
 *   images: string[];
 *   hints: { jsonLd?: boolean; name?: string; price?: string; image?: string; manufacturer?: string };
 *   confidence: 'high' | 'medium' | 'low';
 * }
 * ```
 */
export function extractPageData(): {
  url: string;
  title: string;
  images: string[];
  hints: {
    jsonLd?: boolean;
    name?: string;
    price?: string;
    image?: string;
    manufacturer?: string;
  };
  confidence: 'high' | 'medium' | 'low';
} {
  // -------------------------------------------------------------------------
  // Layer 1: JSON-LD Structured Data (most reliable)
  // -------------------------------------------------------------------------

  interface JsonLdHints {
    jsonLd: boolean;
    name?: string;
    price?: string;
    image?: string;
    manufacturer?: string;
  }

  function extractJsonLd(): JsonLdHints | null {
    const scripts = document.querySelectorAll(
      'script[type="application/ld+json"]',
    );
    for (const script of scripts) {
      try {
        const raw = JSON.parse(script.textContent ?? '');
        // Handle single object or @graph array
        const items: unknown[] = Array.isArray(raw)
          ? raw
          : raw['@graph'] && Array.isArray(raw['@graph'])
            ? raw['@graph']
            : [raw];

        for (const item of items) {
          if (!item || typeof item !== 'object') continue;
          const data = item as Record<string, unknown>;

          if (data['@type'] === 'Product') {
            const offers = data.offers as Record<string, unknown> | undefined;
            // offers can be a single object or an array
            let price: string | undefined;
            if (offers) {
              if (typeof offers.price === 'string' || typeof offers.price === 'number') {
                price = String(offers.price);
              } else if (Array.isArray(offers)) {
                const firstOffer = offers[0] as Record<string, unknown> | undefined;
                if (firstOffer && (typeof firstOffer.price === 'string' || typeof firstOffer.price === 'number')) {
                  price = String(firstOffer.price);
                }
              } else if (typeof offers.lowPrice === 'string' || typeof offers.lowPrice === 'number') {
                price = String(offers.lowPrice);
              }
            }

            // Image can be a string, array of strings, or ImageObject
            let imageUrl: string | undefined;
            if (typeof data.image === 'string') {
              imageUrl = data.image;
            } else if (Array.isArray(data.image) && data.image.length > 0) {
              const first = data.image[0];
              if (typeof first === 'string') {
                imageUrl = first;
              } else if (first && typeof first === 'object' && typeof (first as Record<string, unknown>).url === 'string') {
                imageUrl = (first as Record<string, unknown>).url as string;
              }
            } else if (data.image && typeof data.image === 'object' && typeof (data.image as Record<string, unknown>).url === 'string') {
              imageUrl = (data.image as Record<string, unknown>).url as string;
            }

            // Brand/manufacturer
            let manufacturer: string | undefined;
            const brand = data.brand as Record<string, unknown> | undefined;
            if (brand && typeof brand.name === 'string') {
              manufacturer = brand.name;
            } else if (typeof data.brand === 'string') {
              manufacturer = data.brand;
            } else if (data.manufacturer && typeof data.manufacturer === 'object') {
              const mfg = data.manufacturer as Record<string, unknown>;
              if (typeof mfg.name === 'string') {
                manufacturer = mfg.name;
              }
            } else if (typeof data.manufacturer === 'string') {
              manufacturer = data.manufacturer;
            }

            return {
              jsonLd: true,
              name: typeof data.name === 'string' ? data.name : undefined,
              price,
              image: imageUrl,
              manufacturer,
            };
          }
        }
      } catch {
        // Malformed JSON-LD -- continue to next script tag
      }
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Layer 2: Open Graph / Meta Tags
  // -------------------------------------------------------------------------

  function getMeta(property: string): string | null {
    const el =
      document.querySelector(`meta[property="${property}"]`) ??
      document.querySelector(`meta[name="${property}"]`);
    return el?.getAttribute('content') ?? null;
  }

  interface MetaHints {
    name?: string;
    image?: string;
    price?: string;
  }

  function extractMetaTags(): MetaHints {
    return {
      name: getMeta('og:title') ?? getMeta('twitter:title') ?? undefined,
      image: getMeta('og:image') ?? getMeta('twitter:image') ?? undefined,
      price: getMeta('product:price:amount') ?? undefined,
    };
  }

  // -------------------------------------------------------------------------
  // Layer 3: Image Extraction with Smart Filtering
  // -------------------------------------------------------------------------

  function extractImages(): string[] {
    const seen = new Set<string>();
    const images: Array<{ src: string; area: number }> = [];

    // First pass: images >= 100x100
    document.querySelectorAll('img').forEach((img) => {
      const src = img.src;
      if (!src || !src.startsWith('http') || seen.has(src)) return;
      seen.add(src);

      const w =
        img.naturalWidth ||
        img.width ||
        parseInt(img.getAttribute('width') ?? '0', 10);
      const h =
        img.naturalHeight ||
        img.height ||
        parseInt(img.getAttribute('height') ?? '0', 10);

      if (w >= 100 && h >= 100) {
        images.push({ src, area: w * h });
      }
    });

    // Second pass: relax to 50x50 if very few images found
    if (images.length < 3) {
      document.querySelectorAll('img').forEach((img) => {
        const src = img.src;
        if (!src || !src.startsWith('http') || seen.has(src)) return;
        seen.add(src);

        const w =
          img.naturalWidth ||
          img.width ||
          parseInt(img.getAttribute('width') ?? '0', 10);
        const h =
          img.naturalHeight ||
          img.height ||
          parseInt(img.getAttribute('height') ?? '0', 10);

        if (w >= 50 && h >= 50) {
          images.push({ src, area: w * h });
        }
      });
    }

    // Sort by area descending (largest first), cap at 20
    return images
      .sort((a, b) => b.area - a.area)
      .slice(0, 20)
      .map((img) => img.src);
  }

  // -------------------------------------------------------------------------
  // Confidence calculation
  // -------------------------------------------------------------------------

  function getProductConfidence(hints: {
    jsonLd?: boolean;
    name?: string;
    price?: string;
  }): 'high' | 'medium' | 'low' {
    if (hints.jsonLd) return 'high';
    if (hints.name || hints.price) return 'medium';
    return 'low';
  }

  // -------------------------------------------------------------------------
  // Main extraction logic
  // -------------------------------------------------------------------------

  // Layer 1: Try JSON-LD first (most reliable)
  const jsonLdHints = extractJsonLd();

  // Layer 2: OG / meta tags
  const metaHints = extractMetaTags();

  // Layer 3: Images
  const images = extractImages();

  // Merge hints (JSON-LD takes priority)
  const hints: {
    jsonLd?: boolean;
    name?: string;
    price?: string;
    image?: string;
    manufacturer?: string;
  } = {
    jsonLd: jsonLdHints?.jsonLd ?? undefined,
    name: jsonLdHints?.name ?? metaHints.name ?? undefined,
    price: jsonLdHints?.price ?? metaHints.price ?? undefined,
    image: jsonLdHints?.image ?? metaHints.image ?? undefined,
    manufacturer: jsonLdHints?.manufacturer ?? undefined,
  };

  const confidence = getProductConfidence(hints);

  return {
    url: document.location.href,
    title: document.title,
    images,
    hints,
    confidence,
  };
}
