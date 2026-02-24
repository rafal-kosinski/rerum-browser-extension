import type { AccountType, EstimateTabApi } from '../shared-types/estimate';

// ---------------------------------------------------------------------------
// Session Storage — survives SW restarts but cleared on browser close
// Uses browser.storage.session (polyfilled by WXT for cross-browser support)
// ---------------------------------------------------------------------------

/** Auth state stored in session storage. */
export interface StoredAuthState {
  isAuthenticated: boolean;
  accountType?: AccountType;
}

/** Cached document structure (tab metadata only, no row data). */
export interface CachedDocumentEntry {
  tabs: Pick<EstimateTabApi, 'tab_id' | 'tab_name' | 'tab_order'>[];
  cachedAt: number;
}

/** Shape of everything stored in `browser.storage.session`. */
interface SessionStorageSchema {
  authState?: StoredAuthState;
  cachedDocuments?: Record<string, CachedDocumentEntry>;
}

// ---------------------------------------------------------------------------
// Local Storage — persists across browser restarts
// Uses browser.storage.local (polyfilled by WXT for cross-browser support)
// ---------------------------------------------------------------------------

/** Shape of everything stored in `browser.storage.local`. */
interface LocalStorageSchema {
  lastDocumentUuid?: string;
  lastTabId?: string;
  onboardingComplete?: boolean;
  locale?: string;
}

// ---------------------------------------------------------------------------
// Generic typed accessors
// ---------------------------------------------------------------------------

/**
 * Read a value from `browser.storage.session`.
 */
export async function getSessionValue<K extends keyof SessionStorageSchema>(
  key: K,
): Promise<SessionStorageSchema[K] | undefined> {
  const result = await browser.storage.session.get(key);
  return result[key] as SessionStorageSchema[K] | undefined;
}

/**
 * Write a value to `browser.storage.session`.
 */
export async function setSessionValue<K extends keyof SessionStorageSchema>(
  key: K,
  value: SessionStorageSchema[K],
): Promise<void> {
  await browser.storage.session.set({ [key]: value });
}

/**
 * Remove a value from `browser.storage.session`.
 */
export async function removeSessionValue<K extends keyof SessionStorageSchema>(
  key: K,
): Promise<void> {
  await browser.storage.session.remove(key);
}

/**
 * Read a value from `browser.storage.local`.
 */
export async function getLocalValue<K extends keyof LocalStorageSchema>(
  key: K,
): Promise<LocalStorageSchema[K] | undefined> {
  const result = await browser.storage.local.get(key);
  return result[key] as LocalStorageSchema[K] | undefined;
}

/**
 * Write a value to `browser.storage.local`.
 */
export async function setLocalValue<K extends keyof LocalStorageSchema>(
  key: K,
  value: LocalStorageSchema[K],
): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

/**
 * Remove a value from `browser.storage.local`.
 */
export async function removeLocalValue<K extends keyof LocalStorageSchema>(
  key: K,
): Promise<void> {
  await browser.storage.local.remove(key);
}

// ---------------------------------------------------------------------------
// Document cache helpers
// ---------------------------------------------------------------------------

/**
 * Cache a document's tab structure in session storage.
 */
export async function cacheDocumentTabs(
  uuid: string,
  tabs: Pick<EstimateTabApi, 'tab_id' | 'tab_name' | 'tab_order'>[],
): Promise<void> {
  const existing = (await getSessionValue('cachedDocuments')) ?? {};
  existing[uuid] = { tabs, cachedAt: Date.now() };
  await setSessionValue('cachedDocuments', existing);
}

/**
 * Retrieve a cached document's tab structure from session storage.
 * Returns `undefined` if not cached.
 */
export async function getCachedDocumentTabs(
  uuid: string,
): Promise<CachedDocumentEntry | undefined> {
  const docs = await getSessionValue('cachedDocuments');
  return docs?.[uuid];
}

/**
 * Invalidate the cache for a specific document (e.g. after adding a row).
 */
export async function invalidateDocumentCache(uuid: string): Promise<void> {
  const docs = await getSessionValue('cachedDocuments');
  if (docs && uuid in docs) {
    delete docs[uuid];
    await setSessionValue('cachedDocuments', docs);
  }
}

/**
 * Check whether a cached document entry is stale.
 *
 * @param uuid      Document UUID to check
 * @param maxAgeMs  Maximum acceptable age in milliseconds (default: 5 minutes)
 * @returns `true` if the cache entry is missing or older than `maxAgeMs`
 */
export async function isDocumentCacheStale(
  uuid: string,
  maxAgeMs: number = 5 * 60 * 1000,
): Promise<boolean> {
  const entry = await getCachedDocumentTabs(uuid);
  if (!entry) return true;
  return Date.now() - entry.cachedAt > maxAgeMs;
}

/**
 * Clear all session storage (e.g. on logout or 401).
 */
export async function clearSessionStorage(): Promise<void> {
  await browser.storage.session.clear();
}
