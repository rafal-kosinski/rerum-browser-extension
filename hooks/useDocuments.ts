import { useState, useEffect, useCallback, useRef } from 'react';
import { sendMessage } from '../lib/messaging';
import type { EstimateDocumentSummary } from '../shared-types/estimate';

/** Parameters for the document list query. */
export interface UseDocumentsParams {
  /** Zero-based page index. */
  page?: number;
  /** Number of documents per page. */
  size?: number;
  /** Free-text search filter. */
  search?: string;
  /** Only fetch when enabled (for authentication guards). */
  enabled?: boolean;
}

/** State returned by the `useDocuments` hook. */
export interface UseDocumentsResult {
  /** Document summaries for the current page. */
  documents: EstimateDocumentSummary[];
  /** Total number of documents across all pages. */
  totalElements: number;
  /** `true` while a fetch is in progress. */
  isLoading: boolean;
  /** Human-readable error message, or `null`. */
  error: string | null;
  /** Manually re-trigger the fetch with current params. */
  refetch: () => void;
}

/**
 * Hook that fetches the paginated list of estimate documents.
 *
 * Sends a `FETCH_DOCUMENTS` message to the Background Service Worker which
 * calls `GET /api/estimates`. Re-fetches automatically when `page`, `size`,
 * or `search` change.
 *
 * I7 FIX: Only fetches when `enabled` is true (defaults to true for backward compatibility).
 */
export function useDocuments(params: UseDocumentsParams = {}): UseDocumentsResult {
  const { page, size, search, enabled = true } = params;

  const [documents, setDocuments] = useState<EstimateDocumentSummary[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  // Keep a ref to the latest params so the refetch callback is stable
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const fetchDocuments = useCallback(async () => {
    // I7: Guard against fetching when disabled
    if (paramsRef.current.enabled === false) return;

    setIsLoading(true);
    setError(null);

    try {
      const { page: p, size: s, search: q } = paramsRef.current;
      const response = await sendMessage({
        type: 'FETCH_DOCUMENTS',
        page: p,
        size: s,
        search: q,
      });

      // Type guard: ensure we got the expected response type
      if (response.type === 'DOCUMENTS_RESULT') {
        setDocuments(response.documents);
        setTotalElements(response.totalElements);
      } else if (response.type === 'ERROR') {
        // Already handled by sendMessage throw, but guard against it
        setError(response.error);
        setDocuments([]);
        setTotalElements(0);
      } else {
        // Unexpected response type
        setError('Unexpected response type from background service worker');
        setDocuments([]);
        setTotalElements(0);
      }
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'error' in err
          ? String((err as { error: string }).error)
          : 'Failed to fetch documents';
      setError(message);
      setDocuments([]);
      setTotalElements(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Re-fetch when query parameters change (including enabled flag).
  // Pre-set isLoading=true before calling fetchDocuments to avoid a flash
  // of the empty state between the render where enabled flips true and the
  // render where fetchDocuments sets isLoading=true internally.
  useEffect(() => {
    if (enabled) {
      setIsLoading(true);
      void fetchDocuments();
    } else {
      // I7: Reset loading state when disabled
      setIsLoading(false);
    }
  }, [fetchDocuments, page, size, search, enabled]);

  return { documents, totalElements, isLoading, error, refetch: fetchDocuments };
}
