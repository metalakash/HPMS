import type { BadgeTone } from '@/components/common/Badge';

/** Maps backend status strings (pipeline_status, sync_status, priority) to a badge tone. */
const TONES: Record<string, BadgeTone> = {
  approved: 'success',
  success: 'success',
  operation: 'success',
  under_review: 'warning',
  pending: 'warning',
  construction: 'info',
  proposal_under_pipeline: 'info',
  feasibility: 'neutral',
  dropped: 'danger',
  failed: 'danger',
  dlq: 'danger',
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
