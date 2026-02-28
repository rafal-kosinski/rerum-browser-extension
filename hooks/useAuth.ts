import { useState, useEffect, useCallback } from 'react';
import { sendMessage } from '../lib/messaging';
import { getCachedAuth } from '../lib/authCache';
import type { UserInfo } from '../shared-types/estimate';

/** Auth state returned by the `useAuth` hook. */
export interface UseAuthResult {
  /** Whether the user is currently authenticated with Rerum. */
  isAuthenticated: boolean;
  /** Authenticated user info, or `null` if not authenticated. */
  user: UserInfo | null;
  /**
   * `true` only during the very first auth check (mount).
   * Background refetches (polling / cookie-change events) do NOT set this
   * to `true`, preventing the UI from flashing a spinner every 2 seconds.
   */
  isLoading: boolean;
  /** Human-readable error message if the auth check itself failed. */
  error: string | null;
  /** Manually re-trigger the auth check (silent — does not set isLoading). */
  refetch: () => void;
}

/**
 * Hook that checks whether the user is authenticated with the Rerum backend.
 *
 * On mount it sends a `CHECK_AUTH` message to the Background Service Worker
 * which calls `GET /api/auth/me`. The hook exposes the auth state and a
 * helper to open the Rerum sign-in page in a new tab.
 *
 * `isLoading` is only `true` during the initial check. Subsequent refetches
 * (background polling, cookie-change triggers) update auth state silently
 * without toggling `isLoading`, eliminating the periodic spinner flash.
 */
export function useAuth(): UseAuthResult {
  // Pre-loaded from session storage before React mounted (see authCache.ts).
  // If cached state exists, skip the loading spinner entirely.
  const cached = getCachedAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(cached?.isAuthenticated ?? false);
  const [user, setUser] = useState<UserInfo | null>(cached?.user ?? null);
  const [isLoading, setIsLoading] = useState(cached == null);
  const [error, setError] = useState<string | null>(null);

  const checkAuth = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? false;
    if (showLoading) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await sendMessage({ type: 'CHECK_AUTH' });

      // Type guard: ensure we got the expected response type
      if (response.type === 'AUTH_RESULT') {
        setIsAuthenticated(response.isAuthenticated);
        setUser(response.user ?? null);
      } else if (response.type === 'ERROR') {
        // Already handled by sendMessage throw, but guard against it
        setIsAuthenticated(false);
        setUser(null);
        setError(response.error);
      } else {
        // Unexpected response type
        setIsAuthenticated(false);
        setUser(null);
        setError('Unexpected response type from background service worker');
      }
    } catch (err) {
      // An ERROR response or network failure
      setIsAuthenticated(false);
      setUser(null);

      const message =
        err && typeof err === 'object' && 'error' in err
          ? String((err as { error: string }).error)
          : 'Failed to check authentication';
      setError(message);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, []);

  // Initial auth check — shows the loading spinner once on mount.
  useEffect(() => {
    const runInitialCheck = async () => {
      setIsLoading(true);
      await checkAuth({ showLoading: false });
      setIsLoading(false);
    };
    void runInitialCheck();
  // checkAuth is stable (no deps), so this only runs once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Exposed refetch is always silent — callers (polling, cookie events, "I'm
  // signed in" button) update auth state without flashing the spinner.
  const refetch = useCallback(() => {
    void checkAuth({ showLoading: false });
  }, [checkAuth]);

  return { isAuthenticated, user, isLoading, error, refetch };
}
