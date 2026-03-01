import { defineConfig } from 'wxt';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env into process.env manually because wxt.config.ts runs before
// Vite's .env loading. Without this, VITE_RERUM_BASE_URL and RERUM_API_ORIGIN
// from .env are invisible to the manifest builder, causing production builds
// to default to app.rerum.studio even when developing against localhost.
try {
  const envPath = resolve(import.meta.dirname ?? '.', '.env');
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^\s*([^#\s=]+)\s*=\s*(.*?)\s*$/);
    if (match && match[1] && !(match[1] in process.env)) {
      process.env[match[1]] = match[2] ?? '';
    }
  }
} catch { /* .env not found — use defaults */ }

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: '.',

  // Use a function to dynamically generate the manifest based on environment
  manifest: () => {
    const isDev = process.env.NODE_ENV === 'development';
    // Derive API origin from .env's VITE_RERUM_BASE_URL so that `npm run build`
    // in a dev environment gets the correct host_permissions (localhost:8080).
    const baseUrl = process.env.VITE_RERUM_BASE_URL ??
      (isDev ? 'http://localhost:8080' : 'https://app.rerum.studio');
    const apiOrigin = process.env.RERUM_API_ORIGIN ?? `${baseUrl}/*`;

    return {
      name: 'Rerum — Product Estimator',
      description:
        'Add products to your Rerum estimate documents from any webpage',
      version: '1.0.0',
      permissions: [
        'activeTab',
        'tabs',
        'scripting',
        'sidePanel',
        'storage',
        'cookies',
      ],
      host_permissions: [apiOrigin],
      // Broad host access is optional — requested at runtime on first Extract.
      // MV3 uses optional_host_permissions; transformManifest below adds
      // optional_permissions for MV2 (Firefox) since WXT strips
      // optional_host_permissions as an mv3-only key.
      optional_host_permissions: ['*://*/*'],
      action: {
        default_title: 'Open Rerum Estimator',
      },
      side_panel: {
        default_path: 'sidepanel/index.html',
      },
      // Firefox-specific settings (WXT includes these only in Firefox builds)
      browser_specific_settings: {
        gecko: {
          id: 'rerum-extension@rerum.studio',
          strict_min_version: '128.0',
        },
      },
    };
  },

  // For MV2 builds (Firefox), WXT strips optional_host_permissions. Add the
  // host pattern to optional_permissions instead so permissions.request() works.
  transformManifest(manifest) {
    if (manifest.manifest_version === 2 && !manifest.optional_permissions?.includes('*://*/*')) {
      manifest.optional_permissions = manifest.optional_permissions ?? [];
      manifest.optional_permissions.push('*://*/*');
    }
  },

  runner: {
    startUrls: ['https://www.amazon.com'],
  },
});
