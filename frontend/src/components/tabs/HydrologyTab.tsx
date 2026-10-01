import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardBody } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Spinner } from '@/components/common/Spinner';
import { EmptyState } from '@/components/common/States';

interface HydrologyData {
  river_basin: string;
  design_discharge_m3s: number; // Q90
  median_flow_m3s: number; // Q50
  catchment_area_sqkm: number;
  water_license_valid_from_ad: string;
  water_license_valid_to_ad: string;
  water_license_status: 'valid' | 'expiring' | 'expired';
}

export function HydrologyTab({ projectId }: { projectId: string }) {
  const [data, setData] = useState<HydrologyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data for now
    setData({
      river_basin: 'Koshi',
      design_discharge_m3s: 45.5,
      median_flow_m3s: 52.3,
      catchment_area_sqkm: 2850,
      water_license_valid_from_ad: '2020-06-15',
      water_license_valid_to_ad: '2030-06-14',
      water_license_status: 'valid',
    });
    setLoading(false);
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!data) {
    return <EmptyState title="No hydrology data" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="River Basin Characteristics" />
        <CardBody>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 text-sm">
            <div className="rounded-lg bg-surface-2 p-3">
              <p className="text-muted text-xs">River Basin</p>
              <p className="mt-2 font-semibold text-fg">{data.river_basin}</p>
            </div>
            <div className="rounded-lg bg-surface-2 p-3">
              <p className="text-muted text-xs">Design Discharge (Q90)</p>
              <p className="mt-2 font-semibold text-fg">{data.design_discharge_m3s} m³/s</p>
            </div>
            <div className="rounded-lg bg-surface-2 p-3">
              <p className="text-muted text-xs">Median Flow (Q50)</p>
              <p className="mt-2 font-semibold text-fg">{data.median_flow_m3s} m³/s</p>
            </div>
            <div className="rounded-lg bg-surface-2 p-3 sm:col-span-3">
              <p className="text-muted text-xs">Catchment Area</p>
              <p className="mt-2 font-semibold text-fg">{data.catchment_area_sqkm} km²</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Water License" />
        <CardBody>
          <div className="space-y-3 text-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted">DoED Water Use Permit</p>
                <p className="mt-1 text-fg">Valid from {data.water_license_valid_from_ad} to {data.water_license_valid_to_ad}</p>
              </div>
              <Badge
                tone={data.water_license_status === 'valid' ? 'success' : 'warning'}
              >
                {data.water_license_status}
              </Badge>
            </div>
            {data.water_license_status !== 'valid' && (
              <div className="flex gap-2 rounded-lg bg-warning/10 p-3 text-warning">
                <AlertCircle className="size-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs">Water license renewal may be required soon</p>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Flow Duration Curve" />
        <CardBody>
          <div className="h-48 rounded-lg border border-line flex items-center justify-center bg-surface-2">
            <p className="text-muted text-sm">[Flow duration curve chart - to be implemented]</p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
