/**
 * Import Service
 * Handle data parsing and import validation
 */

export type ConflictStrategy = 'skip' | 'merge' | 'replace';

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: number;
  conflicts: number;
  errorDetails: string[];
}

class ImportService {
  parseCSV(content: string): any[] {
    const lines = content.trim().split('\n');
    if (lines.length < 1) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const records: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const record: any = {};

      headers.forEach((header, idx) => {
        record[header] = values[idx] || '';
      });

      records.push(record);
    }

    return records;
  }

  parseJSON(content: string): any[] {
    try {
      const data = JSON.parse(content);

      if (Array.isArray(data)) {
        return data;
      }

      if (data.data && Array.isArray(data.data)) {
        return data.data;
      }

      if (data.records && Array.isArray(data.records)) {
        return data.records;
      }

      return [];
    } catch (error) {
      console.error('JSON parse error:', error);
      return [];
    }
  }

  parseExcel(content: string): any[] {
    // Simplified Excel parsing (assume tab-separated)
    const lines = content.trim().split('\n');
    if (lines.length < 1) return [];

    const headers = lines[0].split('\t').map(h => h.trim());
    const records: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t').map(v => v.trim());
      const record: any = {};

      headers.forEach((header, idx) => {
        record[header] = values[idx] || '';
      });

      records.push(record);
    }

    return records;
  }

  detectFileType(fileName: string): 'csv' | 'json' | 'excel' | null {
    if (fileName.endsWith('.csv')) return 'csv';
    if (fileName.endsWith('.json')) return 'json';
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) return 'excel';
    return null;
  }

  detectFeatureType(data: any[]): string {
    if (data.length === 0) return 'unknown';

    const record = data[0];
    const keys = Object.keys(record).map(k => k.toLowerCase());

    // Feature detection based on common fields
    if (keys.includes('projectid') || keys.includes('projectname')) return 'projects';
    if (keys.includes('inspectionid') || keys.includes('findings')) return 'inspections';
    if (keys.includes('workorderid') || keys.includes('priority')) return 'workorders';
    if (keys.includes('requirementid') || keys.includes('compliance')) return 'compliance';
    if (keys.includes('reportid') || keys.includes('charts')) return 'reports';

    return 'unknown';
  }

  validateData(data: any[], feature: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Array.isArray(data)) {
      errors.push('Data must be an array');
      return { valid: false, errors };
    }

    if (data.length === 0) {
      errors.push('No records to import');
      return { valid: false, errors };
    }

    // Feature-specific validation
    const requiredFields: Record<string, string[]> = {
      projects: ['name', 'status'],
      inspections: ['type', 'date'],
      workorders: ['type', 'status'],
      compliance: ['requirement', 'status'],
      reports: ['name', 'feature'],
    };

    const required = requiredFields[feature] || [];

    data.forEach((record, idx) => {
      required.forEach(field => {
        if (!record[field] || String(record[field]).trim() === '') {
          errors.push(`Record ${idx + 1}: Missing required field "${field}"`);
        }
      });
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  mapColumns(csvHeaders: string[], targetFields: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};

    csvHeaders.forEach(header => {
      const match = targetFields.find(
        field => field.toLowerCase() === header.toLowerCase()
      );
      if (match) {
        mapping[header] = match;
      }
    });

    return mapping;
  }

  detectConflicts(newData: any[], existingData: any[]): any[] {
    const conflicts: any[] = [];
    const existingIds = new Set(existingData.map(r => r.id));

    newData.forEach((record, idx) => {
      if (existingIds.has(record.id)) {
        conflicts.push({
          index: idx,
          newRecord: record,
          existingRecord: existingData.find(r => r.id === record.id),
        });
      }
    });

    return conflicts;
  }

  applyConflictResolution(
    newData: any[],
    existingData: any[],
    strategy: ConflictStrategy
  ): any[] {
    switch (strategy) {
      case 'skip': {
        const existingIds = new Set(existingData.map(r => r.id));
        return newData.filter(r => !existingIds.has(r.id));
      }

      case 'merge': {
        const merged = [...existingData];
        newData.forEach(newRecord => {
          const existingIdx = merged.findIndex(r => r.id === newRecord.id);
          if (existingIdx !== -1) {
            merged[existingIdx] = { ...merged[existingIdx], ...newRecord };
          } else {
            merged.push(newRecord);
          }
        });
        return merged;
      }

      case 'replace':
        return newData;

      default:
        return newData;
    }
  }

  batchImport(
    data: any[],
    existingData: any[],
    strategy: ConflictStrategy
  ): ImportResult {
    const result: ImportResult = {
      success: true,
      imported: 0,
      skipped: 0,
      errors: 0,
      conflicts: 0,
      errorDetails: [],
    };

    if (!Array.isArray(data)) {
      result.success = false;
      result.errors = 1;
      result.errorDetails.push('Invalid data format');
      return result;
    }

    const processed = this.applyConflictResolution(data, existingData, strategy);
    result.imported = processed.length;
    result.conflicts = this.detectConflicts(data, existingData).length;
    result.skipped = data.length - processed.length;

    return result;
  }

  validateFileSize(size: number): { valid: boolean; error?: string } {
    const maxSize = 100 * 1024 * 1024; // 100MB

    if (size > maxSize) {
      return {
        valid: false,
        error: `File size (${(size / 1024 / 1024).toFixed(1)}MB) exceeds maximum (100MB)`,
      };
    }

    return { valid: true };
  }

  estimateImportTime(recordCount: number): number {
    // Rough estimate: 0.2 seconds per record
    return Math.ceil((recordCount * 0.2) / 1000);
  }
}

export const importService = new ImportService();
