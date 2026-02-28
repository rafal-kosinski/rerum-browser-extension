import type {
  EstimateDocumentDto,
  EstimateDocumentSummary,
  EstimateRecordApi,
  ExtractedProductData,
  PageData,
  ProductHints,
  UsageDto,
  UserDto,
} from '../shared-types/estimate';

// ---------------------------------------------------------------------------
// Messages: Side Panel / Content Script --> Background Service Worker
// ---------------------------------------------------------------------------

export type ExtensionMessage =
  | { type: 'CHECK_AUTH' }
  | { type: 'FETCH_DOCUMENTS'; page?: number; size?: number; search?: string; sort?: 'name' | 'updated' }
  | { type: 'FETCH_DOCUMENT'; documentUuid: string }
  | { type: 'EXTRACT_PRODUCT'; productUrl: string; documentUuid?: string; tabId?: number }
  | { type: 'ADD_ROW_TO_DOCUMENT'; documentUuid: string; tabId: string; row: EstimateRecordApi }
  | { type: 'EXTRACT_PAGE_DATA'; tabId: number }
  | { type: 'FETCH_USAGE' }
  | { type: 'GET_ACTIVE_TAB' }
  | { type: 'LOGOUT' };

// ---------------------------------------------------------------------------
// Responses: Background Service Worker --> Side Panel
// ---------------------------------------------------------------------------

export type ExtensionResponse =
  | { type: 'AUTH_RESULT'; isAuthenticated: boolean; user?: UserDto }
  | { type: 'DOCUMENTS_RESULT'; documents: EstimateDocumentSummary[]; totalElements: number }
  | { type: 'DOCUMENT_RESULT'; document: EstimateDocumentDto }
  | { type: 'EXTRACT_RESULT'; data: ExtractedProductData }
  | { type: 'ADD_ROW_RESULT'; success: true }
  | { type: 'ADD_ROW_RESULT'; success: false; error?: string; status: number; errorCode?: string }
  | { type: 'PAGE_DATA_RESULT'; pageData: PageData }
  | { type: 'USAGE_RESULT'; usage: UsageDto }
  | { type: 'ACTIVE_TAB_RESULT'; tabId: number | null; url: string | null }
  | { type: 'LOGOUT_RESULT' }
  | { type: 'ERROR'; status: number; error: string; errorCode?: string };

// ---------------------------------------------------------------------------
// Type-safe message sender
// ---------------------------------------------------------------------------

/**
 * Send a typed message to the Background Service Worker and await a typed
 * response.
 *
 * Uses `browser.runtime.sendMessage` under the hood (WXT polyfills for
 * Chrome/Edge). Rejects with an `ERROR` response when the background handler
 * returns an error payload, or when the runtime reports an error.
 *
 * @throws {ExtensionResponse & { type: 'ERROR' }} when the background returns
 *         an error response.
 */
export async function sendMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
  // Guard against non-extension contexts (e.g., tests, SSR)
  if (typeof browser === 'undefined' || !browser.runtime) {
    throw {
      type: 'ERROR' as const,
      status: 0,
      error: 'Extension runtime not available',
    };
  }

  const response: ExtensionResponse = await browser.runtime.sendMessage(message);

  if (response?.type === 'ERROR') {
    throw response;
  }

  return response;
}

// ---------------------------------------------------------------------------
// Discriminated union helpers (for use in message handlers)
// ---------------------------------------------------------------------------

/**
 * Type guard: checks whether a response is of a specific type.
 *
 * @example
 * ```ts
 * const res = await sendMessage({ type: 'CHECK_AUTH' });
 * if (isResponseType(res, 'AUTH_RESULT')) {
 *   console.log(res.user);
 * }
 * ```
 */
export function isResponseType<T extends ExtensionResponse['type']>(
  response: ExtensionResponse,
  type: T,
): response is Extract<ExtensionResponse, { type: T }> {
  return response.type === type;
}

/**
 * Type guard for incoming messages in the Background SW message listener.
 */
export function isMessageType<T extends ExtensionMessage['type']>(
  message: ExtensionMessage,
  type: T,
): message is Extract<ExtensionMessage, { type: T }> {
  return message.type === type;
}
