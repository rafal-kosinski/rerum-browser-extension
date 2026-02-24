import {
  Box,
  Autocomplete,
  TextField,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Link,
} from '@mui/material';
import { LockOutlined as LockOutlinedIcon } from '@mui/icons-material';
import { RERUM_APP_URL } from '../lib/constants';
import type {
  EstimateDocumentSummary,
  EstimateDocumentDto,
} from '../shared-types/estimate';

interface DocumentPickerProps {
  /** Available document summaries. */
  documents: EstimateDocumentSummary[];
  /** UUID of the currently selected document, or `null`. */
  selectedDocumentUuid: string | null;
  /** Tab ID of the currently selected tab, or `null`. */
  selectedTabId: string | null;
  /** Full document DTO (fetched on document select), or `null`. */
  selectedDocument: EstimateDocumentDto | null;
  /** Callback when the document selection changes. */
  onDocumentChange: (uuid: string | null) => void;
  /** Callback when the tab selection changes. */
  onTabChange: (tabId: string | null) => void;
  /** Whether the picker is disabled. */
  disabled: boolean;
}

/**
 * Document and tab selection component.
 *
 * Uses MUI Autocomplete for document search/selection with lock icon
 * indicators for locked documents. A secondary Select dropdown populates
 * tab options when a document is chosen.
 */
function DocumentPicker({
  documents,
  selectedDocumentUuid,
  selectedTabId,
  selectedDocument,
  onDocumentChange,
  onTabChange,
  disabled,
}: DocumentPickerProps) {
  const selectedDocSummary = documents.find((d) => d.uuid === selectedDocumentUuid) ?? null;
  const isLocked = selectedDocSummary?.isLocked ?? false;
  const tabs = selectedDocument?.documentContent.tabs ?? [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle2" color="text.secondary">
        Add To
      </Typography>

      {/* Document Autocomplete */}
      <Autocomplete
        options={documents}
        value={selectedDocSummary}
        onChange={(_event, newValue) => {
          onDocumentChange(newValue?.uuid ?? null);
        }}
        getOptionLabel={(option) => option.documentName}
        isOptionEqualToValue={(option, value) => option.uuid === value.uuid}
        disabled={disabled}
        size="small"
        renderOption={(props, option) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { key, ...rest } = props;
          return (
            <li key={option.uuid} {...rest}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  opacity: option.isLocked ? 0.5 : 1,
                  width: '100%',
                }}
              >
                {option.isLocked && (
                  <LockOutlinedIcon fontSize="small" color="action" />
                )}
                <Typography
                  variant="body2"
                  noWrap
                  sx={{
                    color: option.isLocked ? 'text.disabled' : 'text.primary',
                  }}
                >
                  {option.documentName}
                </Typography>
              </Box>
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField {...params} label="Document" placeholder="Search documents..." />
        )}
      />

      {/* Locked document warning */}
      {isLocked && (
        <Alert severity="warning" sx={{ py: 0.5, '& .MuiAlert-message': { py: 0 } }}>
          This document is locked.{' '}
          <Link
            href={`${RERUM_APP_URL}/subscription`}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: 'inherit', fontWeight: 600 }}
          >
            Manage Subscription
          </Link>
          {' '}to edit it.
        </Alert>
      )}

      {/* Tab Select */}
      <FormControl size="small" fullWidth disabled={!selectedDocumentUuid || tabs.length === 0 || disabled || isLocked}>
        <InputLabel id="tab-select-label">Tab</InputLabel>
        <Select
          labelId="tab-select-label"
          value={selectedTabId ?? ''}
          label="Tab"
          onChange={(e) => onTabChange(e.target.value || null)}
        >
          {tabs.map((tab) => (
            <MenuItem key={tab.tab_id} value={tab.tab_id}>
              {tab.tab_name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}

export default DocumentPicker;
