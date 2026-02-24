# CLAUDE.md - Browser Extension

This file provides guidance for working with the Rerum browser extension (WXT + React).

## Project Overview

Rerum Extension is a cross-browser extension (Chrome, Firefox, Edge) that allows users to extract product data from any web page using Rerum's AI engine and add it directly to their estimate documents. It communicates with the existing Rerum backend API through a Background Service Worker.

For the full implementation plan, see `/RERUM_BROWSER_EXTENSION_PLAN.md` in the monorepo root.

## Essential Commands

```bash
# Install dependencies
npm install

# Development with HMR
npm run dev                # Chrome (default)
npm run dev:firefox        # Firefox

# Production builds
npm run build              # Chrome -> .output/chrome-mv3/
npm run build:firefox      # Firefox -> .output/firefox-mv2/
npm run build:edge         # Edge -> .output/edge-mv3/

# Create distributable ZIPs
npm run zip                # Chrome ZIP
npm run zip:firefox        # Firefox ZIP

# Code quality
npm run lint               # ESLint
npm test                   # Vitest (single run)

# Sync types from rerum-frontend
npm run sync-types
```

## Multi-Environment Builds

The `RERUM_API_ORIGIN` env var controls which Rerum backend the extension talks to:

```bash
# Development (default when running `npm run dev`)
RERUM_API_ORIGIN='http://localhost:8080/*' npm run dev

# Staging
RERUM_API_ORIGIN='https://staging.rerum.studio/*' npm run build

# Production (default when running `npm run build`)
npm run build
```

## Architecture

### Directory Structure

```
rerum-extension/
  assets/               # Extension icons (16, 32, 48, 128px PNG)
  entrypoints/          # WXT auto-discovered entrypoints
    background.ts       # Service Worker — API relay, CSRF, message routing
    content.ts          # Content script — page data extraction (injected on demand)
    sidepanel/          # Side Panel React app (Chrome/Edge)
      index.html
      main.tsx
      App.tsx
    popup/              # Popup fallback (Safari, browsers without Side Panel)
      index.html
      main.tsx
      App.tsx
  components/           # Shared React components (AuthGate, ProductPreview, etc.)
  hooks/                # React hooks (useAuth, useDocuments, useExtractProduct, etc.)
  lib/                  # Utilities (api client, messaging, storage, sanitize, constants)
  shared-types/         # Types synced from rerum-frontend (auto-generated, do not edit)
  scripts/              # Build scripts (sync-shared-types.js)
  wxt.config.ts         # WXT configuration with manifest-as-function pattern
  tsconfig.json         # TypeScript config
  package.json          # Dependencies and scripts
```

### Key Architectural Patterns

- **Background Service Worker** handles all API calls (avoids CORS), CSRF token management, and message routing
- **Content script** is injected programmatically via `scripting` API (not statically registered) to avoid `<all_urls>` permission
- **Side Panel** is the primary UI surface (Chrome/Edge); Firefox uses `sidebarAction`; Safari falls back to popup
- **Cookie-based auth** shares the browser's session with the Rerum web app
- **Message passing** between Side Panel and Background SW uses a typed protocol (see `lib/messaging.ts`)
- **Zustand** for client state; `chrome.storage.session` for state that must survive SW restarts

### Data Format

- Backend JSON uses `snake_case` inside JSONB (`product_name`, `price_per_unit`)
- Backend DTOs use `camelCase` at the top level (`documentName`, `documentContent`)
- The extension must handle this hybrid format (see implementation plan Section 6)

### Shared Types

Types are synced from `rerum-frontend` via `npm run sync-types`. The synced files in `shared-types/` should not be edited manually. To update, modify the source in `rerum-frontend` and re-run the sync script.

## Assets

Extension icons (`assets/icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`) need to be designed and added. The `assets/` directory currently contains only a `.gitkeep` placeholder.

## Permissions

The extension uses the principle of least privilege:
- `activeTab` — access current tab URL when user clicks the icon
- `scripting` — inject content script on demand
- `sidePanel` — display the Side Panel UI
- `storage` — persist user preferences
- `cookies` — read XSRF-TOKEN for CSRF protection
- `host_permissions` — only the Rerum API domain

## Testing

Tests use Vitest. MSW is available for mocking the Rerum backend API in integration tests.

```bash
npm test                   # Run all tests
```

## Code Conventions

- Use **named imports** from `@mui/material` (for tree-shaking)
- Use **function declarations** for React components (not arrow functions)
- Target total bundle size under 1 MB compressed
- All content script data must be sanitized in the Background SW before use
