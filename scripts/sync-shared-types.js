#!/usr/bin/env node

/**
 * Syncs shared type definitions from rerum-frontend into the extension's
 * shared-types/ directory. This ensures the extension uses the same data
 * models as the web frontend without introducing a shared package.
 *
 * Source files:
 *   ../rerum-frontend/src/entities/estimate/types.ts       -> shared-types/estimate.ts
 *   ../rerum-frontend/src/shared/lib/mappers/estimateMapper.ts -> shared-types/mappers.ts
 *
 * Post-processing applied to estimate.ts:
 *   - Replaces `import type { ColumnDefinitionApi } from 'entities/columnConfig'`
 *     with an inline type definition (the 'entities/columnConfig' alias only
 *     resolves in the rerum-frontend build context, not in the extension).
 *   - Replaces `import type { ColumnDefinition } from 'entities/columnConfig'`
 *     with an inline type definition.
 *   - Appends extension-specific types (UserDto, PageData, ExtractedProductData,
 *     EstimateDocumentDto, etc.) that are only needed by the extension.
 *
 * Usage:
 *   node scripts/sync-shared-types.js
 *
 * This script is also wired into the build via the "prebuild" npm script
 * and can be run manually via "npm run sync-types".
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EXTENSION_ROOT = resolve(__dirname, '..');
const FRONTEND_ROOT = resolve(EXTENSION_ROOT, '..', 'rerum-frontend');
const SHARED_TYPES_DIR = resolve(EXTENSION_ROOT, 'shared-types');

// ---------------------------------------------------------------------------
// Inline types to replace broken 'entities/columnConfig' imports
// ---------------------------------------------------------------------------

const COLUMN_CONFIG_API_TYPE = `
// ---------------------------------------------------------------------------
// Column config types
// (inlined from rerum-frontend/src/entities/columnConfig/types.ts — the
//  'entities/columnConfig' path alias only resolves in rerum-frontend)
// ---------------------------------------------------------------------------

export type ColumnType = 'string' | 'number' | 'integer' | 'url' | 'computed';

/** API format (snake_case from backend) */
export interface ColumnDefinitionApi {
  column_key: string;
  is_system_column: boolean;
  system_column_id: string | null;
  display_name: string;
  display_order: number;
  is_visible: boolean;
  column_width: number | null;
  column_type: ColumnType;
  ai_enabled: boolean;
  ai_description: string | null;
}
`;

const COLUMN_DEFINITION_TYPE = `
/** UI format (camelCase for frontend) */
export interface ColumnDefinition {
  columnKey: string;
  isSystemColumn: boolean;
  systemColumnId: string | null;
  displayName: string;
  displayOrder: number;
  isVisible: boolean;
  columnWidth: number | null;
  columnType: ColumnType;
  aiEnabled: boolean;
  aiDescription: string | null;
}
`;

// ---------------------------------------------------------------------------
// Extension-specific types appended after the synced content
// ---------------------------------------------------------------------------

const EXTENSION_TYPES_FOOTER = `
// ---------------------------------------------------------------------------
// Extension-specific types
// (not present in rerum-frontend — added by sync-shared-types.js)
// ---------------------------------------------------------------------------

/**
 * Full document DTO used by the extension — aliases EstimateDocumentApi.
 * The extension works with raw API format (snake_case inside JSONB, camelCase wrapper).
 */
export type EstimateDocumentDto = EstimateDocumentApi;

/** Document summary for the picker list — aliases EstimateSummary */
export type EstimateDocumentSummary = EstimateSummary;

/** Paginated documents response — aliases EstimatesListResponse */
export type PagedEstimateDocumentsDto = EstimatesListResponse;

/** Authenticated user info returned by GET /api/auth/me */
export type UserDto = {
  id: number;
  email: string;
  name: string | null;
  picture: string | null;
  accountType: string;
};

/** Alias kept for hook backward compatibility */
export type UserInfo = UserDto;

/** Product page detection confidence */
export type ProductConfidence = 'high' | 'medium' | 'low';

/**
 * Product hints extracted from page metadata by the content script.
 * Passed through sanitizeHints() in the Background SW before use.
 */
export type ProductHints = {
  jsonLd?: boolean;
  name?: string;
  price?: string;
  image?: string;
  manufacturer?: string;
};

/** Sanitized page data returned by handleExtractPageData in background.ts */
export type PageData = {
  url: string;
  title: string;
  images: string[];
  hints: ProductHints;
  confidence: ProductConfidence;
};

