import { JustificationModal } from '@/components/modals/JustificationModal';
import { useOriginateProject } from '@/hooks/queries';
import { getErrorMessage } from '@/services/api';
import type { Language } from '@/store/useUIStore';
import type { CatalogProject } from '@/types/api';
import { formatMW, humanize } from '@/utils/format';

/**
 * Lets a maker propose a catalog project for the bank's pipeline. The baseline parameters come
 * from the national record; nothing enters the portfolio until two checkers approve the proposal.
 */
export function OriginateProjectModal({
  project,
  language,
  onClose,
  onSubmitted,
}: {
  project: CatalogProject;
  language: Language;
  onClose: () => void;
  onSubmitted: (project: CatalogProject) => void;
}) {
  const originate = useOriginateProject();

  const facts: [string, string][] = [
    ['Project code', project.project_code],
    ['Capacity', formatMW(project.installed_capacity_mw, language)],
    ['Province', project.province ?? '—'],
    ['District', project.district ?? '—'],
    ['River basin', project.river_basin ?? '—'],
    ['DoED licence', project.license_number ?? '—'],
    ['Stage', humanize(project.project_stage)],
  ];

  return (
    <JustificationModal
      isOpen
      onClose={onClose}
      entityType="Project"
      entityId={project.id}
      actionName={`proposing ${project.name_en} for bank financing`}
      isLoading={originate.isPending}
      allowDocument={false}
      onSubmit={async ({ reason }) => {
        try {
          await originate.mutateAsync({ id: project.id, justification: reason });
        } catch (error) {
          // Surface the server's reason (already proposed, already in the portfolio), not axios's generic text
          throw new Error(getErrorMessage(error), { cause: error });
        }
        onSubmitted(project);
      }}
    >
      <dl
        aria-label="Baseline parameters from the national catalog"
        className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-line p-3 text-sm"
      >
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted">
        These values are filled from the national record. On approval the project joins the bank's
        portfolio as a proposal under pipeline.
      </p>
    </JustificationModal>
  );
}
