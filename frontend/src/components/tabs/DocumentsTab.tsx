import { useState } from 'react';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Input, Select } from '@/components/common/Field';
import { EmptyState } from '@/components/common/States';
import { BaseModal } from '@/components/modals/BaseModal';
import { getErrorMessage } from '@/services/api';
import {
  documentsApi,
  fileProblem,
  formatBytes,
  type ProjectDocument,
  useDocumentMutation,
  useDocumentRules,
  useDocuments,
  useDocumentVersions,
} from '@/services/documents';
import { useAuthStore } from '@/store/useAuthStore';
import { formatDate, humanize } from '@/utils/format';
import { TabState } from './TabState';

const TYPE_LABELS: Record<string, string> = { ppa: 'PPA' };
const typeLabel = (classification: string) => TYPE_LABELS[classification] ?? humanize(classification);

function FormError({ error }: { error: unknown }) {
  return error ? <p role="alert" className="mt-3 text-sm text-danger">{getErrorMessage(error)}</p> : null;
}

function FileField({ id, onChange, problem }: { id: string; onChange: (file: File | null) => void; problem: string | null }) {
  return (
    <div className="sm:col-span-2">
      <label htmlFor={id} className="mb-1 block text-sm font-medium">File</label>
      <input
        id={id}
        type="file"
        className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-1.5"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      {problem && <p className="mt-1 text-sm text-danger">{problem}</p>}
    </div>
  );
}

function FileDocumentModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const rules = useDocumentRules(projectId);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: '', classification: 'sanction_letter', document_date: '', expiry_date: '', source_reference: '', upload_comment: '',
  });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const save = useDocumentMutation(projectId, () => documentsApi.file(projectId, { ...form, title: form.title.trim(), file: file! }));
  const problem = fileProblem(file, rules.data);
  const valid = file && !problem && form.title.trim();
  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title="File a document"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid} loading={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>
            File document
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FileField id="document-file" onChange={setFile} problem={problem} />
        <Input label="Title" className="sm:col-span-2" value={form.title} onChange={(e) => set('title', e.target.value)} />
        <Select
          label="Type"
          value={form.classification}
          onChange={(e) => set('classification', e.target.value)}
          options={(rules.data?.classifications ?? ['sanction_letter']).map((c) => ({ value: c, label: typeLabel(c) }))}
        />
        <Input label="Document date" type="date" value={form.document_date} onChange={(e) => set('document_date', e.target.value)} />
        <Input label="Expires on (if it does)" type="date" value={form.expiry_date} onChange={(e) => set('expiry_date', e.target.value)} />
        <Input label="Reference" placeholder="Letter number or meeting" value={form.source_reference} onChange={(e) => set('source_reference', e.target.value)} />
        <Input label="Note for the audit log" className="sm:col-span-2" value={form.upload_comment} onChange={(e) => set('upload_comment', e.target.value)} />
      </div>
      {rules.data && (
        <p className="mt-3 text-xs text-muted">
          PDF, image, Word or Excel, up to {rules.data.max_mb} MB. Files are stored encrypted and every version is kept.
        </p>
      )}
      <FormError error={save.error} />
    </BaseModal>
  );
}

function VersionsModal({ projectId, doc, canFile, onClose }: { projectId: string; doc: ProjectDocument; canFile: boolean; onClose: () => void }) {
  const rules = useDocumentRules(projectId);
  const versions = useDocumentVersions(projectId, doc.id);
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState('');
  const [downloadError, setDownloadError] = useState<unknown>(null);
  const upload = useDocumentMutation(projectId, () => documentsApi.addVersion(projectId, doc.id, file!, comment.trim()));
  const problem = fileProblem(file, rules.data);
  return (
    <BaseModal isOpen onClose={onClose} title={doc.title} size="lg">
      <ol className="divide-y divide-line" aria-label="Versions">
        {(versions.data ?? []).map((v) => (
          <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-medium">
                Version {v.version_number} {v.is_current && <Badge tone="success">Current</Badge>}
              </p>
              <p className="truncate text-sm text-muted">
                {v.file_name} · {formatBytes(v.file_size_bytes)} · {v.uploaded_by ?? 'unknown'} · {formatDate(v.uploaded_at)}
              </p>
              {v.upload_comment && <p className="text-sm">{v.upload_comment}</p>}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setDownloadError(null);
                documentsApi.download(projectId, doc.id, v).catch(setDownloadError);
              }}
            >
              Download v{v.version_number}
            </Button>
          </li>
        ))}
      </ol>
      <FormError error={downloadError} />
      {canFile && doc.status !== 'archived' && (
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <h3 className="font-semibold sm:col-span-2">Upload a new version</h3>
          <FileField id="version-file" onChange={setFile} problem={problem} />
          <Input label="What changed" className="sm:col-span-2" value={comment} onChange={(e) => setComment(e.target.value)} />
          <div className="sm:col-span-2">
            <Button
              disabled={!file || Boolean(problem) || !comment.trim()}
              loading={upload.isPending}
              onClick={() =>
                upload.mutate(undefined, {
                  onSuccess: () => {
                    setFile(null);
                    setComment('');
                  },
                })
              }
            >
              Upload version
            </Button>
          </div>
          <FormError error={upload.error} />
        </div>
      )}
    </BaseModal>
  );
}

