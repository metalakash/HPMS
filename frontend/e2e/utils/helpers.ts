import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

export interface ProjectRow {
  id: string;
  project_code: string;
  name_en: string;
  province: string | null;
  project_stage: string;
  pipeline_status: string;
}

/** Same transformation as src/utils/format.ts `humanize`: "under_review" -> "Under review". */
export function humanize(value: string): string {
  const text = value.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Asks the API directly, so tests compare the UI against the backend rather than hard-coded seed data. */
export async function fetchProjects(
  api: APIRequestContext,
  params: Record<string, string | number> = {},
): Promise<{ rows: ProjectRow[]; total: number }> {
  const response = await api.get('/api/v1/projects', { params });
  expect(response.ok(), `GET /api/v1/projects -> ${response.status()}`).toBeTruthy();
  const body = await response.json();
  return { rows: body.data, total: body.meta.total_count };
}

/** A table located by its (screen-reader) caption. */
export function tableByCaption(page: Page, caption: string): Locator {
  return page.getByRole('table', { name: caption, exact: true });
}

/** Body rows of a table once its loading skeleton has been replaced by data. */
export async function loadedRows(table: Locator): Promise<Locator> {
  const rows = table.locator('tbody tr');
  await expect(rows.first()).toBeVisible();
  await expect(table.locator('tbody .animate-pulse')).toHaveCount(0);
  return rows;
}

/** Text of one column (0-based) for every body row. */
export async function columnTexts(rows: Locator, column: number): Promise<string[]> {
  const texts = await rows.locator(`td:nth-child(${column + 1})`).allInnerTexts();
  return texts.map((text) => text.trim());
}
