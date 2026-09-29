/**
 * Report Validation Service
 * Validate report configuration before generation
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

class ReportValidationService {
  validateReportConfig(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!config.name || config.name.trim() === '') {
      errors.push('Report name is required');
    }

    if (!config.feature) {
      errors.push('Feature selection is required');
    }

    if (!config.fields || config.fields.length === 0) {
      errors.push('At least one field must be selected');
    }

    if (config.fields && config.fields.length > 50) {
      warnings.push('Large field count may impact performance');
    }

    // Validate date range if provided
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

    // Validate grouping field if provided
    if (config.groupBy && !config.fields.includes(config.groupBy)) {
      warnings.push(`Group by field '${config.groupBy}' is not in selected fields`);
    }

    // Validate sorting field if provided
    if (config.sortBy && !config.fields.includes(config.sortBy)) {
      warnings.push(`Sort field '${config.sortBy}' is not in selected fields`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateFieldSelection(fields: string[], availableFields: string[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!fields || fields.length === 0) {
      errors.push('At least one field must be selected');
      return { valid: false, errors, warnings };
    }

    const invalidFields = fields.filter(f => !availableFields.includes(f));
    if (invalidFields.length > 0) {
      errors.push(`Invalid fields: ${invalidFields.join(', ')}`);
    }

    if (fields.length > 50) {
      warnings.push('Report with many fields may be slow to generate');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateDateRange(start: Date, end: Date): ValidationResult {
    const errors: string[] = [];

    if (start >= end) {
      errors.push('Start date must be before end date');
    }

    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 730) {
      errors.push('Date range cannot exceed 2 years');
    }

    if (daysDiff < 0) {
      errors.push('Invalid date range');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  validateSchedule(frequency: string, emailRecipients?: string[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const validFrequencies = ['daily', 'weekly', 'monthly'];
    if (!validFrequencies.includes(frequency)) {
      errors.push(`Invalid frequency: ${frequency}`);
    }

    if (emailRecipients && emailRecipients.length > 0) {
      const invalidEmails = emailRecipients.filter(
        email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      );
      if (invalidEmails.length > 0) {
        errors.push(`Invalid email addresses: ${invalidEmails.join(', ')}`);
      }
    }

    if (!emailRecipients || emailRecipients.length === 0) {
      warnings.push('No email recipients specified for scheduled report');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateExportFormat(format: string, estimatedSize: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const validFormats = ['pdf', 'excel', 'csv', 'json'];
    if (!validFormats.includes(format)) {
      errors.push(`Invalid export format: ${format}`);
    }

    // Size warnings (in bytes)
    if (estimatedSize > 100 * 1024 * 1024) {
      // 100MB
      errors.push('Report size exceeds 100MB limit');
    } else if (estimatedSize > 50 * 1024 * 1024) {
      // 50MB
      warnings.push('Large report size may take longer to generate');
    }

    // Excel has row limit
    if (format === 'excel' && estimatedSize > 1048576 * 100) {
      errors.push('Excel format limited to ~1M rows');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

export const reportValidation = new ReportValidationService();
