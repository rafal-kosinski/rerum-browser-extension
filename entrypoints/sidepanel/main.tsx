import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from '../../lib/theme';
import '../../lib/i18n';
import { preloadCachedAuth } from '../../lib/authCache';
import ErrorBoundary from '../../components/ErrorBoundary';
import App from './App';

const root = document.getElementById('root');

if (root) {
  // Pre-load cached auth state from session storage before mounting React.
  // This lets useAuth skip the loading spinner when the user is already
  // authenticated, eliminating the brief flicker on popup open.
  preloadCachedAuth().then(() => {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </ThemeProvider>
      </React.StrictMode>,
    );
  });
}