function ArchiveModal({ projectId, doc, onClose }: { projectId: string; doc: ProjectDocument; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const archive = useDocumentMutation(projectId, () => documentsApi.archive(projectId, doc.id, reason.trim()));
  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title={`Archive ${doc.title}?`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={!reason.trim()} loading={archive.isPending} onClick={() => archive.mutate(undefined, { onSuccess: onClose })}>
            Archive
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-sm">Archived documents are hidden from the list but never deleted; every version stays downloadable.</p>
      <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      <FormError error={archive.error} />
    </BaseModal>
  );
}

export function DocumentsTab({ projectId }: { projectId: string }) {
  const [showArchived, setShowArchived] = useState(false);
  const query = useDocuments(projectId, showArchived);
  const roles = useAuthStore((s) => s.user?.roles) ?? [];
  const canFile = roles.includes('admin') || roles.includes('maker');
  const [filing, setFiling] = useState(false);
  const [open, setOpen] = useState<ProjectDocument | null>(null);
  const [archiving, setArchiving] = useState<ProjectDocument | null>(null);

  const columns: Column<ProjectDocument>[] = [
    {
      key: 'title',
      header: 'Document',
      render: (d) => (
        <button type="button" className="text-left font-medium text-primary hover:underline" onClick={() => setOpen(d)}>
          {d.title}
          <span className="block text-xs font-normal text-muted">{d.current_version?.file_name}</span>
        </button>
      ),
    },
    { key: 'type', header: 'Type', render: (d) => typeLabel(d.classification) },
    { key: 'date', header: 'Dated', hideOnMobile: true, render: (d) => formatDate(d.document_date) },
    { key: 'version', header: 'Version', align: 'right', render: (d) => d.version_count },
    {
      key: 'size',
      header: 'Size',
      align: 'right',
      hideOnMobile: true,
      render: (d) => (d.current_version ? formatBytes(d.current_version.file_size_bytes) : '—'),
    },
    {
      key: 'status',
      header: '',
      align: 'right',
      render: (d) =>
        d.status === 'archived' ? (
          <Badge tone="neutral">Archived</Badge>
        ) : canFile ? (
          <Button variant="ghost" size="sm" onClick={() => setArchiving(d)}>Archive</Button>
        ) : null,
    },
  ];

  return (
    <TabState query={query}>
      {(documents) => (
        <Card>
          <CardHeader
            title="Documents"
            description="Sanction letters, PPAs, licences and studies, with every version kept"
            actions={
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                  Show archived
                </label>
                {canFile && <Button variant="secondary" size="sm" onClick={() => setFiling(true)}>File a document</Button>}
              </div>
            }
          />
          <CardBody>
            <DataTable
              caption="Documents"
              columns={columns}
              rows={documents}
              rowKey={(d) => d.id}
              empty={<EmptyState title="No documents filed" />}
            />
          </CardBody>
          {filing && <FileDocumentModal projectId={projectId} onClose={() => setFiling(false)} />}
          {open && <VersionsModal projectId={projectId} doc={open} canFile={canFile} onClose={() => setOpen(null)} />}
          {archiving && <ArchiveModal projectId={projectId} doc={archiving} onClose={() => setArchiving(null)} />}
        </Card>
      )}
    </TabState>
  );
}
