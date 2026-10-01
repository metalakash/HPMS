import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Badge } from '@/components/common/Badge';
import { StatCard } from '@/components/common/StatCard';
import { EmptyState } from '@/components/common/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatDate } from '@/utils/format';

interface MaintenanceTask {
  id: string;
  project_name: string;
  equipment: string;
  task_type: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  due_date: string;
}

const mockTasks: MaintenanceTask[] = [
  {
    id: '1',
    project_name: 'Upper Tamakoshi',
    equipment: 'Turbine Unit 1',
    task_type: 'Annual Inspection',
    status: 'scheduled',
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    project_name: 'Khimti Khola',
    equipment: 'Penstock Valve',
    task_type: 'Preventive Maintenance',
    status: 'in_progress',
    due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    project_name: 'Kaligandaki',
    equipment: 'Generator 2',
    task_type: 'Oil Change',
    status: 'completed',
    due_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export default function MaintenancePage() {
  const scheduled = mockTasks.filter((t) => t.status === 'scheduled').length;
  const inProgress = mockTasks.filter((t) => t.status === 'in_progress').length;
  const completed = mockTasks.filter((t) => t.status === 'completed').length;

  const columns: Column<MaintenanceTask>[] = [
    {
      key: 'project_name',
      header: 'Project',
      render: (item) => item.project_name,
    },
    {
      key: 'equipment',
      header: 'Equipment',
      render: (item) => item.equipment,
    },
    {
      key: 'task_type',
      header: 'Task Type',
      render: (item) => item.task_type,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => (
        <Badge
          tone={
            item.status === 'completed' ? 'success' : item.status === 'in_progress' ? 'info' : 'warning'
          }
        >
          {item.status === 'scheduled'
            ? 'Scheduled'
            : item.status === 'in_progress'
              ? 'In Progress'
              : 'Completed'}
        </Badge>
      ),
    },
    {
      key: 'due_date',
      header: 'Due Date',
      hideOnMobile: true,
      render: (item) => formatDate(item.due_date, 'en'),
    },
  ];

  return (
    <>
      <PageHeader
        title="Maintenance"
        description="Schedules, work orders and equipment history"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Scheduled Tasks"
          icon={<Clock className="size-4" />}
          value={String(scheduled)}
        />
        <StatCard
          label="In Progress"
          icon={<AlertCircle className="size-4" />}
          value={String(inProgress)}
        />
        <StatCard
          label="Completed"
          icon={<CheckCircle className="size-4" />}
          value={String(completed)}
        />
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader title="Work Orders" description="Maintenance tasks and schedules for all equipment" />
          {mockTasks.length === 0 ? (
            <EmptyState title="No tasks" description="Maintenance tasks will appear here." />
          ) : (
            <DataTable
              caption="Maintenance tasks"
              columns={columns}
              rows={mockTasks}
              rowKey={(item) => item.id}
              empty={<EmptyState title="No tasks" />}
            />
          )}
        </Card>
      </div>
    </>
  );
}
