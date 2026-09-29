/**
 * Report Generator Service
 * Generate report data and format for export
 */

export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'none';
export type ExportFormat = 'pdf' | 'excel' | 'json' | 'csv';

export interface ReportData {
  summary: {
    totalRecords: number;
    filteredCount: number;
    generatedAt: string;
    dateRange: { start: string; end: string };
  };
  data: any[];
  statistics?: Record<string, any>;
  chart?: any;
}

class ReportGeneratorService {
  generateReportData(items: any[], config: any): ReportData {
    // Apply filters
    let filtered = this.applyFilters(items, config.filters || []);

    // Apply date range
    if (config.dateRange) {
      filtered = this.filterByDateRange(filtered, config.dateRange, config.dateField || 'date');
    }

    // Select fields
    const selected = this.selectFields(filtered, config.fields);

    // Group data if specified
    let grouped = selected;
    if (config.groupBy) {
      grouped = this.groupData(selected, config.groupBy);
    }

    // Sort data
    let sorted = grouped;
    if (config.sortBy) {
      sorted = this.sortData(sorted, config.sortBy, config.sortOrder || 'asc');
    }

    // Calculate statistics
    const statistics = config.includeStats ? this.calculateStatistics(sorted, config.fields) : undefined;

    // Generate chart data
    const chart = config.chartType && config.chartType !== 'none'
      ? this.generateChartData(sorted, config.chartType, config.groupBy)
      : undefined;

    return {
      summary: {
        totalRecords: items.length,
        filteredCount: filtered.length,
        generatedAt: new Date().toISOString(),
        dateRange: config.dateRange || { start: '', end: '' },
      },
      data: sorted,
      statistics,
      chart,
    };
  }

  private applyFilters(data: any[], filters: any[]): any[] {
    if (!filters || filters.length === 0) return data;

    return data.filter(item => {
      return filters.every(filter => {
        const value = item[filter.field];
        switch (filter.operator) {
          case 'equals':
            return value === filter.value;
          case 'contains':
            return String(value).includes(filter.value);
          case 'greater_than':
            return value > filter.value;
          case 'less_than':
            return value < filter.value;
          case 'in':
            return filter.value.includes(value);
          default:
            return true;
        }
      });
    });
  }

  private filterByDateRange(data: any[], dateRange: any, dateField: string): any[] {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);

    return data.filter(item => {
      const itemDate = new Date(item[dateField]);
      return itemDate >= start && itemDate <= end;
    });
  }

  private selectFields(data: any[], fields: string[]): any[] {
    return data.map(item => {
      const selected: any = {};
      fields.forEach(field => {
        selected[field] = item[field];
      });
      return selected;
    });
  }

  private groupData(data: any[], groupBy: string): any[] {
    const grouped = new Map<any, any[]>();

    data.forEach(item => {
      const key = item[groupBy];
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    });

    return Array.from(grouped.entries()).map(([key, items]) => ({
      [groupBy]: key,
      count: items.length,
      items,
    }));
  }

  private sortData(data: any[], sortBy: string, order: 'asc' | 'desc'): any[] {
    return [...data].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];

      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }

  private calculateStatistics(data: any[], fields: string[]): Record<string, any> {
    const stats: Record<string, any> = {};

    fields.forEach(field => {
      const values = data
        .map((item: any) => item[field])
        .filter((v: any) => typeof v === 'number');

      if (values.length > 0) {
        stats[field] = {
          count: values.length,
          sum: values.reduce((a: number, b: number) => a + b, 0),
          average: values.reduce((a: number, b: number) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
        };
      }
    });

    return stats;
  }

  private generateChartData(data: any[], chartType: ChartType, groupBy?: string): any {
    if (chartType === 'none') return undefined;

    const chartData = data.slice(0, 10).map((item, index) => ({
      label: item[groupBy || 'name'] || `Item ${index + 1}`,
      value: typeof item.value === 'number' ? item.value : Math.floor(Math.random() * 100),
      color: this.getChartColor(index),
    }));

    return {
      type: chartType,
      data: chartData,
    };
  }

  private getChartColor(index: number): string {
    const colors = [
      '#1976d2',
      '#388e3c',
      '#d32f2f',
      '#f57c00',
      '#7b1fa2',
      '#0097a7',
      '#c2185b',
      '#fbc02d',
      '#00796b',
      '#512da8',
    ];
    return colors[index % colors.length];
  }

  formatForExport(data: ReportData, format: ExportFormat): string | Blob {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this.convertToCSV(data.data);
      case 'excel':
        return `Excel export: ${data.summary.totalRecords} records`;
      case 'pdf':
        return `PDF export: ${data.summary.totalRecords} records`;
      default:
        return JSON.stringify(data);
    }
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map(item =>
      headers.map(header => {
        const value = item[header];
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }
}

export const reportGenerator = new ReportGeneratorService();
