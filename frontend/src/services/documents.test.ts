import { describe, expect, it } from 'vitest';
import { fileProblem, formatBytes, type DocumentRules } from './documents';

const rules: DocumentRules = { classifications: ['sanction_letter'], extensions: ['.pdf', '.docx'], max_mb: 1 };
const file = (name: string, size: number) => new File([new Uint8Array(size)], name);

describe('fileProblem', () => {
  it('accepts an allowed file within the limit, whatever the case of its extension', () => {
    expect(fileProblem(file('Letter.PDF', 10), rules)).toBeNull();
  });

  it('names the accepted types for anything else', () => {
    expect(fileProblem(file('tool.exe', 10), rules)).toBe('Attach one of: .pdf, .docx');
    expect(fileProblem(file('no-extension', 10), rules)).toMatch(/Attach one of/);
  });

  it('refuses empty and oversized files with the size', () => {
    expect(fileProblem(file('empty.pdf', 0), rules)).toBe('This file is empty');
    expect(fileProblem(file('big.pdf', 1024 * 1024 + 1), rules)).toBe('This file is 1.0 MB; the limit is 1 MB');
  });

  it('says nothing until a file and the rules are known', () => {
    expect(fileProblem(null, rules)).toBeNull();
    expect(fileProblem(file('a.exe', 1), undefined)).toBeNull();
  });
});

describe('formatBytes', () => {
  it('uses the largest sensible unit', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
