import { Box, Alert, Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const handleOpenInRerum = () => {
    browser.tabs.create({ url: `${RERUM_APP_URL}/estimate/${documentUuid}` });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Alert severity="success">
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {t('product.addedSuccess')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('product.addedDetail', { productName, documentName, tabName })}
        </Typography>
      </Alert>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button variant="outlined" size="small" onClick={handleOpenInRerum} sx={{ flex: 1 }}>
          {t('product.openInRerum')}
        </Button>
        <Button variant="contained" size="small" onClick={onAddAnother} sx={{ flex: 1 }}>
          {t('product.addAnother')}
        </Button>
      </Box>
    </Box>
  );
}

export default SuccessConfirmation;
