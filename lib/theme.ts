import { createTheme } from '@mui/material';

/**
 * Rerum extension MUI theme.
 *
 * Mirrors the gradient colours (#667eea / #764ba2) and general feel of the
 * main Rerum frontend while being a lightweight, self-contained definition
 * for the extension bundle.
 */
export const theme = createTheme({
  palette: {
    primary: {
      main: '#667eea',
      light: '#8a9af0',
      dark: '#4a5fc7',
    },
    secondary: {
      main: '#764ba2',
      light: '#9b6fbf',
      dark: '#5a3580',
    },
    error: {
      main: '#d32f2f',
    },
    warning: {
      main: '#ed6c02',
    },
    info: {
      main: '#0288d1',
    },
    success: {
      main: '#2e7d32',
    },
    background: {
      default: '#fafafa',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  spacing: 8,
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
});
