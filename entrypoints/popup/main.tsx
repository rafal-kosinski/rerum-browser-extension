import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from '../../lib/theme';
import '../../lib/i18n';
import ErrorBoundary from '../../components/ErrorBoundary';
import App from './App';

/**
 * Popup entry point (Safari fallback).
 *
 * Shares the same theme and App component as the Side Panel.  The popup
 * viewport is typically narrower (~400px) which matches the Side Panel
 * layout assumptions.
 */

const root = document.getElementById('root');

if (root) {
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
}
