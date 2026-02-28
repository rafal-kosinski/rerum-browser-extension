import { Box, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

/**
 * Loading state shown while the backend AI extraction is in progress.
 *
 * Centered spinner with descriptive text.
 */
function ExtractionProgress() {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 6,
        gap: 2,
      }}
    >
      <CircularProgress size={48} />
      <Typography variant="body2" color="text.secondary">
        {t('extraction.analyzing')}
      </Typography>
    </Box>
  );
}

export default ExtractionProgress;
