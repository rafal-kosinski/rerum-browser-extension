import { Box, Typography, LinearProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface UsageBannerProps {
  /** Number of AI extractions used in the current billing period. */
  used: number;
  /** Maximum AI extractions allowed in the current billing period. */
  limit: number;
}

/**
 * Compact subscription usage display.
 *
 * Shows a single-line label with the remaining extraction count and a
 * LinearProgress bar below it. The bar colour shifts to warning (>80%)
 * or error (at limit) as usage increases.
 */
function UsageBanner({ used, limit }: UsageBannerProps) {
  const { t } = useTranslation();
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const remaining = Math.max(limit - used, 0);
  const isWarning = percentage > 80;
  const isError = remaining === 0;

  const progressColor: 'primary' | 'warning' | 'error' = isError
    ? 'error'
    : isWarning
      ? 'warning'
      : 'primary';

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 1,
        px: 1.5,
        py: 1,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {t('usage.remaining', { remaining, limit })}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={percentage}
        color={progressColor}
        sx={{ mt: 0.5, borderRadius: 1, height: 4 }}
      />
    </Box>
  );
}

export default UsageBanner;
