import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Upload } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { queryKeys } from '@/hooks/queries';
import { getErrorMessage } from '@/services/api';
import { loansApi } from '@/services/endpoints';
import type { ExposureImportResult } from '@/types/api';
import type { BulkImportModalProps } from '@/types/modal';
import { parseExposureCsv, type ExposureCsvResult } from '@/utils/exposureCsv';
import { BaseModal } from './BaseModal';

const MAX_BYTES = 5 * 1024 * 1024;
const SHOWN_ERRORS = 20;

/**
 * Imports loan exposures from the template CSV: the file is checked in the browser, the rows that
 * pass are sent to the exposure endpoint, and the server's own result is shown. Admin only.
 */
export function BulkImportModal({ isOpen, onClose }: BulkImportModalProps) {
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ExposureCsvResult | null>(null);
  const [fileError, setFileError] = useState('');
  const [result, setResult] = useState<ExposureImportResult | null>(null);

  const upload = useMutation({
    mutationFn: () => loansApi.importExposures(parsed?.rows ?? [], fileName),
    onSuccess: (data) => {
      setResult(data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.loans });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });

  const reset = () => {
    setFileName('');
    setParsed(null);
    setFileError('');
    setResult(null);
    upload.reset();
  };

  const close = () => {
    reset();
    onClose();
  };

  const onFile = async (file: File | undefined) => {
    reset();
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) return setFileError('Choose a .csv file');
    if (file.size > MAX_BYTES) return setFileError('The file must be smaller than 5 MB');
    setFileName(file.name);
    setParsed(parseExposureCsv(await file.text()));
  };

  const valid = parsed?.rows.length ?? 0;
  const invalid = parsed?.errors.length ?? 0;

  const footer = (
    <div className="flex justify-end gap-2">
      <Button variant="secondary" onClick={close} disabled={upload.isPending}>
        {result ? 'Close' : 'Cancel'}
      </Button>
      {!result && (
        <Button onClick={() => upload.mutate()} disabled={valid === 0} loading={upload.isPending}>
          {valid > 0 ? `Import ${valid} ${valid === 1 ? 'row' : 'rows'}` : 'Import'}
        </Button>
      )}
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={close}
      size="lg"
      title="Import loan exposures"
      description="One loan account per row. Existing accounts are updated, new ones are created."
      footer={footer}
    >
      <div className="flex flex-col gap-4 text-sm">
        {!result && (
          <div>
            <input
              type="file"
              id="exposure-file"
              accept=".csv"
              className="sr-only"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <label
              htmlFor="exposure-file"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-line px-4 py-6 hover:bg-surface-2"
            >
              <Upload className="size-4 text-muted" aria-hidden="true" />
              {fileName || 'Choose a CSV file'}
            </label>
            <p className="mt-2 text-muted">
              Columns as in <code>loan_exposure_import_template.csv</code>: project_id, facility_type,
              sanctioned_amount, outstanding_principal, interest_rate_pct, tenor_years, grace_years,
              sanction_date, disbursement_date, maturity_date (dates as YYYY-MM-DD).
            </p>
          </div>
        )}

        {fileError && (
          <p role="alert" className="text-danger">
            {fileError}
          </p>
        )}

        {parsed && !result && (
          <div role="status">
            <p className="font-medium">
              {valid} of {parsed.totalRows} {parsed.totalRows === 1 ? 'row is' : 'rows are'} ready to import
              {invalid > 0 && parsed.totalRows > 0 && `; ${invalid} will be left out`}
            </p>
            {invalid > 0 && (
              <ul className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto text-danger">
                {parsed.errors.slice(0, SHOWN_ERRORS).map((error) => (
                  <li key={`${error.line}-${error.message}`}>
                    Line {error.line}: {error.message}
                  </li>
                ))}
                {invalid > SHOWN_ERRORS && <li>…and {invalid - SHOWN_ERRORS} more</li>}
              </ul>
            )}
          </div>
        )}

        {upload.isError && (
          <div role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft p-3 text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {getErrorMessage(upload.error)}
          </div>
        )}

        {result && (
          <div role="status">
            <p className="font-medium">
              Import finished: {result.created_count} created, {result.updated_count} updated,{' '}
              {result.skipped_count} skipped
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto text-danger">
                {result.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
            {result.warnings.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-muted">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </BaseModal>
  );
}
