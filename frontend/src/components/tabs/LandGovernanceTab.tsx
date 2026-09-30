import { Card, CardHeader, CardBody } from '@/components/common/Card';
import { Spinner } from '@/components/common/Spinner';
import { useState, useEffect } from 'react';

interface LandGovernanceData {
  land_required_ropani: number;
  land_acquired_ropani: number;
  acquisition_pct: number;
  compensation_paid_npr: number;
  compensation_outstanding_npr: number;
}

export function LandGovernanceTab({ projectId }: { projectId: string }) {
  const [data, setData] = useState<LandGovernanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data
    setData({
      land_required_ropani: 2500,
      land_acquired_ropani: 2350,
      acquisition_pct: 94,
      compensation_paid_npr: 45000000,
      compensation_outstanding_npr: 3500000,
    });
    setLoading(false);
  }, [projectId]);

  if (loading) return <Spinner className="size-8" />;
  if (!data) return <div>No data</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Land Acquisition Status" />
        <CardBody>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg bg-surface-2 p-3">
              <p className="text-muted text-xs">Required</p>
              <p className="mt-2 font-semibold">{data.land_required_ropani} ropani</p>
            </div>
            <div className="rounded-lg bg-surface-2 p-3">
              <p className="text-muted text-xs">Acquired ({data.acquisition_pct}%)</p>
              <p className="mt-2 font-semibold">{data.land_acquired_ropani} ropani</p>
            </div>
            <div className="rounded-lg bg-success/10 p-3">
              <p className="text-muted text-xs">Compensation Paid</p>
              <p className="mt-2 font-semibold text-success">
                {(data.compensation_paid_npr / 1000000).toFixed(1)}M NPR
              </p>
            </div>
            <div className="rounded-lg bg-warning/10 p-3">
              <p className="text-muted text-xs">Outstanding</p>
              <p className="mt-2 font-semibold text-warning">
                {(data.compensation_outstanding_npr / 1000000).toFixed(1)}M NPR
              </p>
            </div>
          </div>
          <div className="mt-4 h-2 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full bg-success"
              style={{ width: `${data.acquisition_pct}%` }}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Board of Directors" />
        <CardBody>
          <div className="text-sm text-muted">
            [BOD list placeholder - to be implemented]
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Shareholding Hierarchy" />
        <CardBody>
          <div className="text-sm text-muted">
            [Shareholding breakdown - to be implemented]
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
