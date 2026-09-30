import { Users, Key, Settings } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Badge } from '@/components/common/Badge';
import { StatCard } from '@/components/common/StatCard';
import { EmptyState } from '@/components/common/States';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatDate } from '@/utils/format';

interface UserAccount {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
  last_login: string;
}

const mockUsers: UserAccount[] = [
  {
    id: '1',
    full_name: 'Akash Rai',
    email: 'akash@hpms.io',
    role: 'admin',
    status: 'active',
    last_login: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    full_name: 'Priya Sharma',
    email: 'priya@hpms.io',
    role: 'analyst',
    status: 'active',
    last_login: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    full_name: 'Ram Kumar',
    email: 'ram@hpms.io',
    role: 'viewer',
    status: 'inactive',
    last_login: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export default function AdminPage() {
  const activeUsers = mockUsers.filter((u) => u.status === 'active').length;
  const apiKeys = 5;

  const columns: Column<UserAccount>[] = [
    {
      key: 'full_name',
      header: 'Name',
      render: (item) => item.full_name,
    },
    {
      key: 'email',
      header: 'Email',
      hideOnMobile: true,
      render: (item) => item.email,
    },
    {
      key: 'role',
      header: 'Role',
      render: (item) => (
        <Badge
          tone={item.role === 'admin' ? 'info' : item.role === 'analyst' ? 'warning' : 'success'}
        >
          {item.role}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => (
        <Badge tone={item.status === 'active' ? 'success' : 'warning'}>
          {item.status === 'active' ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'last_login',
      header: 'Last Login',
      hideOnMobile: true,
      render: (item) => formatDate(item.last_login, 'en'),
    },
  ];

  return (
    <>
      <PageHeader
        title="Admin"
        description="Users, organization settings and API keys"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Active Users"
          icon={<Users className="size-4" />}
          value={String(activeUsers)}
        />
        <StatCard
          label="Total Users"
          icon={<Users className="size-4" />}
          value={String(mockUsers.length)}
        />
        <StatCard
          label="API Keys"
          icon={<Key className="size-4" />}
          value={String(apiKeys)}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="User Accounts" description="Manage team members and access" />
          {mockUsers.length === 0 ? (
            <EmptyState title="No users" description="User accounts will appear here." />
          ) : (
            <DataTable
              caption="User accounts"
              columns={columns}
              rows={mockUsers}
              rowKey={(item) => item.id}
              empty={<EmptyState title="No users" />}
            />
          )}
        </Card>

        <Card>
          <CardHeader title="Organization Settings" description="Manage organization details" />
          <div className="space-y-4 p-4">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div>
                <p className="font-medium">Organization Name</p>
                <p className="text-sm text-muted">HPMS Admin</p>
              </div>
              <button className="text-sm text-primary hover:underline">Edit</button>
            </div>
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div>
                <p className="font-medium">Email Domain</p>
                <p className="text-sm text-muted">hpms.io</p>
              </div>
              <button className="text-sm text-primary hover:underline">Configure</button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">API Access</p>
                <p className="text-sm text-muted">5 active keys</p>
              </div>
              <button className="text-sm text-primary hover:underline">Manage</button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
