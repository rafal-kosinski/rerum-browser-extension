import { Box, Alert, Button, Typography } from '@mui/material';
import { RERUM_APP_URL } from '../lib/constants';

interface SuccessConfirmationProps {
  /** Name of the document the product was added to. */
  documentName: string;
  /** Name of the tab within the document. */
  tabName: string;
  /** Name of the product that was added. */
  productName: string;
  /** UUID of the document (used to build the "Open in Rerum" link). */
  documentUuid: string;
  /** Callback to reset the UI and add another product. */
  onAddAnother: () => void;
}

/**
 * Post-add success confirmation.
 *
 * Shows a green alert indicating the product was added, with buttons
 * to open the document in the Rerum web app or start adding another
 * product.
 */
function SuccessConfirmation({
  documentName,
  tabName,
  productName,
  documentUuid,
  onAddAnother,
}: SuccessConfirmationProps) {
  const handleOpenInRerum = () => {
    browser.tabs.create({ url: `${RERUM_APP_URL}/estimates/${documentUuid}` });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Alert severity="success">
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          Product added successfully
        </Typography>
        <Typography variant="caption" color="text.secondary">
          "{productName}" added to {documentName} &rarr; {tabName}
        </Typography>
      </Alert>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button variant="outlined" size="small" onClick={handleOpenInRerum} sx={{ flex: 1 }}>
          Open in Rerum
        </Button>
        <Button variant="contained" size="small" onClick={onAddAnother} sx={{ flex: 1 }}>
          Add Another
        </Button>
      </Box>
    </Box>
  );
}

export default SuccessConfirmation;
