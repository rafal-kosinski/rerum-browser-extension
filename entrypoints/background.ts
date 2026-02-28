import { RERUM_BASE_URL, RERUM_API_URL, RERUM_CLIENT_HEADER, SYSTEM_FIELDS } from '../lib/constants';
import type {
  EstimateDocumentDto,
  EstimateRecordApi,
  ExtractedProductData,
  PageData,
  PagedEstimateDocumentsDto,
  ProductHints,
  UsageDto,
  UserDto,
} from '../shared-types/estimate';
import type { ExtensionMessage, ExtensionResponse } from '../lib/messaging';
import { extractPageData, extractPageContent } from './content/extraction';
import { sanitizePageData, sanitizeHints, stripHtml } from '../lib/sanitize';
import { cacheDocumentTabs, invalidateDocumentCache } from '../lib/storage';

// ---------------------------------------------------------------------------
// ApiError
// ---------------------------------------------------------------------------

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errorCode?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---------------------------------------------------------------------------
// Locale resolution
// ---------------------------------------------------------------------------

/** Cached language preference from browser.storage.local. */
let cachedLanguage: string | null = null;

/** Load stored language preference into the module-level cache. */
async function loadLanguagePreference(): Promise<void> {
  try {
    const result = await browser.storage.local.get('language');
    cachedLanguage = (result.language as string) ?? null;
  } catch {
    cachedLanguage = null;
  }
}

// Listen for storage changes to keep the cache up-to-date.
if (typeof browser !== 'undefined' && browser.storage?.onChanged) {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.language) {
      cachedLanguage = (changes.language.newValue as string) ?? null;
    }
  });
}

function resolveLocale(): string {
  if (cachedLanguage) {
    return cachedLanguage;
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language;
    }
  } catch {
    // Fallback below
  }
  return 'en';
}

// ---------------------------------------------------------------------------
// Session token helper (X-Auth-Token header for extension auth)
// ---------------------------------------------------------------------------

/**
 * Read the SESSION cookie via browser.cookies API, Base64-decode it (Spring
 * Session's DefaultCookieSerializer Base64-encodes the session ID), and return
 * the raw session UUID.
 *
 * Returns null when the cookie is absent or the API is unavailable.
 */
async function getSessionToken(): Promise<string | null> {
  try {
    if (typeof browser === 'undefined' || !browser.cookies) {
      console.warn('[rerum-ext] getSessionToken: browser.cookies not available');
      return null;
    }
    const cookie = await browser.cookies.get({
      url: RERUM_BASE_URL,
      name: 'SESSION',
    });
    console.log('[rerum-ext] getSessionToken: cookie lookup for', RERUM_BASE_URL, '→', cookie ? `value="${cookie.value}" (domain=${cookie.domain}, path=${cookie.path})` : 'null');
    if (!cookie?.value) {
      return null;
    }
    // Spring Session Base64-encodes the session ID in the cookie value
    const decoded = atob(cookie.value);
    console.log('[rerum-ext] getSessionToken: decoded session ID =', decoded);
    return decoded;
  } catch (err) {
    console.error('[rerum-ext] getSessionToken: error', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// CSRF token management
// ---------------------------------------------------------------------------

/**
 * Read the XSRF-TOKEN cookie via the browser.cookies API.
 * Returns null when the cookie is absent or the API is unavailable.
 */
async function getCsrfTokenFromCookie(): Promise<string | null> {
  try {
    if (typeof browser === 'undefined' || !browser.cookies) {
      return null;
    }
    const cookie = await browser.cookies.get({
      url: RERUM_BASE_URL,
      name: 'XSRF-TOKEN',
    });
    return cookie?.value ?? null;
  } catch {
    return null;
  }
}

/** De-duplication guard for in-flight CSRF fetches. */
let csrfFetchInFlight: Promise<void> | null = null;

/**
 * Ensure the XSRF-TOKEN cookie exists. If not, call GET /api/csrf to have
 * Spring Security generate and set it, then read the cookie.
 *
 * I15 FIX: Explicit null/undefined checks before using CSRF token.
 *
 * @throws {ApiError} when the CSRF token cannot be obtained
 */
async function ensureCsrfToken(): Promise<string> {
  let token = await getCsrfTokenFromCookie();
  // I15: Explicit check for non-empty token
  if (token != null && token !== '') {
    return token;
  }

  // Fetch the CSRF endpoint to force cookie creation (de-duplicated)
  if (!csrfFetchInFlight) {
    const csrfHeaders: Record<string, string> = {
      Accept: 'application/json',
      'X-Rerum-Client': RERUM_CLIENT_HEADER,
    };
    const csrfSessionToken = await getSessionToken();
    if (csrfSessionToken) {
      csrfHeaders['X-Auth-Token'] = csrfSessionToken;
    }
    csrfFetchInFlight = fetch(`${RERUM_API_URL}/csrf`, {
      credentials: 'include',
      headers: csrfHeaders,
    })
      .then(() => {
        csrfFetchInFlight = null;
      })
      .catch((err) => {
        csrfFetchInFlight = null;
        console.error('[rerum-ext] Failed to fetch CSRF token:', err);
        throw err;
      });
  }

  await csrfFetchInFlight;

  token = await getCsrfTokenFromCookie();
  // I15: Explicit null/undefined/empty check
  if (token == null || token === '') {
    throw new ApiError(0, 'Could not obtain CSRF token after fetching /csrf endpoint');
  }
  return token;
}

// ---------------------------------------------------------------------------
// Inline API client (fetch-based, for Service Worker context)
// ---------------------------------------------------------------------------

/**
 * Perform a GET request against the Rerum API.
 * Credentials are included so the browser attaches session cookies.
 */
async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${RERUM_API_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const sessionToken = await getSessionToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Rerum-Client': RERUM_CLIENT_HEADER,
    'Accept-Language': resolveLocale(),
  };
  if (sessionToken) {
    headers['X-Auth-Token'] = sessionToken;
  }

  const response = await fetch(url.toString(), {
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText })) as { error?: string; errorCode?: string };
    throw new ApiError(response.status, body.error ?? response.statusText, body.errorCode);
  }

  return response.json() as Promise<T>;
}

