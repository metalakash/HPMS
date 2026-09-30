/**
 * Export Service
 * Handle data export formatting and transformation
 */

export type ExportFormat = 'csv' | 'json' | 'excel' | 'pdf';

interface ExportConfig {
  features: string[];
  format: ExportFormat;
  dateRange?: { start: Date; end: Date };
  filters?: Record<string, any>;
}

interface FeatureData {
  name: string;
  records: any[];
}

class ExportService {
  formatAsCSV(data: FeatureData[]): string {
    if (data.length === 0) return '';

    const allRows: string[] = [];

    data.forEach(feature => {
      if (feature.records.length === 0) return;

      // Feature header
      allRows.push(`\n"${feature.name}"\n`);

      // CSV header
      const headers = Object.keys(feature.records[0]);
      allRows.push(headers.map(h => `"${h}"`).join(','));

      // CSV rows
      feature.records.forEach(record => {
        const values = headers.map(h => {
          const val = record[h];
          if (typeof val === 'string' && val.includes(',')) {
            return `"${val}"`;
          }
          return val;
        });
        allRows.push(values.join(','));
      });
    });

    return allRows.join('\n');
  }

  formatAsJSON(data: FeatureData[]): string {
    const structure: Record<string, any> = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalRecords: data.reduce((sum, f) => sum + f.records.length, 0),
        features: data.map(f => ({ name: f.name, count: f.records.length })),
      },
      data: {},
    };

    data.forEach(feature => {
      structure.data[feature.name] = feature.records;
    });

    return JSON.stringify(structure, null, 2);
  }

  formatAsExcel(data: FeatureData[]): string {
    // Simplified Excel format representation
    const sheets: string[] = [];

    data.forEach(feature => {
      if (feature.records.length === 0) return;

      const headers = Object.keys(feature.records[0]);
      const rows = feature.records.map(record =>
        headers.map(h => record[h]).join('\t')
      );

      sheets.push(`Sheet: ${feature.name}`);
      sheets.push(headers.join('\t'));
      sheets.push(...rows);
      sheets.push('');
    });

    return sheets.join('\n');
  }

  formatAsPDF(data: FeatureData[]): string {
    // Simplified PDF format representation
    const pages: string[] = [];

    pages.push('%PDF-1.4');
    pages.push(`%Generated: ${new Date().toISOString()}`);

    data.forEach(feature => {
      pages.push(`\n--- ${feature.name} ---`);
      pages.push(`Total Records: ${feature.records.length}`);

      feature.records.slice(0, 10).forEach((record, idx) => {
        pages.push(`\n${idx + 1}. ${JSON.stringify(record)}`);
      });

      if (feature.records.length > 10) {
        pages.push(`\n... and ${feature.records.length - 10} more records`);
      }
    });

    return pages.join('\n');
  }

  formatData(data: FeatureData[], format: ExportFormat): string {
    switch (format) {
      case 'csv':
        return this.formatAsCSV(data);
      case 'json':
        return this.formatAsJSON(data);
      case 'excel':
        return this.formatAsExcel(data);
      case 'pdf':
        return this.formatAsPDF(data);
      default:
        return this.formatAsJSON(data);
    }
  }

  estimateFileSize(data: FeatureData[], format: ExportFormat): number {
    const totalRecords = data.reduce((sum, f) => sum + f.records.length, 0);
    const avgRecordSize = 500; // bytes

    const sizeMultipliers: Record<ExportFormat, number> = {
      csv: 0.5,
      json: 0.8,
      excel: 1.2,
      pdf: 2.0,
    };

    return totalRecords * avgRecordSize * sizeMultipliers[format];
  }

  validateExport(config: ExportConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.features || config.features.length === 0) {
      errors.push('At least one feature must be selected');
    }

    if (!['csv', 'json', 'excel', 'pdf'].includes(config.format)) {
      errors.push('Invalid export format');
    }

    if (config.dateRange) {
      const start = new Date(config.dateRange.start);
      const end = new Date(config.dateRange.end);

      if (start >= end) {
        errors.push('Start date must be before end date');
      }

      const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 730) {
        errors.push('Date range cannot exceed 2 years');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  buildExportData(
    features: string[],
    allData: Record<string, any[]>,
    dateRange?: { start: Date; end: Date }
  ): FeatureData[] {
    return features
      .map(feature => {
        let records = allData[feature] || [];

        // Apply date range filter if provided
        if (dateRange) {
          const startTime = new Date(dateRange.start).getTime();
          const endTime = new Date(dateRange.end).getTime();

          records = records.filter(record => {
            const recordTime = new Date(record.date || record.createdAt).getTime();
            return recordTime >= startTime && recordTime <= endTime;
          });
        }

        return {
          name: feature,
          records,
        };
      })
      .filter(f => f.records.length > 0);
  }

  getCompressionLevel(size: number): 'low' | 'medium' | 'high' {
    if (size < 1024 * 1024) return 'low'; // < 1MB
    if (size < 10 * 1024 * 1024) return 'medium'; // < 10MB
    return 'high'; // >= 10MB
  }
}

export const exportService = new ExportService();
