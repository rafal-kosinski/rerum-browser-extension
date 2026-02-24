/// <reference types="vite/client" />
/// <reference types="wxt/client" />

/**
 * Vite environment variable type definitions for the Rerum browser extension.
 *
 * All custom env vars must be prefixed with `VITE_` to be exposed to the client.
 */
interface ImportMetaEnv {
  /**
   * Base URL of the Rerum web application (no trailing slash).
   *
   * Examples:
   *   - Development: `http://localhost:8080`
   *   - Staging: `https://staging.rerum.studio`
   *   - Production: `https://app.rerum.studio`
   */
  readonly VITE_RERUM_BASE_URL?: string;
  /**
   * Base URL of the Rerum frontend web app (no trailing slash).
   *
   * Only needed in development when the frontend runs on a different port
   * than the backend (e.g. `http://localhost:5173`).
   * Defaults to VITE_RERUM_BASE_URL when not set.
   */
  readonly VITE_RERUM_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
