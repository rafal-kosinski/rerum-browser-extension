/**
 * AUTO-GENERATED — DO NOT EDIT
 *
 * This file was copied from rerum-frontend by scripts/sync-shared-types.js.
 * To make changes, edit the source file in rerum-frontend and re-run:
 *
 *   npm run sync-types
 *
 * Source: rerum-frontend/src/entities/estimate/types.ts
 * Synced: 2026-02-28T00:16:26.380Z
 */

// API Types (snake_case - from backend)
export type EstimateRecordApi = {
  product_name: string | null;
  manufacturer: string | null;
  price_per_unit: string | null; // string on API, parse to number for UI
  quantity: number | null;
  product_image_url: string | null;
  product_url: string | null;
  comment: string | null;
  custom_fields?: Record<string, string | null> | null; // User-defined custom column values
};

export type EstimateTabApi = {
  tab_id: string;
  tab_name: string;
  tab_order: number;
  estimate_record_list: EstimateRecordApi[];
};


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

export type DocumentContentApi = {
  columns?: string[]; // Read-only computed field: visible column keys in display order (from column_definitions)
  column_definitions?: ColumnDefinitionApi[] | null; // Full column config (new format v0.2.0)
  tabs?: EstimateTabApi[]; // Optional to handle backend returning null/undefined
};

export type LockedReason = 'subscription_downgrade' | 'payment_failed' | 'subscription_canceled';

export type EstimateDocumentApi = {
  id: number;
  uuid: string;
  userId: number;
  documentName: string;
  description?: string | null;
  documentContent: DocumentContentApi;
  contentVersion: string;
  shareToken?: string | null;
  isShared?: boolean;
  isLocked?: boolean;
  lockedAt?: string | null;
  lockedReason?: LockedReason | null;
  created: string;
  updated: string;
};

// UI Types (camelCase - for frontend use)
export type EstimateRecord = {
  id: string; // local row id (generate with crypto.randomUUID() for new rows)
  productName?: string | null;
  manufacturer?: string | null;
  pricePerUnit?: number | null;
  quantity?: number | null;
  productImageUrl?: string | null;
  productUrl?: string | null;
  comment?: string | null;
  total?: number | null; // computed: pricePerUnit × quantity
  customFields?: Record<string, string | null>; // User-defined custom column values
};

export type EstimateTab = {
  tabId: string;
  tabName: string;
  tabOrder: number;
  estimateRecordList: EstimateRecord[];
};


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

export type DocumentContent = {
  columns: string[]; // Visible column keys for grid display (computed from columnDefinitions)
  columnDefinitions?: ColumnDefinition[] | null; // Full column config
  tabs: EstimateTab[]; // Always use tabs in UI (even for old documents - migrate on load)
};

export type EstimateDocument = {
  id: number;
  uuid: string;
  userId: number;
  documentName: string;
  description?: string | null;
  documentContent: DocumentContent;
  contentVersion: string;
  shareToken?: string | null;
  isShared?: boolean;
  isLocked?: boolean;
  lockedAt?: string | null;
  lockedReason?: LockedReason | null;
  created: string;
  updated: string;
};

// Estimates list types
export type EstimateSummary = {
  uuid: string;
  documentName: string;
  isLocked?: boolean;
  lockedReason?: LockedReason | null;
  created: string;
  updated: string;
};

export type EstimatesListResponse = {
  content: EstimateSummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

// Shared document types (public access)
export type SharedEstimateDocumentApi = {
  uuid: string;
  documentName: string;
  description?: string | null;
  documentContent: DocumentContentApi;
  created: string;
  updated: string;
};

export type SharedEstimateDocument = {
  uuid: string;
  documentName: string;
  description?: string | null;
  documentContent: DocumentContent; // Uses tabs after migration
  created: string;
  updated: string;
};

// Share status response
export type ShareStatusResponse = {
  isShared: boolean;
  shareToken: string | null;
  shareUrl: string | null;
};

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
