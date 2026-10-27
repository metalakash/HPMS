/** Admin > Import bank workbooks: upload the bank's two portfolio workbooks, check them, and submit the load for approval. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export interface ImportTotal {
  field: 'mw' | 'limit' | 'outstanding';
  parsed: string;
  workbook: string | null;
  matches: boolean;
}

export interface ImportStatusRow {
  status: string;
  label: string;
  count: number;
  mw: string;
  limit: string;
  outstanding: string;
  workbook_count: number | null;
  workbook_mw: string | null;
}

export interface ImportSummary {
  as_of: string;
  borrowers: number;
  agrees: boolean;
  totals: ImportTotal[];
  statuses: ImportStatusRow[];
  projection: { quarters: number; borrowers: number; first: string | null; last: string | null };
  bonds: { count: number; amount: string };
  ratio_quarters: number;
  new_loans: { limits: number; quarters: number; amount: string };
  generation: { borrowers: number; plants: number; months: number };
  located: number;
  notes: string[];
}

export interface BankImport {
  id: string;
  status: 'previewed' | 'applied' | 'failed';
  projection_filename: string;
  generation_filename: string;
  uploaded_by: string;
  uploaded_at: string | null;
  agrees: boolean;
  summary: ImportSummary;
  replaces: { projects: number; loans: number; documents: number; change_requests: number } | null;
  files: string;
  applied_by: string | null;
  applied_at: string | null;
  result: Record<string, number> | null;
  request: { id: string; state: string } | null;
}

export const bankImportApi = {
  status: () =>
    api
      .get<{ data: { enabled: boolean; imports: BankImport[] } }>('/api/v1/admin/bank-import')
      .then((r) => r.data.data),
  preview: (projection: File, generation: File) => {
    const form = new FormData();
    form.append('projection', projection);
    form.append('generation', generation);
    return api
      .post<{ data: BankImport }>('/api/v1/admin/bank-import/preview', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120_000, // the workbooks are large and read in full
      })
      .then((r) => r.data.data);
  },
};

export function useBankImports() {
  return useQuery({ queryKey: ['admin', 'bank-import'], queryFn: bankImportApi.status });
}

export function usePreviewBankImport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ projection, generation }: { projection: File; generation: File }) =>
      bankImportApi.preview(projection, generation),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin', 'bank-import'] }),
  });
}
