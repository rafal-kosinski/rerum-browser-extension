/**
 * AUTO-GENERATED — DO NOT EDIT
 *
 * This file was copied from rerum-frontend by scripts/sync-shared-types.js.
 * To make changes, edit the source file in rerum-frontend and re-run:
 *
 *   npm run sync-types
 *
 * Source: rerum-frontend/src/shared/lib/mappers/estimateMapper.ts
 * Synced: 2026-02-24T22:21:21.335Z
 */

import Decimal from 'decimal.js';
import type {
  EstimateDocumentApi,
  EstimateDocument,
  EstimateRecordApi,
  EstimateRecord,
  DocumentContentApi,
  DocumentContent,
  EstimateTabApi,
  EstimateTab,
  SharedEstimateDocumentApi,
  SharedEstimateDocument,
} from 'entities/estimate';
import { mapColumnDefinitionApiToUi, mapColumnDefinitionUiToApi } from './columnConfigMapper';
import { getDefaultColumnKeys } from './defaultColumns';

/**
 * Safely parse price_per_unit string to number
 * Uses Decimal.js for precise currency calculations
 */
function parsePricePerUnit(value: string | null): number | null {
  if (!value || value.trim() === '') {
    return null;
  }
  try {
    return new Decimal(value).toNumber();
  } catch {
    return null;
  }
}

/**
 * Calculate total: pricePerUnit × quantity
 * Uses Decimal.js for precise currency calculations
 */
function calculateTotal(pricePerUnit: number | null, quantity: number | null): number | null {
  if (pricePerUnit === null || quantity === null) {
    return null;
  }
  return new Decimal(pricePerUnit).times(quantity).toNumber();
}

/**
 * Format price to string with two decimal places
 */
function formatPricePerUnit(value: number | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return new Decimal(value).toFixed(2);
}

/**
 * Convert API snake_case record to UI camelCase record
 */
function mapRecordApiToUi(apiRecord: EstimateRecordApi): EstimateRecord {
  const pricePerUnit = parsePricePerUnit(apiRecord.price_per_unit);
  const quantity = apiRecord.quantity;
  const total = calculateTotal(pricePerUnit, quantity);

  // Convert custom_fields to customFields (already in correct key format from backend)
  const customFields = apiRecord.custom_fields
    ? { ...apiRecord.custom_fields }
    : undefined;

  return {
    id: crypto.randomUUID(), // Generate local row ID
    productName: apiRecord.product_name,
    manufacturer: apiRecord.manufacturer,
    pricePerUnit,
    quantity,
    productImageUrl: apiRecord.product_image_url,
    productUrl: apiRecord.product_url,
    comment: apiRecord.comment,
    total,
    customFields,
  };
}

/**
 * Convert UI camelCase record to API snake_case record
 */
function mapRecordUiToApi(uiRecord: EstimateRecord): EstimateRecordApi {
  return {
    product_name: uiRecord.productName ?? null,
    manufacturer: uiRecord.manufacturer ?? null,
    price_per_unit: formatPricePerUnit(uiRecord.pricePerUnit ?? null),
    quantity: uiRecord.quantity ?? null,
    product_image_url: uiRecord.productImageUrl ?? null,
    product_url: uiRecord.productUrl ?? null,
    comment: uiRecord.comment ?? null,
    custom_fields: uiRecord.customFields ?? null,
  };
}

/**
 * Convert API snake_case tab to UI camelCase tab
 */
function mapTabApiToUi(apiTab: EstimateTabApi): EstimateTab {
  return {
    tabId: apiTab.tab_id,
    tabName: apiTab.tab_name,
    tabOrder: apiTab.tab_order,
    estimateRecordList: apiTab.estimate_record_list.map(mapRecordApiToUi),
  };
}

/**
 * Convert UI camelCase tab to API snake_case tab
 */
function mapTabUiToApi(uiTab: EstimateTab): EstimateTabApi {
  return {
    tab_id: uiTab.tabId,
    tab_name: uiTab.tabName,
    tab_order: uiTab.tabOrder,
    estimate_record_list: uiTab.estimateRecordList.map(mapRecordUiToApi),
  };
}

/**
 * Convert API document content to UI document content
 */
