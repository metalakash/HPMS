import { Link2, ShieldCheck, Users } from 'lucide-react';
import { Badge } from '@/components/common/Badge';
import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Skeleton } from '@/components/common/Skeleton';
import { StatCard } from '@/components/common/StatCard';
import { EmptyState, ErrorState } from '@/components/common/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuditChain, useCbsStatus, useUsers } from '@/hooks/queries';
import type { UserAccount } from '@/types/api';
import { formatDate, humanize } from '@/utils/format';

const CBS_SOURCES: Record<string, string> = {
  mock: 'Sample data (not connected)',
  stub: 'Disabled',
  file: 'End-of-day extract',
  http: 'Live inquiry',
};

const USER_COLUMNS: Column<UserAccount>[] = [
  {
    key: 'name',
    header: 'User',
    render: (user) => (
      <>
        <span className="font-medium">{user.full_name || user.username}</span>
        <span className="block text-xs text-muted">{user.username}</span>
      </>
    ),
  },
  { key: 'email', header: 'Email', hideOnMobile: true, render: (user) => user.email },
  { key: 'role', header: 'Role', render: (user) => <Badge tone="info">{humanize(user.role)}</Badge> },
  {
    key: 'source',
    header: 'Source',
    hideOnMobile: true,
    render: (user) => (user.directory_synced ? 'Directory' : 'Local'),
  },
  {
    key: 'status',
    header: 'Status',
    render: (user) => <Badge tone={user.is_active ? 'success' : 'neutral'}>{user.is_active ? 'Active' : 'Inactive'}</Badge>,
  },
  { key: 'login', header: 'Last sign-in', hideOnMobile: true, render: (user) => formatDate(user.last_login_at) },
];

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

export default function AdminPage() {
  const users = useUsers();
  const cbs = useCbsStatus();
  const chain = useAuditChain();
  const accounts = users.data ?? [];

  return (
    <>
      <PageHeader title="Admin" description="User accounts, core banking connection and audit log integrity" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="User accounts"
          icon={<Users className="size-4" />}
          value={accounts.length}
          hint={`${accounts.filter((u) => u.is_active).length} active`}
          loading={users.isLoading}
        />
        <StatCard
          label="Core banking source"
          icon={<Link2 className="size-4" />}
          value={cbs.data ? (CBS_SOURCES[cbs.data.adapter] ?? cbs.data.adapter) : '—'}
          loading={cbs.isLoading}
        />
        <StatCard
          label="Audit log"
          icon={<ShieldCheck className="size-4" />}
          value={chain.data ? (chain.data.ok ? 'Chain intact' : 'Chain broken') : '—'}
          hint={chain.data?.ok ? `${chain.data.rows_checked} entries verified` : undefined}
          loading={chain.isLoading}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="User accounts" description="Everyone who has signed in or been provisioned" />
          {users.isError ? (
            <ErrorState error={users.error} onRetry={() => void users.refetch()} />
          ) : users.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <DataTable
              caption="User accounts"
              columns={USER_COLUMNS}
              rows={accounts}
              rowKey={(user) => user.id}
              empty={<EmptyState title="No users" />}
            />
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Core banking connection" />
            <CardBody>
              {cbs.isError ? (
                <ErrorState error={cbs.error} onRetry={() => void cbs.refetch()} />
              ) : !cbs.data ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <dl>
                  <Fact label="Source">{CBS_SOURCES[cbs.data.adapter] ?? cbs.data.adapter}</Fact>
                  {cbs.data.mapping && <Fact label="Mapping">{cbs.data.mapping}</Fact>}
                  {cbs.data.latest_file && (
                    <Fact label="Latest extract">
                      {cbs.data.latest_file}
                      <span className="block text-xs font-normal text-muted">
                        {cbs.data.latest_file_age_hours} hours old
                      </span>
                    </Fact>
                  )}
                  {cbs.data.problem && <Fact label="Problem">{cbs.data.problem}</Fact>}
                  <Fact label="Circuit breaker">{humanize(cbs.data.circuit_breaker.state.toLowerCase())}</Fact>
                  <Fact label="Calls today">
                    {cbs.data.rate_limiter.calls_used_today} of {cbs.data.rate_limiter.max_calls_per_day}
                  </Fact>
                </dl>
              )}
              {cbs.data?.adapter === 'mock' && (
                <p className="mt-3 text-xs text-muted">
                  Loan balances are compared with a built-in sample record and never changed. Connect the bank's
                  end-of-day extract to sync real balances.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Audit log integrity" />
            <CardBody>
              {chain.isError ? (
                <ErrorState error={chain.error} onRetry={() => void chain.refetch()} />
              ) : !chain.data ? (
                <Skeleton className="h-16 w-full" />
              ) : chain.data.ok ? (
                <p className="text-sm">
                  <Badge tone="success">Intact</Badge>
                  <span className="ml-2">
                    All {chain.data.rows_checked} entries link to the one before them.
                  </span>
                </p>
              ) : (
                <p className="text-sm" role="alert">
                  <Badge tone="danger">Broken</Badge>
                  <span className="ml-2">{chain.data.problem}</span>
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
