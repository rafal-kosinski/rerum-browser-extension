import { ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { RERUM_APP_URL } from '../lib/constants';
import type { UserDto } from '../shared-types/estimate';

interface AuthGateProps {
  children: ReactNode;
  /** Whether the user is currently authenticated. */
  isAuthenticated: boolean;
  /** Whether the auth check is still in progress. */
  isLoading: boolean;
  /** Authenticated user, or `null`. */
  user: UserDto | null;
  /** Show the "session expired" variant instead of the standard login prompt. */
  sessionExpired?: boolean;
  /** Called when the sign-in popup closes so the caller can re-check auth. */
  onRefresh?: () => void;
}

/**
 * Auth wrapper component.
 *
 * - While loading: shows a centered spinner.
 * - If not authenticated: shows a sign-in button that opens a popup window
 *   via `browser.windows.create()`. When auth succeeds (detected by the
 *   polling in App.tsx), the popup is closed from the extension side via
 *   `browser.windows.remove()` — no cooperation from the web app needed.
 * - If authenticated: renders children.
 */
function AuthGate({ children, isAuthenticated, isLoading, sessionExpired, onRefresh }: AuthGateProps) {
  const { t } = useTranslation();
  const popupWindowId = useRef<number | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);

  // Close the popup from the extension side when auth succeeds.
  useEffect(() => {
    if (isAuthenticated && popupWindowId.current != null) {
      browser.windows.remove(popupWindowId.current).catch(() => {});
      popupWindowId.current = null;
      setPopupOpen(false);
    }
  }, [isAuthenticated]);

  // Watch the popup's tab for navigation to the OAuth success URL.
  // When the popup navigates away from /sign-in (e.g. to /estimates after
  // OAuth completes), close it immediately and trigger an auth re-check.
  // This is more reliable than waiting for the CHECK_AUTH poll because it
  // works even if the backend hasn't been rebuilt yet.
  useEffect(() => {
    if (!popupOpen || popupWindowId.current == null) return;
    const windowId = popupWindowId.current;

    const handleTabUpdated = (
      _tabId: number,
      changeInfo: { url?: string },
      tab: { windowId?: number },
    ) => {
      if (tab.windowId !== windowId || !changeInfo.url) return;

      // The OAuth success redirect sends the user to /estimates.
      // Only close the popup for this specific path — not for error
      // redirects like /signin?error=true.
      const url = changeInfo.url;
      const path = url.startsWith(RERUM_APP_URL)
        ? url.slice(RERUM_APP_URL.length)
        : null;
      if (path != null && path.startsWith('/estimates')) {
        browser.windows.remove(windowId).catch(() => {});
        popupWindowId.current = null;
        setPopupOpen(false);
        onRefresh?.();
      }
    };

    browser.tabs.onUpdated.addListener(handleTabUpdated);
    return () => browser.tabs.onUpdated.removeListener(handleTabUpdated);
  }, [popupOpen, onRefresh]);

  // Detect when the user closes the popup manually and re-check auth.
  useEffect(() => {
    if (!popupOpen || popupWindowId.current == null) return;

    const handleRemoved = (windowId: number) => {
      if (windowId === popupWindowId.current) {
        popupWindowId.current = null;
        setPopupOpen(false);
        onRefresh?.();
      }
    };

    browser.windows.onRemoved.addListener(handleRemoved);
    return () => browser.windows.onRemoved.removeListener(handleRemoved);
  }, [popupOpen, onRefresh]);

  const handleSignIn = useCallback(async () => {
    // If a popup is already open, just focus it
    if (popupWindowId.current != null) {
      browser.windows.update(popupWindowId.current, { focused: true }).catch(() => {});
      return;
    }

    const popup = await browser.windows.create({
      url: `${RERUM_APP_URL}/sign-in`,
      type: 'popup',
      width: 480,
      height: 660,
    });

    if (popup?.id != null) {
      popupWindowId.current = popup.id;
      setPopupOpen(true);
    }
  }, []);

  // --- Loading state --------------------------------------------------------
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 56px)', width: '100%', gap: 2 }}>
        <CircularProgress size={40} />
        <Typography variant="body2" color="text.secondary">
          {t('auth.checking')}
        </Typography>
      </Box>
    );
  }

  // --- Not authenticated state ----------------------------------------------
  if (!isAuthenticated) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 56px)', width: '100%', gap: 2, px: 3, pb: 3, textAlign: 'center' }}>
        <Box
          component="img"
          src="/rerum-logo.svg"
          alt="Rerum"
          sx={{ height: 40 }}
        />

        <Typography variant="body1" color="text.secondary">
          {sessionExpired
            ? t('auth.sessionExpired')
            : t('auth.signInPrompt')}
        </Typography>

        <Button
          variant="contained"
          size="large"
          onClick={() => void handleSignIn()}
          disabled={popupOpen}
          sx={{ mt: 1, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
        >
          {popupOpen ? t('auth.signInOpen') : t('auth.signInButton')}
        </Button>
      </Box>
    );
  }

  // --- Authenticated --------------------------------------------------------
  return <>{children}</>;
}

export default AuthGate;
