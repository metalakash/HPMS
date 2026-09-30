import { AlertCircle, Check, Zap } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Badge } from '@/components/common/Badge';
import { StatCard } from '@/components/common/StatCard';
import { EmptyState } from '@/components/common/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatDate } from '@/utils/format';

interface CovenantAlert {
  id: string;
  project_name: string;
  covenant_type: string;
  status: 'breached' | 'warning' | 'compliant';
  last_checked: string;
}

const mockAlerts: CovenantAlert[] = [
  {
    id: '1',
    project_name: 'Upper Tamakoshi',
    covenant_type: 'Debt Service Coverage Ratio',
    status: 'compliant',
    last_checked: new Date().toISOString(),
  },
  {
    id: '2',
    project_name: 'Khimti Khola',
    covenant_type: 'Leverage Ratio',
    status: 'warning',
    last_checked: new Date().toISOString(),
  },
];

export default function CompliancePage() {
  const columns: Column<CovenantAlert>[] = [
    {
      key: 'project_name',
      header: 'Project',
      render: (item) => item.project_name,
    },
    {
      key: 'covenant_type',
      header: 'Covenant Type',
      render: (item) => item.covenant_type,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => (
        <Badge
          tone={
            item.status === 'compliant' ? 'success' : item.status === 'warning' ? 'warning' : 'error'
          }
        >
          {item.status === 'compliant' ? 'Compliant' : item.status === 'warning' ? 'Warning' : 'Breached'}
        </Badge>
      ),
    },
    {
      key: 'last_checked',
      header: 'Last Checked',
      hideOnMobile: true,
      render: (item) => formatDate(item.last_checked, 'en'),
    },
  ];

  return (
    <>
      <PageHeader
        title="Compliance"
        description="Covenant monitoring, alerts and audit trail"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Covenants Monitored"
          icon={<Check className="size-4" />}
          value="24"
        />
        <StatCard
          label="Active Alerts"
          icon={<AlertCircle className="size-4" />}
          value="3"
          tone="warning"
        />
        <StatCard
          label="Last Sync"
          icon={<Zap className="size-4" />}
          value="2 hours ago"
        />
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader title="Covenant Status" description="Real-time monitoring of all project covenants" />
          {mockAlerts.length === 0 ? (
            <EmptyState title="No alerts" description="All covenants are in compliance." />
          ) : (
            <DataTable
              caption="Covenant alerts"
              columns={columns}
              rows={mockAlerts}
              rowKey={(item) => item.id}
              empty={<EmptyState title="No alerts" />}
            />
          )}
        </Card>
      </div>
    </>
  );
}
