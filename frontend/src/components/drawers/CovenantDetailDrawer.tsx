import { Badge, type BadgeTone } from '@/components/common/Badge';
import { Skeleton } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/States';
import { useCovenantCalculation, useCovenantHistory } from '@/hooks/queries';
import type { CovenantCalculation, CovenantMetric, CovenantStatus } from '@/types/api';
import { formatDate, formatNPR, toNumber } from '@/utils/format';
import { DetailDrawer } from './DetailDrawer';

const STATUS_LABEL: Record<CovenantStatus, string> = {
  compliant: 'Compliant',
  warning: 'Warning',
  breached: 'Breached',
  not_tested: 'Not tested',
};
const STATUS_TONE: Record<CovenantStatus, BadgeTone> = {
  compliant: 'success',
  warning: 'warning',
  breached: 'danger',
  not_tested: 'neutral',
};

export function CovenantStatusBadge({ status }: { status: CovenantStatus | null | undefined }) {
  const known = status ?? 'not_tested';
  return <Badge tone={STATUS_TONE[known]}>{STATUS_LABEL[known]}</Badge>;
}

const RATIOS = [
  { key: 'dscr', label: 'DSCR', name: 'Debt service coverage', unit: 'x', limit: 'minimum' },
  { key: 'icr', label: 'ICR', name: 'Interest coverage', unit: 'x', limit: 'minimum' },
  { key: 'ltv', label: 'LTV', name: 'Loan to value', unit: '%', limit: 'maximum' },
] as const;

export function formatRatio(metric: CovenantMetric, unit: 'x' | '%'): string {
  const value = toNumber(metric.value);
  return value === null ? '—' : `${value.toFixed(2)}${unit}`;
}

function Working({ calculation }: { calculation: CovenantCalculation }) {
  const { inputs, window } = calculation;
  const rows: [string, string][] = [
    ['Revenue', formatNPR(inputs.revenue)],
    ['EBITDA (revenue less operating costs and royalty)', formatNPR(inputs.ebitda)],
    ['Cash available for debt service (EBITDA less tax)', formatNPR(inputs.cfads)],
    ['EBIT (EBITDA less depreciation)', formatNPR(inputs.ebit)],
    ['Principal scheduled', formatNPR(inputs.principal_due)],
    ['Interest scheduled', formatNPR(inputs.interest_due)],
    ['Outstanding principal at the test date', formatNPR(inputs.outstanding_principal)],
    ['Value of security', formatNPR(inputs.security_value)],
  ];
  return (
    <section aria-labelledby="covenant-working">
      <h3 id="covenant-working" className="text-sm font-semibold">
        How {calculation.quarter} was calculated
      </h3>
      <p className="mt-1 text-xs text-muted">
        Twelve months from {formatDate(window.from)} to {formatDate(window.to)}, tested against{' '}
        {calculation.terms_source}.
      </p>
      <dl className="mt-3 divide-y divide-line rounded-md border border-line text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 px-3 py-2">
            <dt className="text-muted">{label}</dt>
            <dd className="whitespace-nowrap font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

interface CovenantDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

/** A project's covenant results: the latest test, the figures behind it, and the quarterly history. */
export function CovenantDetailDrawer({ isOpen, onClose, projectId, projectName }: CovenantDetailDrawerProps) {
  const history = useCovenantHistory(projectId);
  const calculation = useCovenantCalculation(projectId);
  const latest = history.data?.trends.at(-1);

  return (
    <DetailDrawer isOpen={isOpen} onClose={onClose} title={`Covenants: ${projectName}`}>
      {history.isError ? (
        <ErrorState error={history.error} onRetry={() => void history.refetch()} />
      ) : !history.data ? (
        <Skeleton className="h-64 w-full" />
      ) : !latest ? (
        <p className="text-sm text-muted">No covenant tests have been run for this project.</p>
      ) : (
        <div className="space-y-6">
          <section aria-label={`Latest test, ${latest.quarter}`} className="space-y-3">
            {RATIOS.map((ratio) => {
              const metric = calculation.data?.[ratio.key] ?? latest[ratio.key];
              return (
                <div key={ratio.key} className="rounded-lg bg-surface-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted">{ratio.name}</p>
                      <p className="mt-1 text-2xl font-bold">{formatRatio(metric, ratio.unit)}</p>
                    </div>
                    <CovenantStatusBadge status={metric.status} />
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {metric.status === 'not_tested' && metric.note
                      ? metric.note
                      : `Required ${ratio.limit}: ${formatRatio({ ...metric, value: metric.threshold }, ratio.unit)}`}
                  </p>
                </div>
              );
            })}
          </section>

          {calculation.data && <Working calculation={calculation.data} />}

          <section aria-labelledby="covenant-history">
            <h3 id="covenant-history" className="text-sm font-semibold">
              Last {history.data.trends.length} quarters
            </h3>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th scope="col" className="py-2 font-medium">Quarter</th>
                  {RATIOS.map((ratio) => (
                    <th key={ratio.key} scope="col" className="py-2 text-right font-medium">
                      {ratio.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...history.data.trends].reverse().map((trend) => (
                  <tr key={trend.quarter} className="border-b border-line last:border-0">
                    <th scope="row" className="py-2 text-left font-normal">{trend.quarter}</th>
                    {RATIOS.map((ratio) => {
                      const metric = trend[ratio.key];
                      const flagged = metric.status === 'breached' || metric.status === 'warning';
                      return (
                        <td
                          key={ratio.key}
                          className={
                            'py-2 text-right tabular-nums ' +
                            (metric.status === 'breached'
                              ? 'font-semibold text-danger'
                              : metric.status === 'warning'
                                ? 'font-semibold text-warning'
                                : '')
                          }
                        >
                          {formatRatio(metric, ratio.unit)}
                          {flagged && <span className="sr-only"> ({STATUS_LABEL[metric.status!]})</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </DetailDrawer>
  );
}
