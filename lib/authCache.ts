import type { UserInfo } from '../shared-types/estimate';

/**
 * Cached auth state read from `browser.storage.session` before React mounts.
 *
 * This allows `useAuth` to initialise with the last-known auth state instead
 * of always starting with `isLoading=true`, which eliminates the brief
 * spinner flash every time the popup/sidepanel is opened.
 */
export interface CachedAuth {
  isAuthenticated: boolean;
  user: UserInfo | null;
}

let cachedAuth: CachedAuth | null = null;

/**
 * Pre-load cached auth state from session storage.
 * Must be called (and awaited) before `ReactDOM.createRoot().render()`.
 */
export async function preloadCachedAuth(): Promise<void> {
  try {
    const result = await browser.storage.session.get('authState');
    const stored = result.authState as CachedAuth | undefined;
    if (stored && typeof stored.isAuthenticated === 'boolean') {
      cachedAuth = stored;
    }
  } catch {
    // Session storage unavailable — fall back to loading spinner
  }
}

/**
 * Get the pre-loaded cached auth state. Returns `null` if no cached state
 * is available (first install, or session storage was cleared).
 */
export function getCachedAuth(): CachedAuth | null {
  return cachedAuth;
}
