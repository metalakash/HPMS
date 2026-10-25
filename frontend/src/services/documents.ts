/** Project documents: list, file, add a version, download, archive (RFP C.1, C.3, C.10, G.5). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export interface DocumentVersion {
  id: string;
  version_number: number;
  is_current: boolean;
  file_name: string;
  file_size_bytes: number;
  mime_type: string | null;
  sha256: string;
  encrypted: boolean;
  upload_comment: string | null;
  uploaded_by: string | null;
  uploaded_at: string | null;
}

export interface ProjectDocument {
  id: string;
  document_code: string;
  title: string;
  description: string | null;
  classification: string;
  status: string;
  document_date: string | null;
  expiry_date: string | null;
  source_reference: string | null;
  version_count: number;
  created_by: string | null;
  created_at: string | null;
  current_version: DocumentVersion | null;
}

export interface DocumentRules {
  classifications: string[];
  extensions: string[];
  max_mb: number;
}

export interface NewDocument {
  file: File;
  title: string;
  classification: string;
  document_date?: string;
  expiry_date?: string;
  source_reference?: string;
  upload_comment?: string;
}

// Uploads of several megabytes take longer than the default 30 seconds on a slow link. The client's default
// JSON content type would turn the form into JSON; multipart lets the browser add the boundary.
const UPLOAD_TIMEOUT = 120_000;
const MULTIPART = { timeout: UPLOAD_TIMEOUT, headers: { 'Content-Type': 'multipart/form-data' } };
const base = (projectId: string) => `/api/v1/projects/${projectId}/documents`;

function form(fields: Record<string, string | File | undefined>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== '') data.append(key, value);
  }
  return data;
}

export const documentsApi = {
  rules: (projectId: string) => api.get<{ data: DocumentRules }>(`${base(projectId)}/types`).then((r) => r.data.data),
  list: (projectId: string, includeArchived: boolean) =>
    api
      .get<{ data: ProjectDocument[] }>(base(projectId), { params: { include_archived: includeArchived } })
      .then((r) => r.data.data),
  versions: (projectId: string, documentId: string) =>
    api.get<{ data: DocumentVersion[] }>(`${base(projectId)}/${documentId}/versions`).then((r) => r.data.data),
  file: (projectId: string, doc: NewDocument) =>
    api.post(base(projectId), form({ ...doc }), MULTIPART).then((r) => r.data.data as ProjectDocument),
  addVersion: (projectId: string, documentId: string, file: File, comment: string) =>
    api
      .post(`${base(projectId)}/${documentId}/versions`, form({ file, upload_comment: comment }), MULTIPART)
      .then((r) => r.data.data as ProjectDocument),
  archive: (projectId: string, documentId: string, reason: string) =>
    api.post(`${base(projectId)}/${documentId}/archive`, form({ reason }), MULTIPART).then((r) => r.data.data as ProjectDocument),
  /** Fetches the file with the session's token and hands it to the browser to save. */
  download: async (projectId: string, documentId: string, version: DocumentVersion) => {
    const response = await api.get<Blob>(`${base(projectId)}/${documentId}/versions/${version.id}/download`, {
      responseType: 'blob',
      timeout: UPLOAD_TIMEOUT,
    });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = version.file_name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

const listKey = (projectId: string) => ['projects', projectId, 'documents'];

export function useDocuments(projectId: string, includeArchived: boolean) {
  return useQuery({
    queryKey: [...listKey(projectId), includeArchived],
    queryFn: () => documentsApi.list(projectId, includeArchived),
  });
}

export function useDocumentRules(projectId: string) {
  return useQuery({ queryKey: ['documents', 'rules'], queryFn: () => documentsApi.rules(projectId), staleTime: Infinity });
}

export function useDocumentVersions(projectId: string, documentId: string | null) {
  return useQuery({
    queryKey: [...listKey(projectId), documentId, 'versions'],
    queryFn: () => documentsApi.versions(projectId, documentId!),
    enabled: Boolean(documentId),
  });
}

/** Any change to a project's documents refreshes its list and version histories. */
export function useDocumentMutation<T>(projectId: string, run: (input: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => client.invalidateQueries({ queryKey: listKey(projectId) }),
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** The file chosen is checked before upload, with the same rules the server applies. */
export function fileProblem(file: File | null, rules: DocumentRules | undefined): string | null {
  if (!file || !rules) return null;
  const extension = file.name.includes('.') ? `.${file.name.split('.').pop()!.toLowerCase()}` : '';
  if (!rules.extensions.includes(extension)) return `Attach one of: ${rules.extensions.join(', ')}`;
  if (file.size === 0) return 'This file is empty';
  if (file.size > rules.max_mb * 1024 * 1024) return `This file is ${formatBytes(file.size)}; the limit is ${rules.max_mb} MB`;
  return null;
}
