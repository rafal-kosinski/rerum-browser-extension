import { Alert } from '@mui/material';
import type { ProductConfidence } from '../shared-types/estimate';

interface NonProductPageHintProps {
  /** Product-page confidence level based on metadata analysis. */
  confidence: ProductConfidence;
}

/**
 * Contextual warning for pages that may not be product pages.
 *
 * - `high` confidence: renders nothing (no warning needed).
 * - `medium` confidence: subtle info alert about limited data.
 * - `low` confidence: prominent warning about potential inaccuracy.
 */
function NonProductPageHint({ confidence }: NonProductPageHintProps) {
  if (confidence === 'high') {
    return null;
  }

  if (confidence === 'medium') {
    return (
      <Alert severity="info" sx={{ py: 0.25, '& .MuiAlert-message': { py: 0 } }}>
        Limited product data detected on this page.
      </Alert>
    );
  }

  // confidence === 'low'
  return (
    <Alert severity="warning" sx={{ py: 0.25, '& .MuiAlert-message': { py: 0 } }}>
      This page may not be a product page. Extraction results may be inaccurate.
    </Alert>
  );
}

export default NonProductPageHint;
