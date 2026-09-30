/**
 * GenerationPPATab: Monthly wet/dry generation data with NEA tariff rates and revenue calculations.
 * Displays seasonal tariff structure, generation performance, and revenue trends.
 */

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardBody } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Badge } from '@/components/common/Badge';
import { Spinner } from '@/components/common/Spinner';
import { EmptyState } from '@/components/common/States';
import { apiClient } from '@/services/api';
import { formatDate, formatNPR, formatPercent } from '@/utils/format';

interface GenerationRecord {
  month_ad: string;
  month_bs: string;
  season: 'wet' | 'dry';
  contract_energy_mwh: number;
  actual_energy_mwh: number;
  availability_pct: number;
  curtailment_mwh: number;
  revenue_npr: number;
  variance_pct: number;
}

interface PpaAgreement {
  id: string;
  agreement_number: string;
  purchaser: string;
  effective_date_ad: string;
  expiry_date_ad: string;
  tariff_type: 'ROR' | 'PROR' | 'Hybrid';
  escalation_pct_annual: number;
  status: 'active' | 'expired' | 'renewed';
}

interface GenerationPPATabProps {
  projectId: string;
  projectName: string;
}

/**
 * GenerationPPATab Component
 */
export function GenerationPPATab({ projectId, projectName }: GenerationPPATabProps) {
  const [ppaAgreement, setPpaAgreement] = useState<PpaAgreement | null>(null);
  const [generationData, setGenerationData] = useState<GenerationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');

        // TODO: Replace with real API calls
        // const ppaResponse = await apiClient.get(`/projects/${projectId}/ppa`);
        // const genResponse = await apiClient.get(`/projects/${projectId}/generation-ppa`);

        // Mock data for now
        const mockPPA: PpaAgreement = {
          id: 'ppa-001',
          agreement_number: 'NEA-2024-001',
          purchaser: 'Nepal Electricity Authority',
          effective_date_ad: '2024-06-01',
          expiry_date_ad: '2054-06-01',
          tariff_type: 'ROR',
          escalation_pct_annual: 3.0,
          status: 'active',
        };

        const mockGeneration: GenerationRecord[] = [
          {
            month_ad: '2026-08-01',
            month_bs: '2083-04-15',
            season: 'wet',
            contract_energy_mwh: 50000,
            actual_energy_mwh: 48500,
            availability_pct: 97,
            curtailment_mwh: 1500,
            revenue_npr: 232800000,
            variance_pct: -3.0,
          },
          {
            month_ad: '2026-09-01',
            month_bs: '2083-05-15',
            season: 'wet',
            contract_energy_mwh: 50000,
            actual_energy_mwh: 49200,
            availability_pct: 98,
            curtailment_mwh: 800,
            revenue_npr: 236160000,
            variance_pct: -1.6,
          },
          {
            month_ad: '2026-10-01',
            month_bs: '2083-06-15',
            season: 'dry',
            contract_energy_mwh: 30000,
            actual_energy_mwh: 31200,
            availability_pct: 104,
            curtailment_mwh: 0,
            revenue_npr: 262080000,
            variance_pct: 4.0,
          },
        ];

        setPpaAgreement(mockPPA);
        setGenerationData(mockGeneration);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load generation data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  const columns: Column<GenerationRecord>[] = [
    {
      key: 'month_ad',
      header: 'Month (AD)',
      render: (r) => formatDate(r.month_ad, 'en'),
    },
    {
      key: 'season',
      header: 'Season',
      render: (r) => (
        <Badge tone={r.season === 'wet' ? 'info' : 'warning'} className="capitalize">
          {r.season}
        </Badge>
      ),
    },
    {
      key: 'contract_energy',
      header: 'Contract (MWh)',
      align: 'right',
      render: (r) => r.contract_energy_mwh.toLocaleString(),
    },
    {
      key: 'actual_energy',
      header: 'Actual (MWh)',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          {r.actual_energy_mwh.toLocaleString()}
          {r.variance_pct > 0 ? (
            <TrendingUp className="size-4 text-success" />
          ) : (
            <TrendingDown className="size-4 text-warning" />
          )}
        </div>
      ),
    },
    {
      key: 'variance',
      header: 'Variance',
      align: 'right',
      render: (r) => (
        <span className={r.variance_pct > 0 ? 'text-success font-semibold' : 'text-warning font-semibold'}>
          {r.variance_pct > 0 ? '+' : ''}{r.variance_pct.toFixed(1)}%
        </span>
      ),
    },
    {
      key: 'revenue',
      header: 'Revenue (NPR)',
      align: 'right',
      hideOnMobile: true,
      render: (r) => formatNPR(r.revenue_npr.toString(), 'en'),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-danger/10 p-4 text-sm text-danger">
        {error}
      </div>
    );
  }

  const totalRevenue = generationData.reduce((sum, r) => sum + r.revenue_npr, 0);
  const avgAvailability = (generationData.reduce((sum, r) => sum + r.availability_pct, 0) / generationData.length);
  const totalCurtailment = generationData.reduce((sum, r) => sum + r.curtailment_mwh, 0);

  return (
    <div className="space-y-6">
      {/* PPA Agreement Info */}
      {ppaAgreement && (
        <Card>
          <CardHeader title="Power Purchase Agreement" />
          <CardBody>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
              <div>
                <p className="text-muted">Agreement #</p>
                <p className="mt-1 font-mono text-fg">{ppaAgreement.agreement_number}</p>
              </div>
              <div>
                <p className="text-muted">Purchaser</p>
                <p className="mt-1 font-medium text-fg">{ppaAgreement.purchaser}</p>
              </div>
              <div>
                <p className="text-muted">Tariff Type</p>
                <p className="mt-1 font-medium text-fg">{ppaAgreement.tariff_type}</p>
              </div>
              <div>
                <p className="text-muted">Duration</p>
                <p className="mt-1 text-fg">
                  {new Date(ppaAgreement.effective_date_ad).getFullYear()} - {new Date(ppaAgreement.expiry_date_ad).getFullYear()}
                </p>
              </div>
              <div>
                <p className="text-muted">Annual Escalation</p>
                <p className="mt-1 font-semibold text-fg">{ppaAgreement.escalation_pct_annual}%</p>
              </div>
              <div>
                <p className="text-muted">Status</p>
                <p className="mt-1">
                  <Badge
                    tone={ppaAgreement.status === 'active' ? 'success' : 'warning'}
                    className="capitalize"
                  >
                    {ppaAgreement.status}
                  </Badge>
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Performance Summary */}
      <Card>
        <CardHeader title="Generation Performance" />
        <CardBody>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
            <div className="rounded-lg bg-surface-2 p-3">
              <p className="text-muted text-xs uppercase tracking-wide">Total Revenue</p>
              <p className="mt-2 text-lg font-bold text-fg">
                {(totalRevenue / 1000000000).toFixed(2)}B
              </p>
              <p className="mt-1 text-xs text-muted">NPR</p>
            </div>
            <div className="rounded-lg bg-surface-2 p-3">
              <p className="text-muted text-xs uppercase tracking-wide">Avg Availability</p>
              <p className="mt-2 text-lg font-bold text-fg">{avgAvailability.toFixed(1)}%</p>
              <p className="mt-1 text-xs text-muted">Plant uptime</p>
            </div>
            <div className="rounded-lg bg-surface-2 p-3">
              <p className="text-muted text-xs uppercase tracking-wide">Curtailment</p>
              <p className="mt-2 text-lg font-bold text-danger">{totalCurtailment.toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted">MWh lost</p>
            </div>
            <div className="rounded-lg bg-surface-2 p-3">
              <p className="text-muted text-xs uppercase tracking-wide">Data Points</p>
              <p className="mt-2 text-lg font-bold text-fg">{generationData.length}</p>
              <p className="mt-1 text-xs text-muted">Months</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* NEA Tariff Structure Info */}
      <Card>
        <CardHeader title="NEA Tariff Structure" />
        <CardBody>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg bg-info/10 p-3">
              <p className="font-medium text-info">Wet Season (Jestha 16 - Mangsir 15)</p>
              <p className="mt-1 text-fg">
                ROR: NPR 4.80/kWh | PROR: NPR 5.50/kWh
              </p>
            </div>
            <div className="rounded-lg bg-warning/10 p-3">
              <p className="font-medium text-warning">Dry Season (Mangsir 16 - Jestha 15)</p>
              <p className="mt-1 text-fg">
                ROR: NPR 8.40/kWh | PROR: NPR 10.55/kWh (4-6 hrs peaking)
              </p>
            </div>
            <div className="rounded-lg bg-primary/10 p-3">
              <p className="font-medium text-primary">Annual Escalation</p>
              <p className="mt-1 text-fg">
                {ppaAgreement?.escalation_pct_annual || 3}% per year (per NEA PPA terms)
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Generation Data Table */}
      <Card>
        <CardHeader title="Monthly Generation Data" />
        {generationData.length === 0 ? (
          <EmptyState title="No generation data" description="No monthly generation records found." />
        ) : (
          <div className="overflow-x-auto">
            <DataTable
              caption="Monthly generation performance by season"
              columns={columns}
              rows={generationData}
              rowKey={(r) => r.month_ad}
              empty={<EmptyState title="No data" />}
            />
          </div>
        )}
      </Card>

      {/* Variance Alerts */}
      {generationData.some((r) => Math.abs(r.variance_pct) > 10) && (
        <Card>
          <CardHeader title="Variance Alerts" />
          <CardBody>
            <div className="space-y-2">
              {generationData
                .filter((r) => Math.abs(r.variance_pct) > 10)
                .map((r) => (
                  <div
                    key={r.month_ad}
                    className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm text-warning"
                  >
                    <AlertCircle className="size-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">
                        {Math.abs(r.variance_pct) > 0 ? 'Higher' : 'Lower'} generation in {formatDate(r.month_ad, 'en')}
                      </p>
                      <p className="text-xs mt-1">
                        Actual: {r.actual_energy_mwh} MWh vs Contract: {r.contract_energy_mwh} MWh ({r.variance_pct > 0 ? '+' : ''}{r.variance_pct}%)
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Revenue Calculation Formula */}
      <Card>
        <CardHeader title="Revenue Calculation" />
        <CardBody>
          <p className="text-sm text-muted mb-3">
            Monthly revenue is calculated based on generation and season-specific tariff rates:
          </p>
          <div className="rounded-lg bg-surface-2 p-3 font-mono text-xs space-y-2">
            <p>Revenue = (Dry Energy × Dry Tariff) + (Wet Energy × Wet Tariff)</p>
            <p className="text-muted">+ Annual escalation: 3% compounded yearly</p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
