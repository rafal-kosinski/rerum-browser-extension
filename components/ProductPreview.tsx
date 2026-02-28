import { useState, useCallback } from 'react';
import {
  Box,
  TextField,
  Typography,
  IconButton,
  Collapse,
  Divider,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { ExtractedProductData } from '../shared-types/estimate';

interface ProductPreviewProps {
  /** The extracted product data to display/edit. */
  data: ExtractedProductData & { quantity?: number; comment?: string };
  /** Called whenever any field value changes. */
  onChange: (data: ExtractedProductData & { quantity?: number; comment?: string }) => void;
  /** Optional map of custom field column keys to their human-readable labels. */
  customFieldLabels?: Record<string, string>;
  /** When true, all fields are read-only (e.g. during save). */
  disabled?: boolean;
}

/**
 * Editable form for extracted product data.
 *
 * Renders MUI TextFields for the standard product fields (name, manufacturer,
 * price, quantity) plus collapsible sections for comment and custom fields.
 * All fields are controlled and call `onChange` on every edit.
 */
function ProductPreview({ data, onChange, customFieldLabels, disabled = false }: ProductPreviewProps) {
  const { t } = useTranslation();
  const [commentOpen, setCommentOpen] = useState(false);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);

  const handleFieldChange = useCallback(
    (field: keyof ExtractedProductData, value: string | null) => {
      onChange({ ...data, [field]: value });
    },
    [data, onChange],
  );

  const handleCustomFieldChange = useCallback(
    (key: string, value: string) => {
      const updated = { ...(data.customFields ?? {}), [key]: value };
      onChange({ ...data, customFields: updated });
    },
    [data, onChange],
  );

  const handleQuantityChange = useCallback(
    (value: string) => {
      const num = parseInt(value, 10);
      const quantity = isNaN(num) ? 1 : num;
      onChange({ ...data, quantity });
    },
    [data, onChange],
  );

  const handleCommentChange = useCallback(
    (value: string) => {
      onChange({ ...data, comment: value });
    },
    [data, onChange],
  );

  const customFieldKeys = Object.keys(data.customFields ?? {});
  const hasCustomFields = customFieldKeys.length > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle2" color="text.secondary">
        {t('product.preview')}
      </Typography>

      <TextField
        label={t('product.name')}
        value={data.productName ?? ''}
        onChange={(e) => handleFieldChange('productName', e.target.value || null)}
        size="small"
        fullWidth
        disabled={disabled}
      />

      <TextField
        label={t('product.manufacturer')}
        value={data.manufacturer ?? ''}
        onChange={(e) => handleFieldChange('manufacturer', e.target.value || null)}
        size="small"
        fullWidth
        disabled={disabled}
      />

      <TextField
        label={t('product.pricePerUnit')}
        value={data.pricePerUnit ?? ''}
        onChange={(e) => handleFieldChange('pricePerUnit', e.target.value || null)}
        size="small"
        fullWidth
        placeholder={t('product.pricePlaceholder')}
        disabled={disabled}
      />

      <TextField
        label={t('product.quantity')}
        type="number"
        value={data.quantity ?? 1}
        onChange={(e) => handleQuantityChange(e.target.value)}
        size="small"
        fullWidth
        inputProps={{ min: 1 }}
        disabled={disabled}
      />

      {/* Collapsible: Comment */}
      <Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onClick={() => setCommentOpen(!commentOpen)}
        >
          <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
            {t('product.comment')}
          </Typography>
          <IconButton size="small">
            {commentOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Box>
        <Collapse in={commentOpen}>
          <TextField
            value={data.comment ?? ''}
            onChange={(e) => handleCommentChange(e.target.value)}
            size="small"
            fullWidth
            multiline
            minRows={2}
            maxRows={4}
            placeholder={t('product.commentPlaceholder')}
            sx={{ mt: 1 }}
            disabled={disabled}
          />
        </Collapse>
      </Box>

      {/* Collapsible: Custom Fields */}
      {hasCustomFields && (
        <>
          <Divider />
          <Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              onClick={() => setCustomFieldsOpen(!customFieldsOpen)}
            >
              <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                {t('product.customFields', { count: customFieldKeys.length })}
              </Typography>
              <IconButton size="small">
                {customFieldsOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
            </Box>
            <Collapse in={customFieldsOpen}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
                {customFieldKeys.map((key) => (
                  <TextField
                    key={key}
                    label={customFieldLabels?.[key] ?? key}
                    value={data.customFields?.[key] ?? ''}
                    onChange={(e) => handleCustomFieldChange(key, e.target.value)}
                    size="small"
                    fullWidth
                    disabled={disabled}
                  />
                ))}
              </Box>
            </Collapse>
          </Box>
        </>
      )}
    </Box>
  );
}

export default ProductPreview;
