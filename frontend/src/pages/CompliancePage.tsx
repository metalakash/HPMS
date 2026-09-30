import { useState } from 'react';
import { AlertCircle, Check, Zap } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Badge } from '@/components/common/Badge';
import { StatCard } from '@/components/common/StatCard';
import { EmptyState } from '@/components/common/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { CovenantDetailDrawer, AlertRemediationDrawer } from '@/components/drawers';
import { formatDate } from '@/utils/format';

interface CovenantAlert {
  id: string;
  projectId: string;
  project_name: string;
  covenant_type: 'DSCR' | 'LTV' | 'ICR';
  current_value: number;
  threshold: number;
  status: 'breached' | 'warning' | 'compliant';
  last_checked: string;
}

const mockAlerts: CovenantAlert[] = [
  {
    id: '1',
    projectId: 'proj-001',
    project_name: 'Upper Tamakoshi',
    covenant_type: 'DSCR',
    current_value: 1.45,
    threshold: 1.20,
    status: 'compliant',
    last_checked: new Date().toISOString(),
  },
  {
    id: '2',
    projectId: 'proj-002',
    project_name: 'Khimti Khola',
    covenant_type: 'LTV',
    current_value: 0.78,
    threshold: 0.75,
    status: 'warning',
    last_checked: new Date().toISOString(),
  },
  {
    id: '3',
    projectId: 'proj-003',
    project_name: 'Kali Gandaki A',
    covenant_type: 'ICR',
    current_value: 1.85,
    threshold: 2.0,
    status: 'breached',
    last_checked: new Date().toISOString(),
  },
];

export default function CompliancePage() {
  const [selectedCovenant, setSelectedCovenant] = useState<CovenantAlert | null>(null);
  const [selectedAlerts, setSelectedAlerts] = useState<CovenantAlert | null>(null);
  const columns: Column<CovenantAlert>[] = [
    {
      key: 'project_name',
      header: 'Project',
      render: (item) => (
        <button
          onClick={() => setSelectedCovenant(item)}
          className="text-primary hover:underline font-medium"
        >
          {item.project_name}
        </button>
      ),
    },
    {
      key: 'covenant_type',
      header: 'Covenant Type',
      render: (item) => item.covenant_type,
    },
    {
      key: 'current_value',
      header: 'Current Value',
      render: (item) => (
        <span className="font-semibold">
          {item.current_value.toFixed(2)}{item.covenant_type === 'LTV' ? '%' : 'x'}
        </span>
      ),
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
    {
      key: 'alerts',
      header: 'Alerts',
      hideOnMobile: true,
      render: (item) => (
        <button
          onClick={() => setSelectedAlerts(item)}
          className="text-info hover:underline text-sm font-medium"
        >
          View →
        </button>
      ),
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
          <CardHeader
            title="Covenant Status"
            description="Click on a project to view covenant trends. Click 'View' to see renewal alerts."
          />
          {mockAlerts.length === 0 ? (
            <EmptyState title="No alerts" description="All covenants are in compliance." />
          ) : (
            <DataTable
              caption="Covenant alerts - click rows to drill down"
              columns={columns}
              rows={mockAlerts}
              rowKey={(item) => item.id}
              empty={<EmptyState title="No alerts" />}
            />
          )}
        </Card>
      </div>

      {/* Covenant Detail Drawer */}
      {selectedCovenant && (
        <CovenantDetailDrawer
          isOpen={!!selectedCovenant}
          onClose={() => setSelectedCovenant(null)}
          projectId={selectedCovenant.projectId}
          projectName={selectedCovenant.project_name}
          covenantType={selectedCovenant.covenant_type}
          currentValue={selectedCovenant.current_value}
          threshold={selectedCovenant.threshold}
        />
      )}

      {/* Alert Remediation Drawer */}
      {selectedAlerts && (
        <AlertRemediationDrawer
          isOpen={!!selectedAlerts}
          onClose={() => setSelectedAlerts(null)}
          projectId={selectedAlerts.projectId}
          projectName={selectedAlerts.project_name}
          onInitiateRenewal={(alertId, alertType) => {
            console.log('Initiating renewal for', alertId, alertType);
            // TODO: Call API to create workflow task
          }}
          onEscalateToLegal={(alertId, alertType) => {
            console.log('Escalating to legal for', alertId, alertType);
            // TODO: Call API to escalate to legal team
          }}
        />
      )}
    </>
  );
}
