import { useState } from 'react';
import { Input, Select } from '@/components/common/Field';
import { JustificationModal } from '@/components/modals/JustificationModal';
import { PROJECT_STAGES, useSubmitChange } from '@/hooks/queries';
import { getErrorMessage } from '@/services/api';
import type { ProjectDetail } from '@/types/api';
import { humanize } from '@/utils/format';
import { PIPELINE_STATUSES } from '@/utils/status';

const options = (values: string[]) => values.map((value) => ({ value, label: humanize(value) }));

/**
 * Lets a maker propose a change to a project. Nothing changes until two checkers approve it
 * on the Approvals page.
 */
export function ProposeChangeModal({
  project,
  onClose,
  onSubmitted,
}: {
  project: ProjectDetail;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const submit = useSubmitChange();
  const [stage, setStage] = useState<string>(project.project_stage);
  const [status, setStatus] = useState<string>(project.pipeline_status);
  const [forecastCod, setForecastCod] = useState('');
  const [dropReason, setDropReason] = useState('');

  const changes: Record<string, string> = {};
  if (stage !== project.project_stage) changes.project_stage = stage;
  if (status !== project.pipeline_status) changes.pipeline_status = status;
  if (forecastCod) changes.forecast_cod_ad = forecastCod;
  const dropping = changes.pipeline_status === 'dropped';
  if (dropping && dropReason.trim()) changes.drop_reason = dropReason.trim();

  const complete = Object.keys(changes).length > 0 && (!dropping || Boolean(changes.drop_reason));

  return (
    <JustificationModal
      isOpen
      onClose={onClose}
      entityType="Project"
      entityId={project.id}
      actionName={`changing ${project.name_en}`}
      isLoading={submit.isPending}
      canSubmit={complete}
      allowDocument={false}
      onSubmit={async ({ reason }) => {
        try {
          await submit.mutateAsync({
            entity_type: 'PROJECT',
            entity_id: project.id,
            action: 'UPDATE',
            changes,
            justification: reason,
          });
        } catch (error) {
          // Surface the server's reason (for example a field policy refusal), not axios's generic text
          throw new Error(getErrorMessage(error), { cause: error });
        }
        onSubmitted();
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="Stage"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          options={options(PROJECT_STAGES)}
        />
        <Select
          label="Pipeline status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={options(PIPELINE_STATUSES)}
        />
        <Input
          label="New forecast COD"
          type="date"
          value={forecastCod}
          onChange={(e) => setForecastCod(e.target.value)}
        />
        {dropping && (
          <Input
            label="Drop reason"
            value={dropReason}
            onChange={(e) => setDropReason(e.target.value)}
            required
          />
        )}
      </div>
      {!complete && (
        <p className="text-sm text-muted">
          {dropping ? 'Give a drop reason.' : 'Change at least one field to propose.'}
        </p>
      )}
    </JustificationModal>
  );
}
