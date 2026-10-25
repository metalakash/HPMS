import { useState } from 'react';
import { BaseModal } from '@/components/modals/BaseModal';
import { JustificationModal } from '@/components/modals/JustificationModal';
import { Input } from '@/components/common/Field';
import { Skeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/States';
import { getErrorMessage } from '@/services/api';
import { carryDown, formatNpr, isAmount, type ProjectionRow, useProjectProjection, useProposeChange } from '@/services/changeRequests';

type Edits = Record<string, { disbursement: string; repayment: string }>;
const key = (row: ProjectionRow) => `${row.fiscal_year}-${row.quarter}`;

/**
 * Propose planned disbursement and repayment by fiscal quarter for one borrower (RFP FUNC B.6). Outstanding is
 * worked out down the plan as the figures are typed, the same way the server does on approval.
 */
export function ProjectionPlanModal({ projectId, projectName, onClose, onSubmitted }: {
  projectId: string; projectName: string; onClose: () => void; onSubmitted: (message: string) => void;
}) {
  const projection = useProjectProjection(projectId);
  const propose = useProposeChange('LOAN_PROJECTION');
  const [edits, setEdits] = useState<Edits>({});
  const [source, setSource] = useState('');

  if (!projection.data) {
    return (
      <BaseModal isOpen onClose={onClose} title={`Loan projection: ${projectName}`}>
        {projection.isError ? <ErrorState error={projection.error} onRetry={() => void projection.refetch()} /> : <Skeleton className="h-40 w-full" />}
      </BaseModal>
    );
  }
  const rows = projection.data;
  const outstanding = carryDown(rows, edits);
  const value = (row: ProjectionRow, field: 'disbursement' | 'repayment') =>
    edits[key(row)]?.[field] ?? String(Number(field === 'disbursement' ? row.projected_disbursement : row.projected_repayment));
  const set = (row: ProjectionRow, field: 'disbursement' | 'repayment', text: string) =>
    setEdits((current) => ({ ...current, [key(row)]: { disbursement: value(row, 'disbursement'), repayment: value(row, 'repayment'), [field]: text } }));
  const changed = rows.filter((row) => {
    const edit = edits[key(row)];
    return edit && (Number(edit.disbursement) !== Number(row.projected_disbursement) || Number(edit.repayment) !== Number(row.projected_repayment));
  });
  const invalid = Object.values(edits).some((e) => !isAmount(e.disbursement || '0') || !isAmount(e.repayment || '0'));
  const negative = outstanding.findIndex((o) => o < 0);
  const problem = invalid ? 'Amounts are zero or more, with at most two decimals'
    : negative >= 0 ? `Repayments exceed the balance by FY ${rows[negative].fiscal_year} Q${rows[negative].quarter}` : null;

  return (
    <JustificationModal
      isOpen
      onClose={onClose}
      entityType="Loan projection"
      entityId={projectId}
      actionName={`changing the loan projection of ${projectName}`}
      isLoading={propose.isPending}
      canSubmit={!problem && changed.length > 0 && source.trim().length >= 3}
      allowDocument={false}
      onSubmit={async ({ reason }) => {
        try {
          await propose.mutateAsync({
            entityId: projectId,
            justification: reason,
            changes: {
              source_reference: source.trim(),
              quarters: changed.map((row) => ({
                fiscal_year: row.fiscal_year, quarter: row.quarter,
                projected_disbursement: value(row, 'disbursement') || '0', projected_repayment: value(row, 'repayment') || '0',
              })),
            },
          });
        } catch (error) {
          throw new Error(getErrorMessage(error), { cause: error });
        }
        onSubmitted(`Projection for ${projectName} sent for approval (${changed.length} ${changed.length === 1 ? 'quarter' : 'quarters'}).`);
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <caption className="sr-only">Planned figures by quarter</caption>
          <thead>
            <tr className="text-left text-xs uppercase text-muted">
              <th className="py-1 pr-2">Quarter</th>
              <th className="py-1 pr-2">Disbursement (NPR)</th>
              <th className="py-1 pr-2">Repayment (NPR)</th>
              <th className="py-1 text-right">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={key(row)} className="border-t border-line">
                <td className="py-1 pr-2 whitespace-nowrap">FY {row.fiscal_year} Q{row.quarter}{row.is_opening && <span className="block text-xs text-muted">Opening position</span>}</td>
                {row.is_opening ? (
                  <td colSpan={2} className="py-1 pr-2 text-muted">On record; not changed here</td>
                ) : (
                  <>
                    <td className="py-1 pr-2"><Input label={`Disbursement FY ${row.fiscal_year} Q${row.quarter}`} hideLabel inputMode="decimal" value={value(row, 'disbursement')} onChange={(e) => set(row, 'disbursement', e.target.value)} /></td>
                    <td className="py-1 pr-2"><Input label={`Repayment FY ${row.fiscal_year} Q${row.quarter}`} hideLabel inputMode="decimal" value={value(row, 'repayment')} onChange={(e) => set(row, 'repayment', e.target.value)} /></td>
                  </>
                )}
                <td className={`py-1 text-right tabular-nums ${outstanding[index] < 0 ? 'text-danger' : ''}`}>{formatNpr(outstanding[index])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3">
        <Input label="Source of the figures" placeholder="Developer's revised drawdown plan" value={source} onChange={(e) => setSource(e.target.value)} />
      </div>
      {problem && <p className="mt-2 text-sm text-danger">{problem}</p>}
    </JustificationModal>
  );
}
