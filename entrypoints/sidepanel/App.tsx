import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Box, Button, Typography, Alert, Skeleton } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { browser } from 'wxt/browser';
import { useAuth } from '../../hooks/useAuth';
import { useDocuments } from '../../hooks/useDocuments';
import { sendMessage } from '../../lib/messaging';
import { RERUM_APP_URL } from '../../lib/constants';
import { hasHostPermissionFor, requestHostPermissionFor, requestHostPermissionForAll } from '../../lib/permissions';
import type {
  PageData,
  ProductConfidence,
  ExtractedProductData,
  EstimateDocumentDto,
  EstimateRecordApi,
  UsageDto,
} from '../../shared-types/estimate';
import Header from '../../components/Header';
import AuthGate from '../../components/AuthGate';
import UsageBanner from '../../components/UsageBanner';

import ExtractionProgress from '../../components/ExtractionProgress';
import ProductPreview from '../../components/ProductPreview';
import ImageSelector from '../../components/ImageSelector';
import DocumentPicker from '../../components/DocumentPicker';
import SuccessConfirmation from '../../components/SuccessConfirmation';
import OnboardingFlow from '../../components/OnboardingFlow';
import AiColumnChips from '../../components/AiColumnChips';

// ---------------------------------------------------------------------------
// UI State machine
// ---------------------------------------------------------------------------

