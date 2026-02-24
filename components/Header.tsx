import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';

interface HeaderProps {
  /** Currently logged-in user's email, or `null` if unauthenticated. */
  email: string | null;
}

/**
 * Top header bar for the Rerum extension Side Panel.
 *
 * Displays the Rerum branding on a gradient background, the user's email
 * (truncated), and a settings icon button (placeholder for future use).
 */
function Header({ email }: HeaderProps) {
  const truncatedEmail = email && email.length > 20 ? `${email.slice(0, 20)}...` : email;

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
      <Typography
        variant="h6"
        component="span"
        sx={{ fontWeight: 700, letterSpacing: 0.5 }}
      >
        Rerum
      </Typography>

      {/* Right side: email + settings */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {truncatedEmail && (
          <Tooltip title={email ?? ''}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', maxWidth: 160 }} noWrap>
              {truncatedEmail}
            </Typography>
          </Tooltip>
        )}
        <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.85)' }}>
          <SettingsIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}

export default Header;
