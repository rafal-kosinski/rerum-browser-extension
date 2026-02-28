import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Divider,
  Radio,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  ManageAccounts as AccountIcon,
  Logout as LogoutIcon,
  Language as LanguageIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { RERUM_APP_URL } from '../lib/constants';
import { sendMessage } from '../lib/messaging';

interface HeaderProps {
  /** Currently logged-in user's email, or `null` if unauthenticated. */
  email: string | null;
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'pl', label: 'Polski' },
] as const;

/**
 * Top header bar for the Rerum extension Side Panel.
 *
 * Displays the Rerum logo on a gradient background, the user's email
 * (truncated), and a settings menu with account, language, and logout options.
 */
function Header({ email }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const truncatedEmail = email && email.length > 20 ? `${email.slice(0, 20)}...` : email;

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const [language, setLanguage] = useState<string>('en');

  // Load stored language preference on mount
  useEffect(() => {
    browser.storage.local.get('language').then((result) => {
      if (result.language) {
        setLanguage(result.language as string);
      }
    }).catch(() => {});
  }, []);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleAccountSettings = () => {
    handleMenuClose();
    browser.tabs.create({ url: `${RERUM_APP_URL}/account` });
  };

  const handleLanguageChange = (code: string) => {
    setLanguage(code);
    i18n.changeLanguage(code);
    browser.storage.local.set({ language: code }).catch(() => {});
  };

  const handleLogout = () => {
    handleMenuClose();
    sendMessage({ type: 'LOGOUT' }).catch(() => {});
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        px: 2,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        flexShrink: 0,
      }}
    >
      {/* Branding */}
      <Box
        component="img"
        src="/rerum-logo.svg"
        alt="Rerum"
        sx={{ height: 28, filter: 'brightness(0) invert(1)' }}
      />

      {/* Right side: email + settings */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {truncatedEmail && (
          <Tooltip title={email ?? ''}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', maxWidth: 160 }} noWrap>
              {truncatedEmail}
            </Typography>
          </Tooltip>
        )}
        <IconButton
          size="small"
          sx={{ color: 'rgba(255,255,255,0.85)' }}
          onClick={handleMenuOpen}
          aria-label="Settings"
        >
          <SettingsIcon fontSize="small" />
        </IconButton>

        <Menu
          anchorEl={anchorEl}
          open={menuOpen}
          onClose={handleMenuClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem onClick={handleAccountSettings}>
            <ListItemIcon>
              <AccountIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('header.accountSettings')}</ListItemText>
          </MenuItem>

          <Divider />

          <ListSubheader sx={{ display: 'flex', alignItems: 'center', gap: 1, lineHeight: '36px' }}>
            <LanguageIcon fontSize="small" />
            {t('header.language')}
          </ListSubheader>
          {LANGUAGES.map((lang) => (
            <MenuItem
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              sx={{ pl: 4 }}
            >
              <Radio
                size="small"
                checked={language === lang.code}
                sx={{ p: 0, mr: 1 }}
                tabIndex={-1}
              />
              <ListItemText>{lang.label}</ListItemText>
            </MenuItem>
          ))}

          <Divider />

          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('header.logout')}</ListItemText>
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}

export default Header;
