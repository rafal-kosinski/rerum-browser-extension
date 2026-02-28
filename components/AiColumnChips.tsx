import { useMemo } from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { ColumnDefinitionApi } from '../shared-types/estimate';

interface AiColumnChipsProps {
  columnDefinitions: ColumnDefinitionApi[] | null | undefined;
}

const MAX_VISIBLE_CHIPS = 4;

function AiColumnChips({ columnDefinitions }: AiColumnChipsProps) {
  const { t } = useTranslation();

  const aiColumns = useMemo(() => {
    if (!columnDefinitions) return [];
    return columnDefinitions
      .filter((col) => col.ai_enabled)
      .sort((a, b) => a.display_order - b.display_order);
  }, [columnDefinitions]);

  if (aiColumns.length === 0) return null;

  const visible = aiColumns.slice(0, MAX_VISIBLE_CHIPS);
  const remaining = aiColumns.length - visible.length;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
      <AutoAwesomeIcon sx={{ fontSize: 14, color: 'text.secondary', mr: 0.5 }} />
      <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
        {t('column.aiColumns')}:
      </Typography>
      {visible.map((col) => (
        <Chip
          key={col.column_key}
          label={col.display_name}
          size="small"
          variant="outlined"
          sx={{ height: 20, fontSize: '0.7rem' }}
        />
      ))}
      {remaining > 0 && (
        <Typography variant="caption" color="text.secondary">
          {t('column.moreColumns', { count: remaining })}
        </Typography>
      )}
    </Box>
  );
}

export default AiColumnChips;