/** AI-extracted product data returned by POST /api/estimate/dynamic */
export type ExtractedProductData = {
  productName: string | null;
  manufacturer: string | null;
  /** Kept as string to match backend contract — do not parse to number */
  pricePerUnit: string | null;
  productImageUrl: string | null;
  productUrl: string | null;
  /** Custom field values keyed by column_key */
  customFields: Record<string, string> | null;
};

/** Subscription and AI usage returned by GET /api/subscription/usage */
export type UsageDto = {
  aiAutofillUsed: number;
  aiAutofillLimit: number;
  documentsUsed: number;
  documentsLimit: number;
  rowsPerDocumentLimit: number;
  periodStart: string;
  periodEnd: string;
};
`;

// ---------------------------------------------------------------------------
// File mappings
// ---------------------------------------------------------------------------

const FILE_MAPPINGS = [
  {
    source: resolve(FRONTEND_ROOT, 'src', 'entities', 'estimate', 'types.ts'),
    destination: resolve(SHARED_TYPES_DIR, 'estimate.ts'),
    description: 'Estimate entity types',
    postProcess: patchEstimateTypes,
  },
];

const HEADER = `/**
 * AUTO-GENERATED — DO NOT EDIT
 *
 * This file was copied from rerum-frontend by scripts/sync-shared-types.js.
 * To make changes, edit the source file in rerum-frontend and re-run:
 *
 *   npm run sync-types
 *
 * Source: {{SOURCE_PATH}}
 * Synced: {{TIMESTAMP}}
 */

`;

// ---------------------------------------------------------------------------
// Post-processing: fix estimate.ts for extension context
// ---------------------------------------------------------------------------

/**
 * Patches the synced estimate.ts to work in the extension build context:
 *
 * 1. Replaces `import type { ColumnDefinitionApi } from 'entities/columnConfig'`
 *    with an inline ColumnDefinitionApi interface.
 * 2. Replaces `import type { ColumnDefinition } from 'entities/columnConfig'`
 *    with an inline ColumnDefinition interface.
 * 3. Appends extension-specific types at the end.
 */
function patchEstimateTypes(content) {
  // Replace the ColumnDefinitionApi import with inline type
  content = content.replace(
    /import type \{ ColumnDefinitionApi \} from ['"]entities\/columnConfig['"];?\n?/,
    COLUMN_CONFIG_API_TYPE
  );

  // Replace the ColumnDefinition import with inline type
  content = content.replace(
    /import type \{ ColumnDefinition \} from ['"]entities\/columnConfig['"];?\n?/,
    COLUMN_DEFINITION_TYPE
  );

  // Append extension-specific types
  content = content + EXTENSION_TYPES_FOOTER;

  return content;
}

// ---------------------------------------------------------------------------
// File sync logic
// ---------------------------------------------------------------------------

function ensureDirectoryExists(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
    console.log(`  Created directory: ${dirPath}`);
  }
}

function syncFile({ source, destination, description, postProcess }) {
  const relativeSource = source.replace(resolve(EXTENSION_ROOT, '..') + '/', '');

  if (!existsSync(source)) {
    console.warn(
      `  WARNING: Source file not found, skipping "${description}":\n` +
        `           ${relativeSource}`
    );
    return false;
  }

  let content = readFileSync(source, 'utf-8');

  if (postProcess) {
    content = postProcess(content);
  }

  const header = HEADER.replace('{{SOURCE_PATH}}', relativeSource).replace(
    '{{TIMESTAMP}}',
    new Date().toISOString()
  );

  writeFileSync(destination, header + content, 'utf-8');

  const relativeDest = destination.replace(EXTENSION_ROOT + '/', '');
  console.log(`  Synced: ${relativeSource} -> ${relativeDest}`);
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log('Syncing shared types from rerum-frontend...\n');

  if (!existsSync(FRONTEND_ROOT)) {
    console.error(
      `ERROR: rerum-frontend directory not found at:\n  ${FRONTEND_ROOT}\n\n` +
        'Make sure you are running this script from the rerum-extension directory\n' +
        'and that rerum-frontend exists as a sibling directory.'
    );
    process.exit(1);
  }

  ensureDirectoryExists(SHARED_TYPES_DIR);

  let successCount = 0;
  let skipCount = 0;

  for (const mapping of FILE_MAPPINGS) {
    if (syncFile(mapping)) {
      successCount++;
    } else {
      skipCount++;
    }
  }

  console.log(
    `\nDone. ${successCount} file(s) synced, ${skipCount} file(s) skipped.`
  );

  if (skipCount > 0) {
    console.warn(
      '\nSome files were skipped because the source was not found.\n' +
        'This is expected if rerum-frontend types have been restructured.\n' +
        'Update the FILE_MAPPINGS in this script if paths have changed.'
    );
  }
}

main();
