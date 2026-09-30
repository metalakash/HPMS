import { Card, CardHeader, CardBody } from '@/components/common/Card';
import { Spinner } from '@/components/common/Spinner';
import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface ESGData {
  carbon_credits_generated: number;
  ghg_emissions_avoided_tonnes_per_year: number;
  local_employment_count: number;
  community_grievance_count: number;
  grievance_resolution_rate_pct: number;
  eia_mitigation_status: { measure: string; completion_pct: number }[];
}

export function ESGTab({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ESGData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setData({
      carbon_credits_generated: 85000,
      ghg_emissions_avoided_tonnes_per_year: 125000,
      local_employment_count: 450,
      community_grievance_count: 8,
      grievance_resolution_rate_pct: 87.5,
      eia_mitigation_status: [
        { measure: 'Afforestation', completion_pct: 80 },
        { measure: 'Fish Ladders', completion_pct: 100 },
        { measure: 'Community Engagement', completion_pct: 75 },
        { measure: 'Biodiversity Monitoring', completion_pct: 90 },
      ],
    });
    setLoading(false);
  }, [projectId]);

  if (loading) return <Spinner className="size-8" />;
  if (!data) return <div>No data</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Environmental Impact" />
        <CardBody>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg bg-success/10 p-3">
              <p className="text-muted text-xs">Annual CO₂ Avoided</p>
              <p className="mt-2 font-semibold text-success">
                {(data.ghg_emissions_avoided_tonnes_per_year / 1000).toFixed(0)}K tonnes
              </p>
            </div>
            <div className="rounded-lg bg-success/10 p-3">
              <p className="text-muted text-xs">Carbon Credits Generated</p>
              <p className="mt-2 font-semibold text-success">{data.carbon_credits_generated.toLocaleString()}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Social Impact" />
        <CardBody>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg bg-info/10 p-3">
              <p className="text-muted text-xs">Local Employment</p>
              <p className="mt-2 font-semibold text-info">{data.local_employment_count}</p>
            </div>
            <div className="rounded-lg bg-info/10 p-3">
              <p className="text-muted text-xs">Grievances Resolved</p>
              <p className="mt-2 font-semibold text-info">{data.grievance_resolution_rate_pct}%</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="EIA Mitigation Measures" />
        <CardBody>
          <div className="space-y-3">
            {data.eia_mitigation_status.map((measure) => (
              <div key={measure.measure}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-fg">{measure.measure}</span>
                  <span className="font-semibold">{measure.completion_pct}%</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-success"
                    style={{ width: `${measure.completion_pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