/**
 * Perform a POST request against the Rerum API.
 * Automatically attaches the XSRF-TOKEN header.
 */
async function apiPost<T>(path: string, body: unknown, params?: Record<string, string>): Promise<T> {
  const csrfToken = await ensureCsrfToken();
  const sessionToken = await getSessionToken();
  const url = new URL(`${RERUM_API_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-XSRF-TOKEN': csrfToken,
    'X-Rerum-Client': RERUM_CLIENT_HEADER,
    'Accept-Language': resolveLocale(),
  };
  if (sessionToken) {
    headers['X-Auth-Token'] = sessionToken;
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: response.statusText })) as { error?: string; errorCode?: string };
    throw new ApiError(response.status, errorBody.error ?? response.statusText, errorBody.errorCode);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

/**
 * Perform a PUT request against the Rerum API.
 * Automatically attaches the XSRF-TOKEN header.
 */
async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const csrfToken = await ensureCsrfToken();
  const sessionToken = await getSessionToken();
  const url = new URL(`${RERUM_API_URL}${path}`);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-XSRF-TOKEN': csrfToken,
    'X-Rerum-Client': RERUM_CLIENT_HEADER,
    'Accept-Language': resolveLocale(),
  };
  if (sessionToken) {
    headers['X-Auth-Token'] = sessionToken;
  }

  const response = await fetch(url.toString(), {
    method: 'PUT',
    credentials: 'include',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: response.statusText })) as { error?: string; errorCode?: string };
    throw new ApiError(response.status, errorBody.error ?? response.statusText, errorBody.errorCode);
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Sanitization helpers now imported from ../lib/sanitize
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Extraction-to-row helpers
// ---------------------------------------------------------------------------

function asString(val: unknown): string | null {
  return val != null ? String(val) : null;
}

/**
 * Convert a dynamic extraction response (flat map from POST /api/estimate/dynamic)
 * into an ExtractedProductData object for the Side Panel UI.
 *
 * System fields are mapped to their camelCase equivalents; everything else
 * goes into customFields keyed by raw columnKey.
 */
function toExtractedProductData(extraction: Record<string, unknown>): ExtractedProductData {
  const customFields: Record<string, string> = {};

  for (const [key, value] of Object.entries(extraction)) {
    if (!SYSTEM_FIELDS.has(key) && value != null) {
      customFields[key] = String(value);
    }
  }

  return {
    productName: asString(extraction.productName),
    manufacturer: asString(extraction.manufacturer),
    pricePerUnit: asString(extraction.pricePerUnit),
    productImageUrl: asString(extraction.productImageUrl),
    productUrl: asString(extraction.productUrl),
    customFields: Object.keys(customFields).length > 0 ? customFields : null,
  };
}

// ---------------------------------------------------------------------------
// Message handlers
// ---------------------------------------------------------------------------

async function handleLogout(): Promise<ExtensionResponse> {
  // 1. Call the server-side logout endpoint to invalidate the session
  try {
    await apiPost<void>('/auth/logout', {});
  } catch {
    // Best-effort — even if the server call fails, clear local state
  }

  // 2. Remove session and CSRF cookies
  await browser.cookies.remove({ url: RERUM_BASE_URL, name: 'SESSION' }).catch(() => {});
  await browser.cookies.remove({ url: RERUM_BASE_URL, name: 'XSRF-TOKEN' }).catch(() => {});

  // 3. Broadcast auth state change so the side panel resets
  browser.runtime
    .sendMessage({ type: 'AUTH_STATE_CHANGED' as string })
    .catch(() => {
      // No listener (Side Panel not open) — expected, ignore
    });

  return { type: 'LOGOUT_RESULT' };
}

async function handleCheckAuth(): Promise<ExtensionResponse> {
  try {
    const user = await apiGet<UserDto>('/auth/me');
    console.log('[rerum-ext] CHECK_AUTH: authenticated as', user.email);
    return {
      type: 'AUTH_RESULT',
      isAuthenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        accountType: user.accountType,
      },
    };
  } catch (err) {
    if (err instanceof ApiError) {
      console.warn('[rerum-ext] CHECK_AUTH: failed with status', err.status, err.message);
      if (err.status === 401) {
        return { type: 'AUTH_RESULT', isAuthenticated: false };
      }
    }
    throw err;
  }
}

async function handleFetchDocuments(
  page?: number,
  size?: number,
  search?: string,
  sort?: 'name' | 'updated',
): Promise<ExtensionResponse> {
  const params: Record<string, string> = {};
  if (page != null) params.page = String(page);
  if (size != null) params.size = String(size);
  if (search) params.search = search;
  // I16: Add sort parameter support
  if (sort) params.sort = sort;

  const result = await apiGet<PagedEstimateDocumentsDto>('/estimates', params);
  return {
    type: 'DOCUMENTS_RESULT',
    documents: result.content,
    totalElements: result.totalElements,
  };
}

async function handleFetchDocument(documentUuid: string): Promise<ExtensionResponse> {
  const document = await apiGet<EstimateDocumentDto>(`/document/${documentUuid}`);

  // Cache tab info in session storage for the Side Panel tab picker
  // Uses typed storage helper from lib/storage.ts
  try {
    const tabCache = (document.documentContent.tabs ?? []).map((t) => ({
      tab_id: t.tab_id,
      tab_name: t.tab_name,
      tab_order: t.tab_order,
    }));
    await cacheDocumentTabs(documentUuid, tabCache);
  } catch (e) {
    console.warn('[rerum-ext] Failed to cache tabs:', e);
  }

  return { type: 'DOCUMENT_RESULT', document };
}

/**
 * Basic SSRF guard: accept only http/https URLs that are not localhost or
 * private-range IPs. Blocks about:, file:, data: and other non-web schemes.
 */
function isValidProductUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname;
    // Reject loopback and link-local
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
    // Reject private IPv4 ranges (10.x, 172.16-31.x, 192.168.x)
    if (/^10\./.test(hostname)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return false;
    if (/^192\.168\./.test(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

async function handleExtractProduct(
  productUrl: string,
  tabId?: number,
  documentUuid?: string,
): Promise<ExtensionResponse> {
  if (!isValidProductUrl(productUrl)) {
    throw new ApiError(400, 'Invalid product URL');
  }

  const params: Record<string, string> = {};
  if (documentUuid) {
    params.documentUuid = documentUuid;
  }

  // Attempt to capture rendered page content from the tab via the scripting API.
  // This bypasses server-side scraping and avoids anti-bot 503 errors (Allegro, Amazon, etc.).
  // Falls back to URL-only (backend scrapes) if injection fails (e.g. chrome:// pages).
  const requestBody: Record<string, unknown> = { productUrl };
  if (tabId != null) {
    try {
      const results = await browser.scripting.executeScript({
        target: { tabId },
        func: extractPageContent,
      });
      const content = results[0]?.result as { pageText: string; images: Array<{ url: string; alt: string }> } | undefined;
      if (content?.pageText) {
        requestBody.pageText = content.pageText;
        requestBody.images = content.images ?? [];
        console.log('[rerum-ext] Page content captured for extraction:', content.pageText.length, 'chars,', (content.images ?? []).length, 'images');
      }
    } catch (err) {
      console.warn('[rerum-ext] Content capture failed, falling back to URL-only scraping:', err);
    }
  }

  const extraction = await apiPost<Record<string, unknown>>(
    '/estimate/dynamic',
    requestBody,
    params,
  );

  const data = toExtractedProductData(extraction);
  return { type: 'EXTRACT_RESULT', data };
}

async function handleAddRowToDocument(
  documentUuid: string,
  tabId: string,
  newRow: EstimateRecordApi,
): Promise<ExtensionResponse> {
  try {
    await apiPost<void>(`/document/${documentUuid}/tab/${tabId}/rows`, newRow);
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        type: 'ADD_ROW_RESULT',
        success: false,
        error: err.message,
        status: err.status,
        errorCode: err.errorCode,
      };
    }
    throw err;
  }

  // Invalidate the cached tabs for this document (row count changed)
  try {
    await invalidateDocumentCache(documentUuid);
  } catch (err) {
    console.warn('[rerum-ext] Failed to invalidate document cache:', err);
  }

  return { type: 'ADD_ROW_RESULT', success: true };
}

async function handleExtractPageData(tabId: number): Promise<ExtensionResponse> {
  // Inject the self-contained extraction function into the active tab.
  // This can fail on pages where the extension lacks host permissions
  // (e.g. arbitrary product pages) — return a clean error so the side
  // panel can fall back to using the tab URL.
  let results;
  try {
    results = await browser.scripting.executeScript({
      target: { tabId },
      func: extractPageData,
    });
  } catch {
    return {
      type: 'ERROR',
      status: 0,
      error: 'No permission to access this page',
    };
  }

  const rawResult = results[0]?.result as unknown;
  const pageData = sanitizePageData(rawResult);

  if (!pageData) {
    return {
      type: 'ERROR',
      status: 0,
      error: 'Could not extract page data from this tab',
    };
  }

  return { type: 'PAGE_DATA_RESULT', pageData };
}

async function handleFetchUsage(): Promise<ExtensionResponse> {
  const usage = await apiGet<UsageDto>('/subscription/usage');
  return { type: 'USAGE_RESULT', usage };
}

/**
 * I9: Get the currently active tab (moved from UI code).
 * Background SW owns all tab interactions.
 */
async function handleGetActiveTab(): Promise<ExtensionResponse> {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (!activeTab) {
      return { type: 'ACTIVE_TAB_RESULT', tabId: null, url: null };
    }

    return {
      type: 'ACTIVE_TAB_RESULT',
      tabId: activeTab.id ?? null,
      url: activeTab.url ?? null,
    };
  } catch (err) {
    console.error('[rerum-ext] Failed to query active tab:', err);
    return { type: 'ACTIVE_TAB_RESULT', tabId: null, url: null };
  }
}

// ---------------------------------------------------------------------------
// Background Service Worker entry point
// ---------------------------------------------------------------------------

export default defineBackground(() => {
  // -----------------------------------------------------------------------
  // 1. SIDE PANEL SETUP
  // -----------------------------------------------------------------------

  // Open the side panel when the user clicks the extension icon.
  //
  // We use action.onClicked instead of setPanelBehavior({ openPanelOnActionClick: true })
  // because the latter consumes the click event at the browser level before the
  // extension listener fires — preventing the 'activeTab' permission from being
  // granted. With action.onClicked the permission IS granted, which lets us call
  // browser.scripting.executeScript() on the current tab during extraction.
  //
  // Fall back to setPanelBehavior for browsers that support sidePanel but not
  // sidePanel.open (e.g. older Chrome builds / Firefox sidebar).
  if (browser.sidePanel?.open) {
    browser.action.onClicked.addListener((tab) => {
      if (tab.windowId != null) {
        browser.sidePanel.open({ windowId: tab.windowId }).catch((err: unknown) => {
          console.warn('[rerum-ext] Failed to open side panel:', err);
        });
      }
    });
  } else if (browser.sidePanel?.setPanelBehavior) {
    browser.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((err: unknown) => {
        console.warn('[rerum-ext] Failed to set sidePanel behavior:', err);
      });
  }

  // -----------------------------------------------------------------------
  // 2. MESSAGE HANDLER
  // -----------------------------------------------------------------------

  browser.runtime.onMessage.addListener(
    (
      message: ExtensionMessage,
      _sender: browser.Runtime.MessageSender,
      sendResponse: (response: ExtensionResponse) => void,
    ): true => {
      // Ignore internal broadcast messages (e.g. AUTH_STATE_CHANGED) that are
      // not part of the request/response protocol.  They are handled by
      // dedicated listeners in the Side Panel.
      const knownType = (message as { type?: string })?.type;
      if (knownType === 'AUTH_STATE_CHANGED') {
        sendResponse({ type: 'LOGOUT_RESULT' }); // no-op ack
        return true;
      }

      // All handlers are async; return true to keep the message channel open.
      (async () => {
        try {
          let response: ExtensionResponse;

          switch (message.type) {
            case 'CHECK_AUTH':
              response = await handleCheckAuth();
              break;

            case 'FETCH_DOCUMENTS':
              response = await handleFetchDocuments(
                message.page,
                message.size,
                message.search,
                message.sort,
              );
              break;

            case 'FETCH_DOCUMENT':
              response = await handleFetchDocument(message.documentUuid);
              break;

            case 'EXTRACT_PRODUCT':
              response = await handleExtractProduct(
                message.productUrl,
                message.tabId,
                message.documentUuid,
              );
              break;

            case 'ADD_ROW_TO_DOCUMENT':
              response = await handleAddRowToDocument(
                message.documentUuid,
                message.tabId,
                message.row,
              );
              break;

            case 'EXTRACT_PAGE_DATA':
              response = await handleExtractPageData(message.tabId);
              break;

            case 'FETCH_USAGE':
              response = await handleFetchUsage();
              break;

            case 'GET_ACTIVE_TAB':
              response = await handleGetActiveTab();
              break;

            case 'LOGOUT':
              response = await handleLogout();
              break;

            default: {
              const exhaustiveCheck: never = message;
              response = {
                type: 'ERROR',
                status: 0,
                error: `Unknown message type: ${(exhaustiveCheck as ExtensionMessage).type}`,
              };
            }
          }

          sendResponse(response);
        } catch (err) {
          if (err instanceof ApiError) {
            sendResponse({
              type: 'ERROR',
              status: err.status,
              error: err.message,
              errorCode: err.errorCode,
            });
          } else {
            console.error('[rerum-ext] Unhandled error in message handler:', err);
            sendResponse({
              type: 'ERROR',
              status: 0,
              error: err instanceof Error ? err.message : 'An unexpected error occurred',
            });
          }
        }
      })();

      // Return true synchronously to indicate we will call sendResponse asynchronously
      return true;
    },
  );

  // -----------------------------------------------------------------------
  // 3. TAB TRACKING (badge indicator)
  // -----------------------------------------------------------------------

  /**
   * Update the badge for the given tab. Inject the extraction function to
   * check for product signals and set "!" badge on product pages.
   */
  async function updateBadgeForTab(tabId: number): Promise<void> {
    try {
      // Only attempt injection if we have a valid tab
      const tab = await browser.tabs.get(tabId);
      if (!tab.url || !/^https?:\/\//.test(tab.url)) {
        await browser.action.setBadgeText({ text: '', tabId });
        return;
      }

      const results = await browser.scripting.executeScript({
        target: { tabId },
        func: extractPageData,
      });

      const rawResult = results[0]?.result as unknown;
      const pageData = sanitizePageData(rawResult);

      if (pageData && pageData.confidence === 'high') {
        await browser.action.setBadgeText({ text: '!', tabId });
        await browser.action.setBadgeBackgroundColor({ color: '#667eea', tabId });
      } else {
        await browser.action.setBadgeText({ text: '', tabId });
      }
    } catch {
      // Content script injection can fail on privileged pages (chrome://, etc.)
      // Silently clear the badge
      try {
        await browser.action.setBadgeText({ text: '', tabId });
      } catch {
        // Ignore -- tab may have been closed
      }
    }
  }

  // When the user activates a different tab, update the badge
  browser.tabs.onActivated.addListener((activeInfo) => {
    updateBadgeForTab(activeInfo.tabId).catch(() => {
      // Non-critical
    });
  });

  // When a tab finishes loading, update the badge (handles navigation)
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
      updateBadgeForTab(tabId).catch(() => {
        // Non-critical
      });
    }
  });

  // -----------------------------------------------------------------------
  // 4. AUTH STATE MONITORING
  // -----------------------------------------------------------------------

  // Watch for session cookie changes to detect login / logout / expiry
  if (browser.cookies?.onChanged) {
    browser.cookies.onChanged.addListener((changeInfo) => {
      const { cookie, removed } = changeInfo;
      // Normalise cookie domain: strip leading dot (e.g. ".rerum.studio" → "rerum.studio")
      const cookieDomain = cookie.domain ? cookie.domain.replace(/^\./, '') : '';
      const appHostname = (() => { try { return new URL(RERUM_BASE_URL).hostname; } catch { return ''; } })();
      // Localhost cookies often have an empty domain string in the Chrome cookie API,
      // so treat empty domain as a match when the target host is localhost.
      const domainMatches =
        appHostname !== '' &&
        (appHostname === cookieDomain ||
          appHostname.endsWith('.' + cookieDomain) ||
          (appHostname === 'localhost' && cookieDomain === ''));
      if (
        // Spring Session JDBC uses 'SESSION' as the cookie name (not 'JSESSIONID')
        cookie.name === 'SESSION' &&
        domainMatches
      ) {
        // Invalidate the stale CSRF token — it is tied to the old session and
        // will be rejected by the server.  ensureCsrfToken() will re-fetch on
        // the next mutating request.
        browser.cookies
          .remove({ url: RERUM_BASE_URL, name: 'XSRF-TOKEN' })
          .catch(() => {
            // Non-critical
          });

        if (removed) {
          // Session cookie removed -- user may have logged out or session expired
          // Clear cached auth state
          browser.storage.session
            .remove(['authState'])
            .catch(() => {
              // Non-critical
            });
        }
        // Notify any open Side Panel(s) about the auth state change.
        // They can re-check auth on receipt.
        browser.runtime
          .sendMessage({ type: 'AUTH_STATE_CHANGED' as string })
          .catch(() => {
            // No listener (Side Panel not open) -- expected, ignore
          });
      }
    });
  }

  // -----------------------------------------------------------------------
  // 5. KEEPALIVE PORT
  // -----------------------------------------------------------------------

  // The Side Panel can open a long-lived port to prevent the SW from going
  // idle during lengthy operations (e.g. AI extraction).
  browser.runtime.onConnect.addListener((port) => {
    if (port.name === 'keepalive') {
      // Simply holding the port open keeps the SW alive.
      // When the Side Panel disconnects, the port closes automatically.
      port.onDisconnect.addListener(() => {
        // Port closed -- SW can go idle again
      });
    }
  });

  // -----------------------------------------------------------------------
  // 6. CSRF TOKEN PRE-FETCH
  // -----------------------------------------------------------------------

  // Pre-fetch the CSRF token at SW startup so the first mutating API call
  // (e.g. POST /api/estimate/dynamic) doesn't need an extra round-trip.
  // This is best-effort: if it fails the token will be fetched on demand.
  ensureCsrfToken().catch((err: unknown) => {
    console.warn('[rerum-ext] CSRF pre-fetch on init failed (will retry on first request):', err);
  });

  // Load stored language preference into the in-memory cache.
  loadLanguagePreference().catch(() => {});

  console.log('[rerum-ext] Background service worker initialized');
});
