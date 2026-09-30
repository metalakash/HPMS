import { useState, useEffect } from 'react';
import { AlertCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { DetailDrawer } from './DetailDrawer';
import { Badge } from '@/components/common/Badge';
import { Spinner } from '@/components/common/Spinner';

interface CovenantTrend {
  period: string; // "Q1 2026", "Q2 2026", etc.
  value: number;
  threshold: number;
  status: 'compliant' | 'warning' | 'breached';
}

interface CovenantDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  covenantType: 'DSCR' | 'LTV' | 'ICR';
  currentValue: number;
  threshold: number;
}

/**
 * CovenantDetailDrawer: Shows 8-quarter covenant trend with historical data.
 * Displays DSCR/LTV/ICR metrics with breach highlights and trend analysis.
 */
export function CovenantDetailDrawer({
  isOpen,
  onClose,
  projectId,
  projectName,
  covenantType,
  currentValue,
  threshold,
}: CovenantDetailDrawerProps) {
  const [trends, setTrends] = useState<CovenantTrend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Fetch covenant history on open
  useEffect(() => {
    if (!isOpen) return;

    const fetchTrends = async () => {
      setLoading(true);
      setError('');

      try {
        // TODO: Replace with real API call to GET /api/v1/compliance/covenants/:project_id/history
        // For now, use mock data
        const mockData: CovenantTrend[] = [
          { period: 'Q1 2025', value: 1.45, threshold, status: 'compliant' },
          { period: 'Q2 2025', value: 1.38, threshold, status: 'compliant' },
          { period: 'Q3 2025', value: 1.28, threshold, status: 'warning' },
          { period: 'Q4 2025', value: 1.22, threshold, status: 'warning' },
          { period: 'Q1 2026', value: 1.18, threshold, status: 'warning' },
          { period: 'Q2 2026', value: 1.15, threshold, status: 'warning' },
          { period: 'Q3 2026', value: 1.12, threshold, status: 'breached' },
          { period: 'Q4 2026', value: currentValue, threshold, status: currentValue >= threshold ? 'compliant' : 'breached' },
        ];
        setTrends(mockData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load trends');
      } finally {
        setLoading(false);
      }
    };

    fetchTrends();
  }, [isOpen, projectId, covenantType, threshold]);

  const getCovenantLabel = () => {
    const labels = {
      DSCR: 'Debt Service Coverage Ratio',
      LTV: 'Loan-to-Value Ratio',
      ICR: 'Interest Coverage Ratio',
    };
    return labels[covenantType];
  };

  const getCovenantDescription = () => {
    const descriptions = {
      DSCR: 'CFADS / (Principal + Interest). Sanctioned minimum: 1.20x',
      LTV: 'Outstanding Loan / Collateral Value. Sanctioned maximum: 75%',
      ICR: 'Operating Cash Flow / Interest Expense. Sanctioned minimum: 2.0x',
    };
    return descriptions[covenantType];
  };

  const currentStatus = currentValue >= threshold ? 'compliant' : 'breached';
  const trend = trends.length >= 2
    ? trends[trends.length - 1].value - trends[trends.length - 2].value
    : 0;

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={`${covenantType} Covenant Details`}
      loading={loading}
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
            {error}
          </div>
        )}

        {/* Current Status Summary */}
        <div className="rounded-lg bg-surface-2 p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">
                {getCovenantLabel()}
              </p>
              <p className="mt-1 text-3xl font-bold text-fg">{currentValue.toFixed(2)}x</p>
              <p className="mt-1 text-xs text-muted">{getCovenantDescription()}</p>
            </div>
            <Badge
              tone={currentStatus === 'compliant' ? 'success' : 'error'}
              className="capitalize"
            >
              {currentStatus}
            </Badge>
          </div>

          {/* Threshold Info */}
          <div className="border-t border-line pt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Threshold:</span>
              <span className="font-semibold text-fg">{threshold.toFixed(2)}x</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-surface overflow-hidden">
              <div
                className={`h-full transition-all ${
                  currentValue >= threshold ? 'bg-success' : 'bg-danger'
                }`}
                style={{ width: `${Math.min((currentValue / threshold) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Trend */}
          {trend !== 0 && (
            <div className="flex items-center gap-2 text-sm">
              {trend > 0 ? (
                <>
                  <TrendingUp className="size-4 text-success" />
                  <span className="text-success">Improving (+{trend.toFixed(3)})</span>
                </>
              ) : (
                <>
                  <TrendingDown className="size-4 text-danger" />
                  <span className="text-danger">Declining ({trend.toFixed(3)})</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* 8-Quarter History */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-fg">Historical Trend (8 Quarters)</h3>

          {!loading && trends.length > 0 && (
            <div className="space-y-2">
              {trends.map((trend) => {
                const percentOfThreshold = (trend.value / trend.threshold) * 100;
                const isBreach = trend.value < trend.threshold;

                return (
                  <div key={trend.period} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted min-w-20">{trend.period}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-fg w-12 text-right">
                          {trend.value.toFixed(2)}x
                        </span>
                        <Badge
                          tone={
                            trend.status === 'compliant'
                              ? 'success'
                              : trend.status === 'warning'
                                ? 'warning'
                                : 'error'
                          }
                          className="capitalize text-xs"
                        >
                          {trend.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="h-6 rounded bg-surface overflow-hidden">
                      <div
                        className={`h-full flex items-center px-2 text-xs font-medium text-white transition-all ${
                          isBreach
                            ? 'bg-danger'
                            : percentOfThreshold >= 110
                              ? 'bg-success'
                              : percentOfThreshold >= 100
                                ? 'bg-success'
                                : 'bg-warning'
                        }`}
                        style={{ width: `${percentOfThreshold}%` }}
                      >
                        {percentOfThreshold > 20 && `${percentOfThreshold.toFixed(0)}%`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Calculation Formula */}
        <div className="rounded-lg bg-info/10 p-3 space-y-2">
          <p className="text-xs font-semibold text-info">Calculation Formula:</p>
          {covenantType === 'DSCR' && (
            <p className="text-xs text-fg font-mono">
              DSCR = CFADS / (Principal + Interest)
            </p>
          )}
          {covenantType === 'LTV' && (
            <p className="text-xs text-fg font-mono">
              LTV = Outstanding Loan / Collateral Value
            </p>
          )}
          {covenantType === 'ICR' && (
            <p className="text-xs text-fg font-mono">
              ICR = Operating Cash Flow / Interest Expense
            </p>
          )}
        </div>

        {/* Breach Warning */}
        {currentStatus === 'breached' && (
          <div className="rounded-lg bg-danger/10 p-3 flex gap-3 text-sm text-danger">
            <AlertCircle className="size-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Covenant Breach Detected</p>
              <p className="mt-1 text-xs">
                This covenant is currently in breach. Immediate action is required.
                Consider initiating a waiver request or remediation plan.
              </p>
            </div>
          </div>
        )}
      </div>
    </DetailDrawer>
  );
}
