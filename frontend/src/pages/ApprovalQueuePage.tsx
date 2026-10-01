import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Badge } from '@/components/common/Badge';
import { StatCard } from '@/components/common/StatCard';
import { EmptyState } from '@/components/common/States';
import { Spinner } from '@/components/common/Spinner';
import { PageHeader } from '@/components/layout/PageHeader';
import { ConfirmationModal } from '@/components/modals';
import { apiClient } from '@/services/api';
import { formatDate } from '@/utils/format';

interface ApprovalItem {
  id: string;
  entity_type: string;
  entity_id: string;
  current_state: 'submitted' | 'under_recommendation' | 'recommended' | 'approved';
  maker_id: string;
  submitted_at: string;
}

interface ApprovalQueueState {
  approvals: ApprovalItem[];
  loading: boolean;
  error: string;
  stats: {
    pending: number;
    recommended: number;
    approved: number;
  };
}

/**
 * ApprovalQueuePage: Shows pending approvals for current user.
 * Users with recommender/approver roles see items assigned to them.
 */
export default function ApprovalQueuePage() {
  const [state, setState] = useState<ApprovalQueueState>({
    approvals: [],
    loading: true,
    error: '',
    stats: { pending: 0, recommended: 0, approved: 0 },
  });

  const [selectedApproval, setSelectedApproval] = useState<ApprovalItem | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmedAction, setConfirmedAction] = useState<'approve' | 'reject' | null>(null);

  // Fetch approval queue on mount
  useEffect(() => {
    const fetchQueue = async () => {
      try {
        setState((s) => ({ ...s, loading: true, error: '' }));
        const response = await apiClient.get('/mutations/approval-queue');

        const approvals = response.data.approvals || [];
        const stats = {
          pending: approvals.filter((a: ApprovalItem) => a.current_state === 'submitted').length,
          recommended: approvals.filter((a: ApprovalItem) => a.current_state === 'recommended').length,
          approved: approvals.filter((a: ApprovalItem) => a.current_state === 'approved').length,
        };

        setState({
          approvals,
          loading: false,
          error: '',
          stats,
        });
      } catch (err) {
        setState((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load approval queue',
        }));
      }
    };

    fetchQueue();
  }, []);

  const handleApprove = async () => {
    if (!selectedApproval) return;

    try {
      await apiClient.post(`/mutations/approve`, {
        approval_request_id: selectedApproval.id,
        remarks: 'Approved',
      });

      // Refresh queue
      setState((s) => ({
        ...s,
        approvals: s.approvals.filter((a) => a.id !== selectedApproval.id),
      }));

      setSelectedApproval(null);
      setIsConfirming(false);
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'Failed to approve',
      }));
    }
  };

  const handleReject = async () => {
    if (!selectedApproval) return;

    try {
      await apiClient.post(`/mutations/reject`, {
        approval_request_id: selectedApproval.id,
        remarks: 'Rejected',
      });

      // Refresh queue
      setState((s) => ({
        ...s,
        approvals: s.approvals.filter((a) => a.id !== selectedApproval.id),
      }));

      setSelectedApproval(null);
      setIsConfirming(false);
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'Failed to reject',
      }));
    }
  };

  const columns: Column<ApprovalItem>[] = [
    {
      key: 'entity_type',
      header: 'Entity Type',
      render: (item) => (
        <span className="font-medium text-fg capitalize">{item.entity_type.toLowerCase()}</span>
      ),
    },
    {
      key: 'entity_id',
      header: 'Entity ID',
      render: (item) => <span className="font-mono text-sm text-muted">{item.entity_id}</span>,
    },
    {
      key: 'current_state',
      header: 'Status',
      render: (item) => {
        const tones = {
          submitted: 'warning' as const,
          under_recommendation: 'warning' as const,
          recommended: 'info' as const,
          approved: 'success' as const,
        };
        return (
          <Badge tone={tones[item.current_state]}>
            {item.current_state.replace('_', ' ')}
          </Badge>
        );
      },
    },
    {
      key: 'submitted_at',
      header: 'Submitted',
      hideOnMobile: true,
      render: (item) => formatDate(item.submitted_at, 'en'),
    },
    {
      key: 'actions',
      header: 'Action',
      render: (item) => (
        <button
          onClick={() => setSelectedApproval(item)}
          className="text-primary hover:underline text-sm font-medium"
        >
          Review →
        </button>
      ),
    },
  ];

  if (state.loading) {
    return (
      <>
        <PageHeader
          title="Approval Queue"
          description="Pending approvals and recommendations"
        />
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Approval Queue"
        description="Review and approve pending mutations"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Pending Approvals"
          icon={<Clock className="size-4" />}
          value={state.stats.pending.toString()}
        />
        <StatCard
          label="Recommended"
          icon={<AlertCircle className="size-4" />}
          value={state.stats.recommended.toString()}
        />
        <StatCard
          label="Approved"
          icon={<CheckCircle className="size-4" />}
          value={state.stats.approved.toString()}
        />
      </div>

      {state.error && (
        <div className="mt-6 rounded-lg bg-danger/10 p-4 text-sm text-danger">
          {state.error}
        </div>
      )}

      <div className="mt-6">
        <Card>
          <CardHeader
            title="Approval Requests"
            description="Click 'Review' to approve or reject mutations"
          />
          {state.approvals.length === 0 ? (
            <EmptyState
              title="No pending approvals"
              description="Your approval queue is empty. New mutations will appear here."
            />
          ) : (
            <DataTable
              caption="Pending approvals"
              columns={columns}
              rows={state.approvals}
              rowKey={(item) => item.id}
              empty={<EmptyState title="No approvals" />}
            />
          )}
        </Card>
      </div>

      {/* Approval Details Modal */}
      {selectedApproval && (
        <ApprovalDetailsModal
          approval={selectedApproval}
          onClose={() => setSelectedApproval(null)}
          onApprove={() => {
            setConfirmedAction('approve');
            setIsConfirming(true);
          }}
          onReject={() => {
            setConfirmedAction('reject');
            setIsConfirming(true);
          }}
        />
      )}

      {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={isConfirming && confirmedAction === 'approve'}
        onClose={() => {
          setIsConfirming(false);
          setConfirmedAction(null);
        }}
        title="Approve Mutation?"
        message="This mutation will be approved and the changes will take effect."
        confirmText="Approve"
        isDangerous={false}
        onConfirm={handleApprove}
      />

      <ConfirmationModal
        isOpen={isConfirming && confirmedAction === 'reject'}
        onClose={() => {
          setIsConfirming(false);
          setConfirmedAction(null);
        }}
        title="Reject Mutation?"
        message="This mutation will be rejected and sent back to the maker for revision."
        confirmText="Reject"
        isDangerous={true}
        onConfirm={handleReject}
      />
    </>
  );
}

/**
 * ApprovalDetailsModal: Shows details of a pending approval
 */
function ApprovalDetailsModal({
  approval,
  onClose,
  onApprove,
  onReject,
}: {
  approval: ApprovalItem;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        role="presentation"
      />

      <div className="relative z-10 w-full max-w-md rounded-lg border border-line bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-fg">Approval Details</h2>

        <div className="mt-4 space-y-3">
          <div>
            <p className="text-sm text-muted">Entity Type</p>
            <p className="mt-1 font-medium text-fg capitalize">
              {approval.entity_type.toLowerCase()}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted">Entity ID</p>
            <p className="mt-1 font-mono text-sm text-fg">{approval.entity_id}</p>
          </div>

          <div>
            <p className="text-sm text-muted">Status</p>
            <p className="mt-1">
              <Badge tone="warning">
                {approval.current_state.replace('_', ' ')}
              </Badge>
            </p>
          </div>

          <div>
            <p className="text-sm text-muted">Submitted By</p>
            <p className="mt-1 text-sm text-fg">{approval.maker_id}</p>
          </div>

          <div>
            <p className="text-sm text-muted">Submitted At</p>
            <p className="mt-1 text-sm text-fg">
              {formatDate(approval.submitted_at, 'en')}
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-line text-sm font-medium text-fg hover:bg-surface-2 transition-colors"
          >
            Close
          </button>
          <button
            onClick={onReject}
            className="flex-1 px-4 py-2 rounded-lg border border-danger text-sm font-medium text-danger hover:bg-danger/10 transition-colors"
          >
            Reject
          </button>
          <button
            onClick={onApprove}
            className="flex-1 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
