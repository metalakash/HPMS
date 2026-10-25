import { useState } from 'react';
import { Input, Select } from '@/components/common/Field';
import { Skeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/States';
import { BaseModal } from '@/components/modals/BaseModal';
import { JustificationModal } from '@/components/modals/JustificationModal';
import { getErrorMessage } from '@/services/api';
import {
  amountsFrom,
  isAmount,
  PERIOD_AMOUNTS,
  TERM_FIELDS,
  useCovenantInputs,
  useProposeCovenantInput,
  type CovenantInputs,
} from '@/services/covenantInputs';
import { formatFiscalQuarter } from '@/utils/format';

interface ModalProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
  /** Called once the change request is raised. */
  onSubmitted: (message: string) => void;
}

function FiguresForm({ inputs, projectId, projectName, onClose, onSubmitted }: ModalProps & { inputs: CovenantInputs }) {
  const propose = useProposeCovenantInput('FINANCIAL_PERIOD', projectId);
  const [quarter, setQuarter] = useState(inputs.reportable_quarters[0]?.quarter ?? '');
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [audited, setAudited] = useState<Record<string, boolean>>({});
  const [source, setSource] = useState('');

  // A quarter that is already on file starts from its reported values, so a correction shows what it replaces
  const existing = inputs.periods.find((p) => p.quarter === quarter);
  const form: Record<string, string> = {
    ...Object.fromEntries(PERIOD_AMOUNTS.map(({ key }) => [key, existing?.[key] ?? ''])),
    ...edits[quarter],
  };
  const isAudited = audited[quarter] ?? existing?.is_audited ?? false;
  const set = (key: string, value: string) =>
    setEdits((current) => ({ ...current, [quarter]: { ...current[quarter], [key]: value } }));

  const amounts = amountsFrom(form, PERIOD_AMOUNTS.map((a) => a.key));
  const invalid = Object.entries(amounts).filter(([, value]) => !isAmount(value)).map(([key]) => key);
  const complete = Boolean(quarter) && Object.keys(amounts).length > 0 && invalid.length === 0 && source.trim().length >= 3;

  return (
    <JustificationModal
      isOpen
      onClose={onClose}
      entityType="Covenant figures"
      entityId={projectId}
      actionName={`recording figures for ${projectName}`}
      isLoading={propose.isPending}
      canSubmit={complete}
      allowDocument={false}
      onSubmit={async ({ reason }) => {
        try {
          await propose.mutateAsync({
            changes: { quarter_ad: quarter, ...amounts, is_audited: isAudited, source_reference: source.trim() },
            justification: reason,
          });
        } catch (error) {
          throw new Error(getErrorMessage(error), { cause: error });
        }
        onSubmitted(`Figures for ${formatFiscalQuarter(quarter)} sent for approval. Covenants are re-tested once two checkers approve.`);
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="Fiscal quarter"
          className="sm:col-span-2"
          value={quarter}
          onChange={(event) => setQuarter(event.target.value)}
          options={inputs.reportable_quarters.map((q) => ({
            value: q.quarter,
            label: `${formatFiscalQuarter(q.quarter)}${q.reported ? ' (correct the figures on file)' : ''}`,
          }))}
        />
        {PERIOD_AMOUNTS.map(({ key, label }) => (
          <Input
            key={key}
            label={`${label} (NPR)`}
            inputMode="decimal"
            value={form[key]}
            onChange={(event) => set(key, event.target.value)}
            error={invalid.includes(key) ? 'Enter an amount, with at most two decimals' : undefined}
          />
        ))}
        <Input
          label="Source of the figures"
          className="sm:col-span-2"
          placeholder="Audited accounts FY 2082/83, management accounts, valuation report"
          value={source}
          onChange={(event) => setSource(event.target.value)}
        />
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={isAudited} onChange={(event) => setAudited((c) => ({ ...c, [quarter]: event.target.checked }))} />
          These figures are audited
        </label>
        <p className="text-xs text-muted sm:col-span-2">
          Leave a field blank if it is not reported. A project that is not yet operating reports only the value of security.
        </p>
      </div>
    </JustificationModal>
  );
}

function TermsForm({ inputs, projectId, projectName, onClose, onSubmitted }: ModalProps & { inputs: CovenantInputs }) {
  const propose = useProposeCovenantInput('COVENANT_TERMS', projectId);
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(TERM_FIELDS.map(({ key }) => [key, String(Number(inputs.terms[key]))])),
  );
  const [source, setSource] = useState(inputs.terms.source_reference ?? '');

  const invalid = TERM_FIELDS.filter(({ key }) => !(Number(form[key]) > 0)).map(({ key }) => key);
  const ltvTooHigh = Number(form.ltv_max) > 100;
  const changed = TERM_FIELDS.some(({ key }) => Number(form[key]) !== Number(inputs.terms[key]))
    || source.trim() !== (inputs.terms.source_reference ?? '');
  const complete = invalid.length === 0 && !ltvTooHigh && changed && source.trim().length >= 3;

  return (
    <JustificationModal
      isOpen
      onClose={onClose}
      entityType="Sanction terms"
      entityId={projectId}
      actionName={`changing the covenant terms of ${projectName}`}
      isLoading={propose.isPending}
      canSubmit={complete}
      allowDocument={false}
      onSubmit={async ({ reason }) => {
        try {
          await propose.mutateAsync({
            changes: { ...Object.fromEntries(TERM_FIELDS.map(({ key }) => [key, form[key].trim()])), source_reference: source.trim() },
            justification: reason,
          });
        } catch (error) {
          throw new Error(getErrorMessage(error), { cause: error });
        }
        onSubmitted('Sanction terms sent for approval. A different administrator gives the final approval.');
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <p className="text-xs text-muted sm:col-span-2">
          Currently tested against {inputs.terms.source}. Past quarters are re-tested against the new terms once approved.
        </p>
        {TERM_FIELDS.map(({ key, label, unit }) => (
          <Input
            key={key}
            label={`${label} (${unit})`}
            inputMode="decimal"
            value={form[key]}
            onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
            error={
              invalid.includes(key) ? 'Must be greater than zero'
                : key === 'ltv_max' && ltvTooHigh ? 'A percentage cannot exceed 100'
                  : undefined
            }
          />
        ))}
        <Input
          label="Sanction letter or agreement reference"
          className="sm:col-span-2"
          value={source}
          onChange={(event) => setSource(event.target.value)}
        />
      </div>
    </JustificationModal>
  );
}

function Loader({ kind, ...props }: ModalProps & { kind: 'figures' | 'terms' }) {
  const inputs = useCovenantInputs(props.projectId);
  if (!inputs.data) {
    // Nothing to propose against until the current inputs are known
    return (
      <BaseModal isOpen onClose={props.onClose} title={kind === 'figures' ? 'Covenant figures' : 'Sanction terms'}>
        {inputs.isError ? (
          <ErrorState error={inputs.error} onRetry={() => void inputs.refetch()} />
        ) : (
          <Skeleton className="h-40 w-full" />
        )}
      </BaseModal>
    );
  }
  return kind === 'figures' ? <FiguresForm inputs={inputs.data} {...props} /> : <TermsForm inputs={inputs.data} {...props} />;
}

/** Propose a fiscal quarter's reported figures. Nothing changes until two checkers approve. */
export function ProposeFiguresModal(props: ModalProps) {
  return <Loader kind="figures" {...props} />;
}

/** Propose a project's covenant thresholds. Admin only; a different admin gives the final approval. */
export function ProposeTermsModal(props: ModalProps) {
  return <Loader kind="terms" {...props} />;
}
