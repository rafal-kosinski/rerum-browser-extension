/**
 * Extension-wide constants.
 *
 * RERUM_BASE_URL / RERUM_API_URL are resolved from the WXT import.meta.env at
 * build time so that dev / staging / production builds point at the correct
 * origin without code changes.
 */

/** Root URL of the Rerum backend API server (no trailing slash). */
export const RERUM_BASE_URL: string =
  import.meta.env.VITE_RERUM_BASE_URL ?? 'https://app.rerum.studio';

/** API base URL (all REST endpoints live under this prefix). */
export const RERUM_API_URL = `${RERUM_BASE_URL}/api`;

/**
 * Root URL of the Rerum web application (no trailing slash).
 *
 * In production this is identical to RERUM_BASE_URL (backend serves the SPA).
 * In development the frontend runs on a separate port (e.g. localhost:5173)
 * while the backend is on localhost:8080, so set VITE_RERUM_APP_URL to point
 * at the frontend dev server.
 */
export const RERUM_APP_URL: string =
  import.meta.env.VITE_RERUM_APP_URL ?? RERUM_BASE_URL;

/** Semantic version of the browser extension (mirrors manifest.version). */
export const EXTENSION_VERSION = '1.0.0';

/** Value sent in the `X-Rerum-Client` request header for log attribution. */
export const RERUM_CLIENT_HEADER = `extension/${EXTENSION_VERSION}`;

/**
 * Known system-field keys returned by the dynamic extraction endpoint
 * (`POST /api/estimate/dynamic`).  Any key **not** in this set is treated as a
 * custom-column value and placed into `custom_fields` on the row.
 */
export const SYSTEM_FIELDS = new Set<string>([
  'productName',
  'manufacturer',
  'pricePerUnit',
  'productImageUrl',
  'productUrl',
  'quantity',
  'comment',
]);