function mapContentApiToUi(apiContent: DocumentContentApi): DocumentContent {
  // Map column definitions if present
  const columnDefinitions = apiContent.column_definitions
    ? apiContent.column_definitions.map(mapColumnDefinitionApiToUi)
    : null;

  // Compute visible column keys from columnDefinitions, or fall back to defaults
  let columns: string[];
  if (columnDefinitions) {
    columns = columnDefinitions
      .filter((col) => col.isVisible)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((col) => col.columnKey);
  } else {
    columns = getDefaultColumnKeys();
  }

  // Safety check: if tabs is missing or empty, create a default tab
  if (!apiContent.tabs || apiContent.tabs.length === 0) {
    return {
      columns,
      columnDefinitions,
      tabs: [{
        tabId: crypto.randomUUID(),
        tabName: 'Tab 1',
        tabOrder: 0,
        estimateRecordList: [],
      }],
    };
  }

  return {
    columns,
    columnDefinitions,
    tabs: apiContent.tabs.map(mapTabApiToUi),
  };
}

/**
 * Convert UI document content to API document content
 */
export function mapContentUiToApi(uiContent: DocumentContent): DocumentContentApi {
  return {
    column_definitions: uiContent.columnDefinitions
      ? uiContent.columnDefinitions.map(mapColumnDefinitionUiToApi)
      : null,
    tabs: uiContent.tabs.map(mapTabUiToApi),
  };
}

/**
 * Map API EstimateDocument (snake_case) to UI EstimateDocument (camelCase)
 * - Converts snake_case keys to camelCase
 * - Parses price_per_unit strings to numbers
 * - Calculates total for each record
 * - Generates local id for each row
 */
export function mapApiToUi(apiDoc: EstimateDocumentApi): EstimateDocument {
  return {
    id: apiDoc.id,
    uuid: apiDoc.uuid,
    userId: apiDoc.userId,
    documentName: apiDoc.documentName,
    description: apiDoc.description,
    documentContent: mapContentApiToUi(apiDoc.documentContent),
    contentVersion: apiDoc.contentVersion,
    shareToken: apiDoc.shareToken,
    isShared: apiDoc.isShared,
    isLocked: apiDoc.isLocked,
    lockedAt: apiDoc.lockedAt,
    lockedReason: apiDoc.lockedReason,
    created: apiDoc.created,
    updated: apiDoc.updated,
  };
}

/**
 * Map Shared API EstimateDocument to UI SharedEstimateDocument
 * Used for public shared estimate view (no auth required)
 */
export function mapSharedApiToUi(apiDoc: SharedEstimateDocumentApi): SharedEstimateDocument {
  return {
    uuid: apiDoc.uuid,
    documentName: apiDoc.documentName,
    description: apiDoc.description,
    documentContent: mapContentApiToUi(apiDoc.documentContent),
    created: apiDoc.created,
    updated: apiDoc.updated,
  };
}

/**
 * Map UI EstimateDocument (camelCase) to API EstimateDocument (snake_case)
 * - Converts camelCase to snake_case
 * - Formats pricePerUnit as string with two decimal places
 * - Removes computed total field
 * - Does NOT send contentVersion, created, or updated (managed by backend)
 */
export function mapUiToApi(uiDoc: EstimateDocument): Partial<EstimateDocumentApi> {
  return {
    id: uiDoc.id,
    uuid: uiDoc.uuid,
    userId: uiDoc.userId,
    documentName: uiDoc.documentName,
    description: uiDoc.description,
    documentContent: mapContentUiToApi(uiDoc.documentContent),
    // contentVersion, created, updated are managed by backend
  };
}

/**
 * Calculate subtotal for a single tab
 * Sums all row totals in the tab
 */
export function calculateTabSubtotal(tab: EstimateTab): number {
  return tab.estimateRecordList.reduce((sum: number, record: EstimateRecord) => {
    if (record.total !== null && record.total !== undefined) {
      return new Decimal(sum).plus(record.total).toNumber();
    }
    return sum;
  }, 0);
}

/**
 * Calculate grand total across all tabs
 * Sums all tab subtotals
 */
export function calculateGrandTotal(tabs: EstimateTab[]): number {
  return tabs.reduce((sum, tab) => {
    const tabSubtotal = calculateTabSubtotal(tab);
    return new Decimal(sum).plus(tabSubtotal).toNumber();
  }, 0);
}
