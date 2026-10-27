import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth';

/**
 * Project documents against the real backend: filing, versions, download, archive, and who may do what.
 * Each run files its own uniquely named document, so the suite can be repeated on the same database.
 */

const stamp = Date.now().toString(36);
const pdf = (note: string) =>
  Buffer.from(`%PDF-1.4\n% E2E ${stamp} ${note}\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n`);
const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');

async function downloaded(page: Page, buttonName: string): Promise<Buffer> {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: buttonName }).click()]);
  return readFile((await download.path())!);
}

test.describe('11. Documents', () => {
  test('a maker files a document, adds a version, and both versions download unchanged', async ({ pageAs, apiAs }) => {
    const owned = (await (await (await apiAs('maker')).get('/api/v1/compliance/covenants')).json()).data;
    const projectId = owned[0].project_id;
    const title = `Sanction letter E2E ${stamp}`;
    const first = pdf('as issued');
    const second = pdf('revised');

    const page = await pageAs('maker');
    await page.goto(`/projects/${projectId}?tab=documents`);
    await page.getByRole('button', { name: 'File a document' }).click();
    const dialog = page.getByRole('dialog');
    // A file type the bank did not ask for is refused before upload
    await dialog.getByLabel('File').setInputFiles({ name: 'tool.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') });
    await expect(dialog.getByText(/Attach one of/)).toBeVisible();
    await dialog.getByLabel('File').setInputFiles({ name: 'sanction-letter.pdf', mimeType: 'application/pdf', buffer: first });
    await dialog.getByLabel('Title').fill(title);
    await dialog.getByLabel('Document date').fill('2026-07-16');
    await dialog.getByRole('button', { name: 'File document' }).click();
    await expect(dialog).toBeHidden();

    // Saved on the server: still there after a reload
    await page.reload();
    await page.getByRole('button', { name: new RegExp(title) }).click();
    const versions = page.getByRole('dialog');
    await expect(versions.getByText('Version 1')).toBeVisible();
    expect(sha256(await downloaded(page, 'Download v1'))).toBe(sha256(first));

    await versions.getByLabel('File').setInputFiles({ name: 'sanction-letter-v2.pdf', mimeType: 'application/pdf', buffer: second });
    await versions.getByLabel('What changed').fill('Revised after the annual review');
    await versions.getByRole('button', { name: 'Upload version' }).click();
    await expect(versions.getByText('Version 2')).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: new RegExp(title) }).click();
    expect(sha256(await downloaded(page, 'Download v2'))).toBe(sha256(second));
    expect(sha256(await downloaded(page, 'Download v1'))).toBe(sha256(first));
    await page.keyboard.press('Escape');

    // Archive: hidden from the list, still there with "Show archived"
    const row = page.getByRole('row', { name: new RegExp(title) });
    await row.getByRole('button', { name: 'Archive' }).click();
    await page.getByRole('dialog').getByLabel('Reason').fill('Superseded (E2E)');
    await page.getByRole('dialog').getByRole('button', { name: 'Archive' }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: new RegExp(title) })).toHaveCount(0);
    await page.getByLabel('Show archived').check();
    await expect(page.getByRole('row', { name: new RegExp(title) })).toContainText('Archived');
  });

  test('the demo portfolio has documents, and an auditor can read them but not file', async ({ pageAs, apiAs }) => {
    const projects = (await (await (await apiAs('admin')).get('/api/v1/projects?status=under_operation&page_size=1')).json()).data;
    const page = await pageAs('auditor');
    await page.goto(`/projects/${projects[0].id}?tab=documents`);
    await expect(page.getByRole('button', { name: /Power purchase agreement/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'File a document' })).toHaveCount(0);

    // The seeded letter, not one another test may be filing on the same project at the same time
    await page.getByRole('button', { name: /Sanction letter/ }).filter({ hasNotText: 'E2E' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Version 2')).toBeVisible();
    const file = await downloaded(page, 'Download v1');
    expect(file.subarray(0, 4).toString()).toBe('%PDF');
    await expect(dialog.getByRole('button', { name: 'Upload version' })).toHaveCount(0);
  });
});
