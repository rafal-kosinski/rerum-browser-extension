import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * Loading state shown while the backend AI extraction is in progress.
 *
 * Centered spinner with descriptive text.
 */
function ExtractionProgress() {
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
        AI is analyzing the product...
      </Typography>
    </Box>
  );
}

export default ExtractionProgress;
