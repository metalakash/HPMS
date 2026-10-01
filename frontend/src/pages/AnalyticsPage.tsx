import { TrendingUp, AlertTriangle, Zap } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Badge } from '@/components/common/Badge';
import { StatCard } from '@/components/common/StatCard';
import { EmptyState } from '@/components/common/States';
import { PageHeader } from '@/components/layout/PageHeader';

interface ProjectAnalytics {
  id: string;
  project_name: string;
  generation_forecast: string;
  risk_score: number;
  anomalies: number;
  trend: 'up' | 'down' | 'stable';
}

const mockAnalytics: ProjectAnalytics[] = [
  {
    id: '1',
    project_name: 'Upper Tamakoshi',
    generation_forecast: '45.2 GWh',
    risk_score: 15,
    anomalies: 0,
    trend: 'up',
  },
  {
    id: '2',
    project_name: 'Khimti Khola',
    generation_forecast: '32.8 GWh',
    risk_score: 28,
    anomalies: 2,
    trend: 'down',
  },
  {
    id: '3',
    project_name: 'Kaligandaki',
    generation_forecast: '51.5 GWh',
    risk_score: 8,
    anomalies: 0,
    trend: 'stable',
  },
];

export default function AnalyticsPage() {
  const columns: Column<ProjectAnalytics>[] = [
    {
      key: 'project_name',
      header: 'Project',
      render: (item) => item.project_name,
    },
    {
      key: 'generation_forecast',
      header: 'Generation Forecast',
      align: 'right',
      render: (item) => item.generation_forecast,
    },
    {
      key: 'risk_score',
      header: 'Risk Score',
      align: 'right',
      render: (item) => (
        <Badge tone={item.risk_score > 20 ? 'warning' : 'success'}>{item.risk_score}</Badge>
      ),
    },
    {
      key: 'anomalies',
      header: 'Anomalies',
      align: 'right',
      render: (item) => (item.anomalies > 0 ? <Badge tone="warning">{item.anomalies}</Badge> : <span>—</span>),
    },
    {
      key: 'trend',
      header: 'Trend',
      hideOnMobile: true,
      render: (item) => {
        const trendIcons = {
          up: '↑ Improving',
          down: '↓ Declining',
          stable: '→ Stable',
        };
        return trendIcons[item.trend];
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Generation forecasts, anomalies and risk scores"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Average Risk Score"
          icon={<TrendingUp className="size-4" />}
          value="17"
        />
        <StatCard
          label="Total Anomalies"
          icon={<AlertTriangle className="size-4" />}
          value="2"
        />
        <StatCard
          label="Avg. Generation"
          icon={<Zap className="size-4" />}
          value="43.2 GWh"
        />
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader
            title="Project Performance"
            description="Key metrics and forecasts for all projects"
          />
          {mockAnalytics.length === 0 ? (
            <EmptyState title="No data" description="Analytics will appear as projects report data." />
          ) : (
            <DataTable
              caption="Project analytics"
              columns={columns}
              rows={mockAnalytics}
              rowKey={(item) => item.id}
              empty={<EmptyState title="No data" />}
            />
          )}
        </Card>
      </div>
    </>
  );
}