type AppState =
  | 'loading'
  | 'not-authenticated'
  | 'idle'
  | 'permission-needed'
  | 'extracting'
  | 'preview'
  | 'saving'
  | 'success'
  | 'error';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function App() {
  const { t } = useTranslation();

  // --- Auth -----------------------------------------------------------------
  const { isAuthenticated, user, isLoading: authLoading, refetch: refetchAuth } = useAuth();

  // --- Documents ------------------------------------------------------------
  // I7 FIX: Only fetch documents when authenticated
  const { documents, isLoading: docsLoading, refetch: refetchDocuments } = useDocuments({
    size: 100,
    enabled: isAuthenticated,
  });

  // --- Page data extracted from the active tab ------------------------------
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [, setConfidence] = useState<ProductConfidence>('low');
  const [pageDataLoading, setPageDataLoading] = useState(false);

  // --- Extraction -----------------------------------------------------------
  const [extractedData, setExtractedData] = useState<(ExtractedProductData & { quantity?: number; comment?: string }) | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // --- Document / tab selection ---------------------------------------------
  const [selectedDocumentUuid, setSelectedDocumentUuid] = useState<string | null>(null);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<EstimateDocumentDto | null>(null);

  // --- Usage ----------------------------------------------------------------
  const [usage, setUsage] = useState<UsageDto | null>(null);
  const [usageLoaded, setUsageLoaded] = useState(false);

  // --- UI state machine -----------------------------------------------------
  const [appState, setAppState] = useState<AppState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [pendingReExtract, setPendingReExtract] = useState(false);
  const [pendingExtractAfterGrant, setPendingExtractAfterGrant] = useState(false);

  // --- Success info ---------------------------------------------------------
  const [successInfo, setSuccessInfo] = useState<{
    documentName: string;
    tabName: string;
    productName: string;
    documentUuid: string;
  } | null>(null);

  // --- Onboarding -----------------------------------------------------------
  const [showOnboarding, setShowOnboarding] = useState(false);

  // --- Restoration guard ---------------------------------------------------
  // Prevents the document restoration effect from overwriting a manual
  // selection when the documents array is re-fetched (race condition fix).
  const [hasRestoredSelection, setHasRestoredSelection] = useState(false);

  // --- appState ref ---------------------------------------------------------
  // Keeps tab event handlers up-to-date without re-registering on every state
  // change (fixes memory leak from listener churn).
  const appStateRef = useRef(appState);
  appStateRef.current = appState;

  // =========================================================================
  // Effects
  // =========================================================================

  // Clear all sensitive state when the user logs out.
  // Prevents stale data from appearing if a different user logs in.
  useEffect(() => {
    if (!isAuthenticated) {
      setPageData(null);
      setActiveTabId(null);
      setConfidence('low');
      setExtractedData(null);
      setSelectedImage(null);
      setSelectedDocumentUuid(null);
      setSelectedTabId(null);
      setSelectedDocument(null);
      setUsage(null);
      setUsageLoaded(false);
      setSuccessInfo(null);
      setErrorMessage(null);
      setErrorStatus(null);
      setErrorCode(null);
      setHasRestoredSelection(false); // Allow restoration when user logs back in
    }
  }, [isAuthenticated]);

  // Check onboarding flag
  useEffect(() => {
    // I2 FIX: Use browser.storage instead of chrome.storage
    if (browser?.storage?.local) {
      browser.storage.local.get('onboardingComplete').then((result) => {
        if (!result.onboardingComplete) {
          setShowOnboarding(true);
        }
      });
    }
  }, []);

  // Derive app state from auth loading.
  // Uses a functional updater to avoid including appState in the dep array,
  // which would cause the effect to re-run on every state transition.
  useEffect(() => {
    if (authLoading) {
      setAppState('loading');
    } else if (!isAuthenticated) {
      setAppState('not-authenticated');
    } else {
      setAppState((prev) => (prev === 'loading' || prev === 'not-authenticated' ? 'idle' : prev));
    }
  }, [authLoading, isAuthenticated]);

  // Fetch page data from active tab on mount and on tab changes
  // I9: Uses message passing to background SW instead of direct browser.tabs.query
  const fetchPageData = useCallback(async () => {
    setPageDataLoading(true);
    try {
      // I9: Get active tab via background SW
      const tabResponse = await sendMessage({ type: 'GET_ACTIVE_TAB' });
      if (tabResponse.type !== 'ACTIVE_TAB_RESULT' || tabResponse.tabId == null) {
        setPageData(null);
        setActiveTabId(null);
        setConfidence('low');
        return;
      }

      setActiveTabId(tabResponse.tabId);
      const tabUrl = tabResponse.url;

      try {
        const response = await sendMessage({ type: 'EXTRACT_PAGE_DATA', tabId: tabResponse.tabId });
        if (response.type === 'PAGE_DATA_RESULT') {
          setPageData(response.pageData);
          setConfidence(response.pageData.confidence);
          return;
        }
      } catch {
        // Content script injection may fail on pages where the extension
        // lacks host permissions (e.g. arbitrary product pages).
        // Fall through to use the tab URL as a minimal fallback.
      }

      // Fallback: use just the tab URL so the Extract button stays enabled.
      // The backend scrapes the page itself — the content script metadata
      // (title, images, structured data) is nice-to-have, not required.
      if (tabUrl && /^https?:\/\//.test(tabUrl)) {
        setPageData({ url: tabUrl, title: tabUrl, images: [], hints: {}, confidence: 'low' });
        setConfidence('low');
        // Keep activeTabId — background can still attempt content injection
      } else {
        setPageData(null);
        setActiveTabId(null);
        setConfidence('low');
      }
    } finally {
      setPageDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void fetchPageData();
    }
  }, [isAuthenticated, fetchPageData]);

  // Fetch subscription usage
  useEffect(() => {
    if (!isAuthenticated) return;

    sendMessage({ type: 'FETCH_USAGE' })
      .then((res) => {
        if (res.type === 'USAGE_RESULT') {
          setUsage(res.usage);
        }
      })
      .catch(() => {
        // Non-critical — silently ignore
      })
      .finally(() => {
        setUsageLoaded(true);
      });
  }, [isAuthenticated]);

  // Listen for tab activation changes to re-extract page data.
  // Uses appStateRef so handlers stay current without re-registering on every
  // state change (prevents listener churn / memory leak).
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleTabActivated = () => {
      const state = appStateRef.current;
      if (state === 'idle' || state === 'permission-needed') {
        if (state === 'permission-needed') setAppState('idle');
        void fetchPageData();
      }
    };

    const handleTabUpdated = (_tabId: number, changeInfo: { status?: string }) => {
      const state = appStateRef.current;
      if (changeInfo.status === 'complete' && (state === 'idle' || state === 'permission-needed')) {
        if (state === 'permission-needed') setAppState('idle');
        void fetchPageData();
      }
    };

    browser.tabs.onActivated.addListener(handleTabActivated);
    browser.tabs.onUpdated.addListener(handleTabUpdated);

    return () => {
      browser.tabs.onActivated.removeListener(handleTabActivated);
      browser.tabs.onUpdated.removeListener(handleTabUpdated);
    };
  }, [isAuthenticated, fetchPageData]); // appState removed — accessed via ref instead

  // Poll auth state every 2 s while not authenticated so the panel reacts
  // automatically when the user logs in on the Rerum web app in another tab.
  // This is the most reliable detection mechanism because cookie-change events
  // are not guaranteed to fire (varies by browser / cookie domain).
  useEffect(() => {
    if (isAuthenticated || authLoading) return;
    const interval = setInterval(() => { void refetchAuth(); }, 2000);
    return () => clearInterval(interval);
  }, [isAuthenticated, authLoading, refetchAuth]);

  // React to login / logout detected by the background SW via cookie changes.
  // Without this listener the side panel would stay on the "not authenticated"
  // screen indefinitely after the user logs in, because AUTH_STATE_CHANGED is
  // sent via browser.runtime.sendMessage and silently dropped if no one listens.
  useEffect(() => {
    const handleMessage = (message: unknown) => {
      if (
        message !== null &&
        typeof message === 'object' &&
        'type' in message &&
        (message as { type: string }).type === 'AUTH_STATE_CHANGED'
      ) {
        void refetchAuth();
      }
    };
    browser.runtime.onMessage.addListener(handleMessage);
    return () => browser.runtime.onMessage.removeListener(handleMessage);
  }, [refetchAuth]);

  // I6 FIX: Re-fetch documents when Side Panel becomes visible
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Side Panel became visible - refresh documents
        refetchDocuments();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, refetchDocuments]);

  // =========================================================================
  // Handlers
  // =========================================================================

  // The actual extraction logic, called after permission is confirmed.
  const doExtract = useCallback(async () => {
    if (!pageData?.url) return;

    setAppState('extracting');
    setErrorMessage(null);
    setErrorStatus(null);
    setErrorCode(null);

    try {
      const response = await sendMessage({
        type: 'EXTRACT_PRODUCT',
        productUrl: pageData.url,
        documentUuid: selectedDocumentUuid ?? undefined,
        tabId: activeTabId ?? undefined,
      });

      if (response.type === 'EXTRACT_RESULT') {
        setExtractedData(response.data);
        if (pageData.images.length > 0) {
          setSelectedImage(response.data.productImageUrl ?? pageData.images[0] ?? null);
        }
        setAppState('preview');
      }
    } catch (err) {
      const errorResponse = err as { status?: number; error?: string; errorCode?: string };
      const status = errorResponse.status ?? 0;
      let message = errorResponse.error ?? t('extraction.failed');

      if (status === 400) {
        message = t('extraction.noData');
      } else if (status === 401) {
        message = t('auth.sessionExpired');
        refetchAuth();
      } else if (status === 403 && errorResponse.errorCode === 'USAGE_LIMIT_EXCEEDED') {
        message = t('extraction.limitReached');
      } else if (status === 503) {
        message = t('extraction.blocked');
      }

      setErrorMessage(message);
      setErrorStatus(status);
      setErrorCode(errorResponse.errorCode ?? null);
      setAppState('error');
    }
  }, [pageData, activeTabId, selectedDocumentUuid, refetchAuth, t]);

  // Check permission and either show the choice UI or proceed to extraction.
  const handleExtract = useCallback(async () => {
    if (!pageData?.url) return;

    const hasPermission = await hasHostPermissionFor(pageData.url);
    if (!hasPermission) {
      setAppState('permission-needed');
      return;
    }

    void doExtract();
  }, [pageData, doExtract]);

  // Permission choice handlers — each is called from a button click
  // (user gesture), so browser.permissions.request() works.
  // After granting, we re-fetch page data (images were missing without
  // permission) and set a flag so extraction runs once fresh data arrives.
  const handleGrantThisSite = useCallback(async () => {
    if (!pageData?.url) return;
    const granted = await requestHostPermissionFor(pageData.url);
    if (granted) {
      setAppState('extracting');
      setPageDataLoading(true);
      setPendingExtractAfterGrant(true);
      void fetchPageData();
    } else {
      setErrorMessage(t('extraction.permissionDenied'));
      setErrorCode('PERMISSION_DENIED');
      setAppState('error');
    }
  }, [pageData, fetchPageData, t]);

  const handleGrantAllSites = useCallback(async () => {
    const granted = await requestHostPermissionForAll();
    if (granted) {
      setAppState('extracting');
      setPageDataLoading(true);
      setPendingExtractAfterGrant(true);
      void fetchPageData();
    } else {
      setErrorMessage(t('extraction.permissionDenied'));
      setErrorCode('PERMISSION_DENIED');
      setAppState('error');
    }
  }, [fetchPageData, t]);

  const handleAddToEstimate = useCallback(async () => {
    if (!extractedData || !selectedDocumentUuid || !selectedTabId) return;

    setAppState('saving');
    setErrorMessage(null);
    setErrorStatus(null);
    setErrorCode(null);

    try {
      // Build the row in snake_case format for the JSONB interior
      const row: EstimateRecordApi = {
        product_name: extractedData.productName ?? null,
        manufacturer: extractedData.manufacturer ?? null,
        price_per_unit: extractedData.pricePerUnit ?? null,
        product_image_url: selectedImage ?? extractedData.productImageUrl ?? null,
        product_url: pageData?.url ?? extractedData.productUrl ?? null,
        quantity: extractedData.quantity ?? 1,
        comment: extractedData.comment ?? null,
        custom_fields: extractedData.customFields ?? null,
      };

      const response = await sendMessage({
        type: 'ADD_ROW_TO_DOCUMENT',
        documentUuid: selectedDocumentUuid,
        tabId: selectedTabId,
        row,
      });

      if (response.type === 'ADD_ROW_RESULT' && response.success) {
        const docName = documents.find((d) => d.uuid === selectedDocumentUuid)?.documentName ?? 'Document';
        const tabName = (selectedDocument?.documentContent.tabs ?? []).find((tab) => tab.tab_id === selectedTabId)?.tab_name ?? 'Tab';

        setSuccessInfo({
          documentName: docName,
          tabName,
          productName: extractedData.productName ?? 'Product',
          documentUuid: selectedDocumentUuid,
        });
        setAppState('success');

        // Refresh usage
        sendMessage({ type: 'FETCH_USAGE' })
          .then((res) => {
            if (res.type === 'USAGE_RESULT') setUsage(res.usage);
          })
          .catch(() => {});

        // Silently refresh the selected document so tab data stays current
        if (selectedDocumentUuid) {
          sendMessage({ type: 'FETCH_DOCUMENT', documentUuid: selectedDocumentUuid })
            .then((res) => {
              if (res.type === 'DOCUMENT_RESULT') setSelectedDocument(res.document);
            })
            .catch(() => {});
        }
      } else if (response.type === 'ADD_ROW_RESULT') {
        // Server returned a structured error (4xx). The background handler caught
        // ApiError and returned ADD_ROW_RESULT { success: false } rather than
        // throwing, so sendMessage did not reject — handle here.
        const status = response.status;
        let message = response.error ?? t('error.addFailed');

        if (status === 0) {
          message = t('error.network');
        } else if (status === 401) {
          message = t('auth.sessionExpired');
          refetchAuth();
        } else if (status === 400) {
          message = t('error.tabGone');
        } else if (status === 404) {
          message = t('error.docNotFound');
        }
        // For 403 (locked or row limit), use the server's localized message directly.

        setErrorMessage(message);
        setErrorStatus(status);
        setErrorCode(response.errorCode ?? null);
        setAppState('error');
      }
    } catch (err) {
      // Handles ERROR responses thrown by sendMessage (non-ApiError exceptions
      // re-thrown by the background SW) and network failures.
      // handleAddRowToDocument catches all ApiErrors before they reach here, so
      // this path only fires on unexpected failures (e.g. SW crash, fetch abort).
      const errorResponse = err as { status?: number; error?: string };
      const status = errorResponse.status ?? null;
      let message = errorResponse.error ?? t('error.addFailed');

      if (status === 0) {
        message = t('error.network');
      } else if (status === 401) {
        message = t('auth.sessionExpired');
        refetchAuth();
      }

      setErrorMessage(message);
      setErrorStatus(status);
      setAppState('error');
    }
  }, [extractedData, selectedDocumentUuid, selectedTabId, selectedImage, pageData, documents, selectedDocument, refetchAuth, t]);

  const handleDataChange = useCallback((data: ExtractedProductData & { quantity?: number; comment?: string }) => {
    setExtractedData(data);
  }, []);

  const handleAddAnother = useCallback(() => {
    setExtractedData(null);
    setSelectedImage(null);
    setSuccessInfo(null);
    setErrorMessage(null);
    setErrorStatus(null);
    setErrorCode(null);
    setAppState('idle');
    void fetchPageData();
  }, [fetchPageData]);

  // Used by the error screen's "Try Again" button.
  // Unlike handleAddAnother, this preserves extracted data so the user can
  // fix their document/tab selection without re-running the AI extraction.
  // Falls back to idle when there's no extracted data (e.g. extraction failed).
  const handleTryAgain = useCallback(() => {
    setErrorMessage(null);
    setErrorStatus(null);
    setErrorCode(null);
    if (extractedData) {
      setAppState('preview');
    } else {
      setAppState('idle');
      void fetchPageData();
    }
  }, [extractedData, fetchPageData]);

  const handleDocumentChange = useCallback(
    (uuid: string | null) => {
      setSelectedDocumentUuid(uuid);
      setSelectedTabId(null);
      setSelectedDocument(null);

      // Persist selection so it survives popup/side panel close (e.g. when the
      // browser permission prompt steals focus and the popup unmounts).
      if (browser?.storage?.local) {
        if (uuid) {
          browser.storage.local.set({ lastDocumentUuid: uuid });
          browser.storage.local.remove('lastTabId');
        } else {
          browser.storage.local.remove(['lastDocumentUuid', 'lastTabId']);
        }
      }

      // If we're in preview state and the document changed, we need to
      // re-extract because the new document may have different AI columns.
      const wasInPreview = appStateRef.current === 'preview' && !!uuid;
      if (wasInPreview) {
        setAppState('extracting');
        setPendingReExtract(true);
      }

      if (uuid) {
        sendMessage({ type: 'FETCH_DOCUMENT', documentUuid: uuid })
          .then((res) => {
            if (res.type === 'DOCUMENT_RESULT') {
              setSelectedDocument(res.document);
              // Auto-select first tab if available
              const tabs = res.document.documentContent.tabs ?? [];
              if (tabs.length > 0) {
                setSelectedTabId(tabs[0]!.tab_id);
              }
            }
          })
          .catch(() => {
            // If fetch fails during a re-extract, abort the pending
            // extraction and return to idle to avoid getting stuck.
            if (wasInPreview) {
              setPendingReExtract(false);
              setAppState('idle');
            }
          });
      }
    },
    [],
  );

  const handleTabChange = useCallback((tabId: string | null) => {
    setSelectedTabId(tabId);

    // Persist tab selection alongside document selection.
    if (browser?.storage?.local) {
      if (tabId) {
        browser.storage.local.set({ lastTabId: tabId });
      } else {
        browser.storage.local.remove('lastTabId');
      }
    }
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
    // I2 FIX: Use browser.storage instead of chrome.storage
    if (browser?.storage?.local) {
      browser.storage.local.set({ onboardingComplete: true });
    }
  }, []);

  // Restore last-used document/tab — runs only once after the document list
  // is first populated. The hasRestoredSelection guard prevents this effect
  // from overwriting a manual selection when documents are re-fetched later.
  useEffect(() => {
    if (!isAuthenticated || documents.length === 0 || hasRestoredSelection) return;

    setHasRestoredSelection(true);

    if (browser?.storage?.local) {
      browser.storage.local.get(['lastDocumentUuid', 'lastTabId']).then((result) => {
        const lastUuid = result.lastDocumentUuid as string | undefined;
        const lastTab = result.lastTabId as string | undefined;

        if (lastUuid && documents.some((d) => d.uuid === lastUuid)) {
          setSelectedDocumentUuid(lastUuid);
          // Fetch tabs for the last-used document
          sendMessage({ type: 'FETCH_DOCUMENT', documentUuid: lastUuid })
            .then((res) => {
              if (res.type === 'DOCUMENT_RESULT') {
                setSelectedDocument(res.document);
                const tabs = res.document.documentContent.tabs ?? [];
                if (lastTab && tabs.some((t) => t.tab_id === lastTab)) {
                  setSelectedTabId(lastTab);
                } else if (tabs.length > 0) {
                  setSelectedTabId(tabs[0]!.tab_id);
                }
              }
            })
            .catch(() => {});
        }
      });
    }
  }, [isAuthenticated, documents, hasRestoredSelection]);

  // Re-extract when the user switches documents from preview state.
  // Uses pendingReExtract flag because handleDocumentChange can't call
  // doExtract directly (selectedDocumentUuid update is async).
  // Calls doExtract instead of handleExtract because permission was already
  // granted during the initial extraction for this page.
  useEffect(() => {
    if (pendingReExtract && selectedDocumentUuid && selectedDocument && pageData?.url) {
      setPendingReExtract(false);
      void doExtract();
    }
  }, [pendingReExtract, selectedDocumentUuid, selectedDocument, pageData, doExtract]);

  // Run extraction after permission grant + page data refresh completes.
  // The grant handlers set pendingExtractAfterGrant=true and call fetchPageData().
  // Once fetchPageData finishes (pageDataLoading goes false), we run doExtract
  // with fresh pageData (including images).
  useEffect(() => {
    if (pendingExtractAfterGrant && !pageDataLoading && pageData?.url) {
      setPendingExtractAfterGrant(false);
      void doExtract();
    }
  }, [pendingExtractAfterGrant, pageDataLoading, pageData, doExtract]);

  // =========================================================================
  // Custom field labels from document column definitions
  // =========================================================================

  const columnDefinitions = useMemo(() => {
    return selectedDocument?.documentContent.column_definitions ?? null;
  }, [selectedDocument]);

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <Box sx={{ width: '100%', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header email={user?.email ?? null} />

      <AuthGate
        isAuthenticated={isAuthenticated}
        isLoading={authLoading}
        user={user}
        sessionExpired={appState === 'error' && errorStatus === 401} // C4 FIX: Use 401 status code instead of string matching
        onRefresh={refetchAuth}
      >
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Onboarding */}
          {showOnboarding && (
            <OnboardingFlow onComplete={handleOnboardingComplete} />
          )}

          {/* Usage banner — reserve height while loading to prevent layout shift */}
          {usage ? (
            <UsageBanner used={usage.aiAutofillUsed} limit={usage.aiAutofillLimit} />
          ) : !usageLoaded && isAuthenticated && appState !== 'loading' ? (
            <Skeleton variant="rounded" height={42} />
          ) : null}

          {/* No documents state */}
          {!docsLoading && documents.length === 0 && appState === 'idle' && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                {t('document.noDocuments')}
              </Typography>
              <Button
                variant="contained"
                onClick={() => browser.tabs.create({ url: `${RERUM_APP_URL}/documents/new` })}
              >
                {t('document.createInRerum')}
              </Button>
            </Box>
          )}

          {/* Idle state: skeleton while documents are loading */}
          {appState === 'idle' && docsLoading && documents.length === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Skeleton variant="rounded" height={66} />
              <Skeleton variant="rounded" height={40} />
              <Skeleton variant="rounded" height={40} />
              <Skeleton variant="rounded" height={42} />
            </Box>
          )}

          {/* Idle state: page info + document picker + extract button */}
          {appState === 'idle' && documents.length > 0 && (
            <>
              {pageData ? (
                <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, p: 1.5 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                    {t('page.currentPage')}
                  </Typography>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                    {pageData.title || t('page.untitled')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {pageData.url}
                  </Typography>
                </Box>
              ) : pageDataLoading ? (
                <Skeleton variant="rounded" height={66} />
              ) : null}

              <DocumentPicker
                documents={documents}
                selectedDocumentUuid={selectedDocumentUuid}
                selectedTabId={selectedTabId}
                selectedDocument={selectedDocument}
                onDocumentChange={handleDocumentChange}
                onTabChange={handleTabChange}
                disabled={false}
              />

              <AiColumnChips columnDefinitions={columnDefinitions} />

              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={handleExtract}
                disabled={!pageData?.url || pageDataLoading || !selectedDocumentUuid}
                title={!selectedDocumentUuid ? t('action.selectDocumentFirst') : undefined}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                }}
              >
                {t('action.extract')}
              </Button>
            </>
          )}

          {/* Permission needed state */}
          {appState === 'permission-needed' && pageData && (() => {
            let site: string;
            try { site = new URL(pageData.url).hostname; } catch { site = pageData.url; }
            return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Alert severity="info">
                {t('permission.description', { site })}
              </Alert>
              <Button
                variant="contained"
                fullWidth
                onClick={handleGrantThisSite}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                }}
              >
                {t('permission.thisSite', { site })}
              </Button>
              <Button
                variant="outlined"
                fullWidth
                onClick={handleGrantAllSites}
              >
                {t('permission.allSites')}
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={() => setAppState('idle')}
              >
                {t('action.cancel')}
              </Button>
            </Box>
            );
          })()}

          {/* Extracting state */}
          {appState === 'extracting' && <ExtractionProgress />}

          {/* Preview state */}
          {appState === 'preview' && extractedData && (
            <>
              <ProductPreview
                data={extractedData}
                onChange={handleDataChange}
                columnDefinitions={columnDefinitions}
              />

              {pageData && pageData.images.length > 0 && (
                <ImageSelector
                  images={pageData.images}
                  selectedImage={selectedImage}
                  onSelect={setSelectedImage}
                />
              )}

              <DocumentPicker
                documents={documents}
                selectedDocumentUuid={selectedDocumentUuid}
                selectedTabId={selectedTabId}
                selectedDocument={selectedDocument}
                onDocumentChange={handleDocumentChange}
                onTabChange={handleTabChange}
                disabled={false}
              />

              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={handleAddToEstimate}
                disabled={
                  !selectedDocumentUuid ||
                  !selectedTabId ||
                  documents.find((d) => d.uuid === selectedDocumentUuid)?.isLocked === true
                }
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                }}
              >
                {t('action.addToEstimate')}
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={handleAddAnother}
              >
                {t('action.cancel')}
              </Button>
            </>
          )}

          {/* Saving state */}
          {appState === 'saving' && extractedData && (
            <>
              <ProductPreview
                data={extractedData}
                onChange={handleDataChange}
                columnDefinitions={columnDefinitions}
                disabled
              />
              <Button
                variant="contained"
                fullWidth
                size="large"
                disabled
              >
                {t('action.adding')}
              </Button>
            </>
          )}

          {/* Success state */}
          {appState === 'success' && successInfo && (
            <SuccessConfirmation
              documentName={successInfo.documentName}
              tabName={successInfo.tabName}
              productName={successInfo.productName}
              documentUuid={successInfo.documentUuid}
              onAddAnother={handleAddAnother}
            />
          )}

          {/* Error state */}
          {appState === 'error' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Alert severity="error">
                {errorMessage ?? t('error.unexpected')}
              </Alert>
              {errorCode === 'USAGE_LIMIT_EXCEEDED' ? (
                <>
                  <Button
                    variant="contained"
                    onClick={() => browser.tabs.create({ url: `${RERUM_APP_URL}/subscription` })}
                    sx={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    }}
                  >
                    {t('action.upgradePlan')}
                  </Button>
                  <Button variant="outlined" onClick={handleTryAgain}>
                    {t('action.tryAgain')}
                  </Button>
                </>
              ) : (
                <Button variant="outlined" onClick={handleTryAgain}>
                  {t('action.tryAgain')}
                </Button>
              )}
            </Box>
          )}
        </Box>
      </AuthGate>
    </Box>
  );
}

export default App;
