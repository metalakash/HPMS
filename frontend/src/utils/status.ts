import type { BadgeTone } from '@/components/common/Badge';

/** Every pipeline status, in lifecycle order. backend/app/models/project.py: PipelineStatus */
export const PIPELINE_STATUSES = [
  'proposal_under_pipeline',
  'under_review',
  'approved',
  'yet_to_start_drawdown',
  'under_construction',
  'under_operation',
  'settled',
  'dropped',
];

/** Maps backend status strings (pipeline_status, sync_status, priority) to a badge tone. */
const TONES: Record<string, BadgeTone> = {
  approved: 'success',
  success: 'success',
  operation: 'success',
  under_review: 'warning',
  pending: 'warning',
  construction: 'info',
  proposal_under_pipeline: 'info',
  yet_to_start_drawdown: 'warning',
  under_construction: 'info',
  under_operation: 'success',
  settled: 'neutral',
  feasibility: 'neutral',
  dropped: 'danger',
  failed: 'danger',
  dlq: 'danger',
  paid: 'success',
  overdue: 'danger',
  upcoming: 'neutral',
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'danger',
};

export function statusTone(status: string | null | undefined): BadgeTone {
  return (status && TONES[status.toLowerCase()]) || 'neutral';
}

export function projectName(
  project: { name_en: string; name_np: string },
  language: 'en' | 'ne',
): string {
  return language === 'ne' && project.name_np ? project.name_np : project.name_en;
}
