import { useState } from 'react';
import { Upload, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { BaseModal } from './BaseModal';
import { Spinner } from '@/components/common/Spinner';
import type { BulkImportModalProps, ImportValidationResult } from '@/types/modal';

const ACCEPTED_FORMATS = '.csv,.xls,.xlsx';
const ENTITY_TYPE_LABELS: Record<string, string> = {
  projects: 'Projects',
  loans: 'Loans',
  generation: 'Generation Data',
  disbursements: 'Disbursements',
};

/**
 * BulkImportModal: Handles bulk data ingestion with validation preview.
 * Supports CSV, XLS, XLSX formats. Shows validation errors before import.
 */
export function BulkImportModal({
  isOpen,
  onClose,
  entityType,
  isLoading = false,
  onSubmit,
  onValidationComplete,
}: BulkImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [validationResults, setValidationResults] = useState<ImportValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file size (max 50MB)
      if (selectedFile.size > 50 * 1024 * 1024) {
        setError('File size must be less than 50MB');
        return;
      }

      // Validate file type
      const extension = selectedFile.name.split('.').pop()?.toLowerCase();
      if (!['csv', 'xls', 'xlsx'].includes(extension || '')) {
        setError('File must be CSV, XLS, or XLSX format');
        return;
      }

      setFile(selectedFile);
      setError('');
      setValidationResults(null);
    }
  };

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      // In production, send file to backend for validation
      // For now, simulate validation
      const results: ImportValidationResult = {
        totalRows: 150,
        validRows: 145,
        invalidRows: 5,
        errors: [
          { rowNumber: 23, errorMessage: 'Invalid project_id' },
          { rowNumber: 45, errorMessage: 'Negative amount value' },
          { rowNumber: 67, errorMessage: 'Missing required field: project_name' },
          { rowNumber: 89, errorMessage: 'Invalid date format' },
          { rowNumber: 102, errorMessage: 'Duplicate project_id' },
        ],
      };

      setValidationResults(results);
      onValidationComplete?.(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file');
      return;
    }

    try {
      await onSubmit(file);
      // Reset form on success
      setFile(null);
      setValidationResults(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    }
  };

  const downloadErrorCsv = () => {
    if (!validationResults) return;

    const csv = [
      ['Row Number', 'Error Message'].join(','),
      ...validationResults.errors.map((e) =>
        [e.rowNumber, `"${e.errorMessage}"`].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-errors-${entityType}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const footer = (
    <div className="flex gap-3 justify-end">
      <button
        type="button"
        onClick={onClose}
        disabled={isLoading || isValidating}
        className="px-4 py-2 rounded-lg border border-line text-sm font-medium text-fg hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Cancel
      </button>
      {validationResults && validationResults.invalidRows > 0 && (
        <button
          type="button"
          onClick={downloadErrorCsv}
          disabled={isLoading}
          className="px-4 py-2 rounded-lg border border-warning text-sm font-medium text-warning hover:bg-warning/10 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="size-4" />
          Download Errors
        </button>
      )}
      {validationResults ? (
        <button
          type="submit"
          form="bulk-import-form"
          disabled={isLoading || validationResults.invalidRows > 0}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading && <Spinner className="size-4" />}
          Import {validationResults.validRows} Rows
        </button>
      ) : (
        <button
          type="submit"
          form="bulk-import-form"
          disabled={!file || isValidating}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isValidating && <Spinner className="size-4" />}
          {isValidating ? 'Validating...' : 'Validate'}
        </button>
      )}
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk Import"
      description={`Import ${ENTITY_TYPE_LABELS[entityType]}`}
      size="lg"
      footer={footer}
    >
      <form id="bulk-import-form" onSubmit={validationResults ? handleImport : handleValidate} className="space-y-4">
        {/* File upload */}
        <div className="space-y-2">
          <label htmlFor="import-file" className="block text-sm font-medium text-fg">
            Select File
          </label>
          <div className="relative">
            <input
              type="file"
              id="import-file"
              onChange={handleFileChange}
              disabled={isLoading || isValidating}
              className="sr-only"
              accept={ACCEPTED_FORMATS}
            />
            <label
              htmlFor="import-file"
              className="flex items-center justify-center gap-2 px-4 py-6 rounded-lg border-2 border-dashed border-line cursor-pointer hover:border-primary hover:bg-surface-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="size-5 text-muted" />
              <div className="text-center">
                <p className="text-sm font-medium text-fg">
                  {file ? file.name : 'Click to upload or drag and drop'}
                </p>
                <p className="text-xs text-muted">CSV, XLS, or XLSX (max 50MB)</p>
              </div>
            </label>
          </div>
        </div>

        {/* Validation results */}
        {validationResults && (
          <div className="space-y-3">
            <div className="rounded-lg bg-surface-2 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="size-5 text-success" />
                <span className="text-sm font-medium text-fg">
                  {validationResults.validRows} valid rows ready to import
                </span>
              </div>
              {validationResults.invalidRows > 0 && (
                <div className="flex items-center gap-2 text-warning">
                  <AlertCircle className="size-5" />
                  <span className="text-sm font-medium">
                    {validationResults.invalidRows} row{validationResults.invalidRows !== 1 ? 's' : ''} with errors
                  </span>
                </div>
              )}
            </div>

            {validationResults.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-fg">Errors found:</p>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-line">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 border-b border-line bg-surface-2">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Row</th>
                        <th className="px-3 py-2 text-left font-medium">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {validationResults.errors.map((error) => (
                        <tr key={error.rowNumber} className="hover:bg-surface-2">
                          <td className="px-3 py-2 text-muted">{error.rowNumber}</td>
                          <td className="px-3 py-2 text-danger">{error.errorMessage}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {validationResults.invalidRows > 0 && (
              <div className="rounded-lg bg-warning/10 p-3 text-sm text-warning">
                <p className="font-medium">Note:</p>
                <p className="mt-1">
                  Download the error report, fix the issues, and re-upload. Only valid rows will be imported.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
            {error}
          </div>
        )}

        {/* Help text */}
        <div className="rounded-lg bg-info/10 p-3 text-sm text-info space-y-2">
          <p className="font-medium">Bulk Import Guidelines:</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>File must have headers in the first row</li>
            <li>All required fields must be present</li>
            <li>Dates should be in YYYY-MM-DD format or BS format (YYYY-MM-DD)</li>
            <li>Numbers should not have currency symbols</li>
            <li>Download a sample template from the documentation</li>
          </ul>
        </div>
      </form>
    </BaseModal>
  );
}
