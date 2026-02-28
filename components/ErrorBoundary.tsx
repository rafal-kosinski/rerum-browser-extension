import { Component } from 'react';
import type { ReactNode } from 'react';
import { Box, Typography, Button } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import i18n from '../lib/i18n';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level error boundary for the Side Panel app.
 *
 * Catches unhandled errors in the React tree and renders a friendly fallback
 * instead of a blank panel, with a "Reload extension" button so the user can
 * recover without having to close and re-open the Side Panel manually.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    console.error('[rerum-ext] Unhandled React error:', error, info.componentStack);
  }

  handleReload = (): void => {
    // Reload the side panel page to reset all state
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh',
            p: 3,
            gap: 2,
            textAlign: 'center',
          }}
        >
          <ErrorOutlineIcon sx={{ fontSize: 48, color: 'error.main' }} />
          <Typography variant="h6" color="text.primary">
            {i18n.t('error.boundary')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {i18n.t('error.boundaryDetail')}
          </Typography>
          {this.state.error && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                fontFamily: 'monospace',
                bgcolor: 'background.paper',
                p: 1,
                borderRadius: 1,
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {this.state.error.message}
            </Typography>
          )}
          <Button variant="contained" onClick={this.handleReload} size="small">
            {i18n.t('error.reload')}
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
