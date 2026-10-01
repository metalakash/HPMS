import { useState, useEffect } from 'react';
import { AlertTriangle, Calendar, Clock, ChevronRight } from 'lucide-react';
import { DetailDrawer } from './DetailDrawer';
import { Badge } from '@/components/common/Badge';
import { Spinner } from '@/components/common/Spinner';
import { formatDate } from '@/utils/format';

interface ExpiryAlert {
  id: string;
  type: 'license' | 'ppa' | 'insurance';
  name: string;
  expiryDate: string;
  daysUntilExpiry: number;
  status: 'critical' | 'warning' | 'ok';
  description: string;
}

interface AlertRemediationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  onInitiateRenewal?: (alertId: string, alertType: string) => void;
  onEscalateToLegal?: (alertId: string, alertType: string) => void;
}

/**
 * AlertRemediationDrawer: Shows pre-expiry compliance alerts and remediation actions.
 * Displays license, PPA, and insurance expiry dates with renewal/escalation workflows.
 */
export function AlertRemediationDrawer({
  isOpen,
  onClose,
  projectId,
  projectName,
  onInitiateRenewal,
  onEscalateToLegal,
}: AlertRemediationDrawerProps) {
  const [alerts, setAlerts] = useState<ExpiryAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [actioningId, setActioningId] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

    const fetchAlerts = async () => {
      setLoading(true);
      setError('');

      try {
        // TODO: Replace with real API call to GET /api/v1/compliance/alerts/:project_id/remediations
        const mockData: ExpiryAlert[] = [
          {
            id: 'lic-001',
            type: 'license',
            name: 'DoED Generation License',
            expiryDate: '2026-12-15',
            daysUntilExpiry: 76,
            status: 'warning',
            description: 'Nepal Ministry of Energy generation license',
          },
          {
            id: 'ppa-001',
            type: 'ppa',
            name: 'NEA Power Purchase Agreement',
            expiryDate: '2054-06-30',
            daysUntilExpiry: 10325,
            status: 'ok',
            description: '30-year PPA starting from Commercial Operation Date',
          },
          {
            id: 'ins-001',
            type: 'insurance',
            name: 'Plant All-Risk Insurance',
            expiryDate: '2027-03-31',
            daysUntilExpiry: 183,
            status: 'warning',
            description: 'Comprehensive all-risk insurance covering plant and equipment',
          },
          {
            id: 'ins-002',
            type: 'insurance',
            name: 'Third-Party Liability Insurance',
            expiryDate: '2026-11-30',
            daysUntilExpiry: 61,
            status: 'critical',
            description: 'Professional liability and third-party coverage',
          },
        ];
        setAlerts(mockData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load alerts');
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, [isOpen, projectId]);

  const handleInitiateRenewal = async (alertId: string, alertType: string) => {
    setActioningId(alertId);
    try {
      onInitiateRenewal?.(alertId, alertType);
      // Could also call API: POST /api/v1/compliance/alert-actions/initiate
    } finally {
      setActioningId('');
    }
  };

  const handleEscalate = async (alertId: string, alertType: string) => {
    setActioningId(alertId);
    try {
      onEscalateToLegal?.(alertId, alertType);
    } finally {
      setActioningId('');
    }
  };

  const getAlertIcon = (type: 'license' | 'ppa' | 'insurance') => {
    const icons = {
      license: '📋',
      ppa: '📑',
      insurance: '🛡️',
    };
    return icons[type];
  };

  const getAlertTypeLabel = (type: 'license' | 'ppa' | 'insurance') => {
    const labels = {
      license: 'License',
      ppa: 'PPA',
      insurance: 'Insurance',
    };
    return labels[type];
  };

  const criticalAlerts = alerts.filter((a) => a.status === 'critical');
  const warningAlerts = alerts.filter((a) => a.status === 'warning');
  const okAlerts = alerts.filter((a) => a.status === 'ok');

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Active Compliance Alerts"
      loading={loading}
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
            {error}
          </div>
        )}

        {/* Summary Banner */}
        {(criticalAlerts.length > 0 || warningAlerts.length > 0) && (
          <div className="rounded-lg bg-warning/10 p-4 border border-warning/20 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-fg">
                  {criticalAlerts.length + warningAlerts.length} Alert{criticalAlerts.length + warningAlerts.length !== 1 ? 's' : ''} Require Action
                </p>
                <p className="text-xs text-muted mt-1">
                  {criticalAlerts.length > 0 && `${criticalAlerts.length} critical, `}
                  {warningAlerts.length} warning
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Critical Alerts */}
        {criticalAlerts.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-danger">Critical (Action Required)</h3>
            {criticalAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                icon={getAlertIcon(alert.type)}
                typeLabel={getAlertTypeLabel(alert.type)}
                isActioning={actioningId === alert.id}
                onInitiateRenewal={() => handleInitiateRenewal(alert.id, alert.type)}
                onEscalate={() => handleEscalate(alert.id, alert.type)}
              />
            ))}
          </div>
        )}

        {/* Warning Alerts */}
        {warningAlerts.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-warning">
              Upcoming ({warningAlerts.length})
            </h3>
            {warningAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                icon={getAlertIcon(alert.type)}
                typeLabel={getAlertTypeLabel(alert.type)}
                isActioning={actioningId === alert.id}
                onInitiateRenewal={() => handleInitiateRenewal(alert.id, alert.type)}
                onEscalate={() => handleEscalate(alert.id, alert.type)}
              />
            ))}
          </div>
        )}

        {/* OK Alerts */}
        {okAlerts.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-fg">Compliant</h3>
            {okAlerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-lg border border-line bg-surface-2 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex gap-2 flex-1">
                    <span className="text-lg">{getAlertIcon(alert.type)}</span>
                    <div>
                      <p className="text-sm font-medium text-fg">{alert.name}</p>
                      <p className="text-xs text-muted mt-0.5">{alert.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Calendar className="size-3 text-muted" />
                        <span className="text-xs text-muted">
                          Expires {formatDate(alert.expiryDate, 'en')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge tone="success">OK</Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Help Text */}
        <div className="rounded-lg bg-info/10 p-3 text-sm text-info space-y-2">
          <p className="font-medium">Renewal Workflow:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Click "Initiate Renewal" to create a workflow task</li>
            <li>Upload renewal documents when available</li>
            <li>Track status in the approval queue</li>
            <li>Receive notifications when renewal completes</li>
          </ol>
        </div>
      </div>
    </DetailDrawer>
  );
}

/**
 * AlertCard: Individual alert display with action buttons
 */
function AlertCard({
  alert,
  icon,
  typeLabel,
  isActioning,
  onInitiateRenewal,
  onEscalate,
}: {
  alert: ExpiryAlert;
  icon: string;
  typeLabel: string;
  isActioning: boolean;
  onInitiateRenewal: () => void;
  onEscalate: () => void;
}) {
  const bgColor =
    alert.status === 'critical'
      ? 'bg-danger/10 border-danger/20'
      : alert.status === 'warning'
        ? 'bg-warning/10 border-warning/20'
        : 'bg-success/10 border-success/20';

  const textColor =
    alert.status === 'critical'
      ? 'text-danger'
      : alert.status === 'warning'
        ? 'text-warning'
        : 'text-success';

  return (
    <div className={`rounded-lg border ${bgColor} p-4 space-y-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-2 flex-1">
          <span className="text-lg">{icon}</span>
          <div>
            <p className="text-sm font-medium text-fg">{alert.name}</p>
            <p className="text-xs text-muted mt-0.5">{alert.description}</p>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1">
                <Calendar className="size-3 text-muted" />
                <span className="text-xs text-muted">
                  Expires {formatDate(alert.expiryDate, 'en')}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="size-3 text-muted" />
                <span className={`text-xs font-medium ${textColor}`}>
                  {alert.daysUntilExpiry} days left
                </span>
              </div>
            </div>
          </div>
        </div>
        <Badge
          tone={alert.status === 'critical' ? 'danger' : alert.status === 'warning' ? 'warning' : 'success'}
        >
          {alert.status}
        </Badge>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2 border-t border-current/10">
        <button
          onClick={onInitiateRenewal}
          disabled={isActioning}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isActioning && <Spinner size="sm" />}
          <span>Initiate Renewal</span>
          <ChevronRight className="size-4" />
        </button>
        {alert.status === 'critical' && (
          <button
            onClick={onEscalate}
            disabled={isActioning}
            className="flex-1 px-3 py-2 rounded-lg border border-danger text-danger text-sm font-medium hover:bg-danger/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Escalate to Legal
          </button>
        )}
      </div>
    </div>
  );
}
