import { useMemo, useCallback } from 'react';
import {
  Box,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { ExtractedProductData, ColumnDefinitionApi } from '../shared-types/estimate';

/** System column keys that are handled outside this form. */
const EXCLUDED_SYSTEM_COLUMNS = new Set(['productImageUrl', 'productUrl']);

/**
 * Maps system column keys to their corresponding field on ExtractedProductData.
 * Assumes system column_key values match ExtractedProductData field names (camelCase).
 */
const SYSTEM_FIELD_MAP: Record<string, keyof ExtractedProductData | 'quantity' | 'comment'> = {
  productName: 'productName',
  manufacturer: 'manufacturer',
  pricePerUnit: 'pricePerUnit',
  quantity: 'quantity',
  comment: 'comment',
};

interface ProductPreviewProps {
  /** The extracted product data to display/edit. */
  data: ExtractedProductData & { quantity?: number; comment?: string };
  /** Called whenever any field value changes. */
  onChange: (data: ExtractedProductData & { quantity?: number; comment?: string }) => void;
  /** Column definitions from the selected document. Drives which fields to show. */
  columnDefinitions?: ColumnDefinitionApi[] | null;
  /** When true, all fields are read-only (e.g. during save). */
  disabled?: boolean;
}

/**
 * Editable form for extracted product data.
 *
 * When columnDefinitions are provided, renders ALL visible columns from the
 * document's config (using display_name as labels), including non-AI columns
 * as empty editable fields. When not provided, falls back to showing only
 * the fields present in the extracted data.
 */
function ProductPreview({ data, onChange, columnDefinitions, disabled = false }: ProductPreviewProps) {
  const { t } = useTranslation();

  // Columns to render, sorted by display_order, excluding image/url handled elsewhere.
  const columns = useMemo(() => {
    if (!columnDefinitions) return null;
    return columnDefinitions
      .filter((col) => col.is_visible && !EXCLUDED_SYSTEM_COLUMNS.has(col.column_key))
      .sort((a, b) => a.display_order - b.display_order);
  }, [columnDefinitions]);

  const handleSystemFieldChange = useCallback(
    (field: keyof ExtractedProductData, value: string | null) => {
      onChange({ ...data, [field]: value });
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

  const handleCustomFieldChange = useCallback(
    (key: string, value: string) => {
      const updated = { ...(data.customFields ?? {}), [key]: value };
      onChange({ ...data, customFields: updated });
    },
    [data, onChange],
  );

  // Get the value for a column from the extracted data.
  const getFieldValue = (col: ColumnDefinitionApi): string => {
    if (col.is_system_column) {
      const field = SYSTEM_FIELD_MAP[col.column_key];
      if (!field) return '';
      if (field === 'quantity') return String(data.quantity ?? 1);
      if (field === 'comment') return data.comment ?? '';
      return (data[field as keyof ExtractedProductData] as string) ?? '';
    }
    return data.customFields?.[col.column_key] ?? '';
  };

  // Handle value change for any column.
  const handleColumnChange = (col: ColumnDefinitionApi, value: string) => {
    if (col.is_system_column) {
      const field = SYSTEM_FIELD_MAP[col.column_key];
      if (!field) return;
      if (field === 'quantity') {
        handleQuantityChange(value);
      } else if (field === 'comment') {
        handleCommentChange(value);
      } else {
        handleSystemFieldChange(field as keyof ExtractedProductData, value || null);
      }
    } else {
      handleCustomFieldChange(col.column_key, value);
    }
  };

  // Column-driven rendering (when columnDefinitions are available).
  if (columns) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {t('product.preview')}
        </Typography>

        {columns.map((col) => (
          <TextField
            key={col.column_key}
            label={col.display_name}
            value={getFieldValue(col)}
            onChange={(e) => handleColumnChange(col, e.target.value)}
            size="small"
            fullWidth
            disabled={disabled}
            type={col.column_key === 'quantity' ? 'number' : 'text'}
            slotProps={col.column_key === 'quantity' ? { htmlInput: { min: 1 } } : undefined}
            multiline={col.column_key === 'comment'}
            minRows={col.column_key === 'comment' ? 2 : undefined}
            maxRows={col.column_key === 'comment' ? 4 : undefined}
          />
        ))}
      </Box>
    );
  }

  // Fallback: no columnDefinitions (e.g. saving state without doc context).
  // Show only fields that have data.
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle2" color="text.secondary">
        {t('product.preview')}
      </Typography>

      <TextField
        label={t('product.name')}
        value={data.productName ?? ''}
        onChange={(e) => handleSystemFieldChange('productName', e.target.value || null)}
        size="small"
        fullWidth
        disabled={disabled}
      />

      <TextField
        label={t('product.manufacturer')}
        value={data.manufacturer ?? ''}
        onChange={(e) => handleSystemFieldChange('manufacturer', e.target.value || null)}
        size="small"
        fullWidth
        disabled={disabled}
      />

      <TextField
        label={t('product.pricePerUnit')}
        value={data.pricePerUnit ?? ''}
        onChange={(e) => handleSystemFieldChange('pricePerUnit', e.target.value || null)}
        size="small"
        fullWidth
        disabled={disabled}
      />

      <TextField
        label={t('product.quantity')}
        type="number"
        value={data.quantity ?? 1}
        onChange={(e) => handleQuantityChange(e.target.value)}
        size="small"
        fullWidth
        slotProps={{ htmlInput: { min: 1 } }}
        disabled={disabled}
      />
    </Box>
  );
}

export default ProductPreview;
