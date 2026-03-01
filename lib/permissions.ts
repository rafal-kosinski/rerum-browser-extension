// Host permission helpers.
//
// The manifest declares *://*/* as optional_host_permissions, which allows
// the extension to request access to individual origins at runtime via
// browser.permissions.request(). Instead of requesting the broad wildcard
// (which triggers a scary "all websites" warning), we request only the
// specific origin the user is currently on (e.g. https://www.amazon.com/*).
//
// Granted origins persist across browser restarts and accumulate over time,
// so repeat visits to the same site never prompt again.

/**
 * Derive a match-pattern origin from a full URL.
 * e.g. "https://www.amazon.com/dp/B09V3..." -> "https://www.amazon.com/*"
 */
function toOriginPattern(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return `${parsed.origin}/*`;
  } catch {
    return null;
  }
}

/**
 * Check whether the extension has host permission for a specific URL's origin.
 * Safe to call from both the side panel and the background service worker.
 */
export async function hasHostPermissionFor(url: string): Promise<boolean> {
  const origin = toOriginPattern(url);
  if (!origin) return false;
  try {
    return await browser.permissions.contains({ origins: [origin] });
  } catch {
    return false;
  }
}

/**
 * Request host permission for just the given URL's origin.
 * Browser prompt: "Read and change your data on www.amazon.com"
 *
 * Must be called from a user-gesture context (e.g. a click handler).
 */
export async function requestHostPermissionFor(url: string): Promise<boolean> {
  const origin = toOriginPattern(url);
  if (!origin) return false;
  try {
    return await browser.permissions.request({ origins: [origin] });
  } catch {
    return false;
  }
}

/**
 * Request host permission for ALL websites.
 * Browser prompt: "Read and change all your data on all websites"
 *
 * Must be called from a user-gesture context (e.g. a click handler).
 */
export async function requestHostPermissionForAll(): Promise<boolean> {
  try {
    return await browser.permissions.request({ origins: ['*://*/*'] });
  } catch {
    return false;
  }
}
