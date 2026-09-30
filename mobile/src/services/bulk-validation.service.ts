/**
 * Bulk Validation Service
 * Pre-flight validation before bulk operations
 */

import { BulkOperationType, ExportFormat } from './bulk-api';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface Item {
  id: string;
  title: string;
  type: string;
  status: string;
  dependencies?: string[];
}

class BulkValidationService {
  // ==================== Validation Methods ====================

  validateBulkUpdate(items: Item[], config: { field: string; value: any }): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!items || items.length === 0) {
      errors.push('No items selected');
    }

    if (items.length > 10000) {
      warnings.push(`Large batch size (${items.length} items) may take longer to process`);
    }

    // Check for duplicates
    const uniqueIds = new Set(items.map(i => i.id));
    if (uniqueIds.size !== items.length) {
      errors.push('Duplicate items detected in selection');
    }

    // Validate config
    if (!config.field || config.field.trim() === '') {
      errors.push('Field to update is required');
    }

    if (config.value === undefined || config.value === null) {
      errors.push('Update value is required');
    }

    // Check item permissions
    const restrictedStatuses = ['archived', 'deleted', 'locked'];
    const restrictedItems = items.filter(i => restrictedStatuses.includes(i.status));
    if (restrictedItems.length > 0) {
      warnings.push(`${restrictedItems.length} item(s) in restricted status may not be updatable`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateBulkDelete(items: Item[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!items || items.length === 0) {
      errors.push('No items selected');
    }

    if (items.length > 10000) {
      warnings.push(`Large batch size (${items.length} items) may take longer to process`);
    }

    // Check for duplicates
    const uniqueIds = new Set(items.map(i => i.id));
    if (uniqueIds.size !== items.length) {
      errors.push('Duplicate items detected in selection');
    }

    // Check for dependencies
    const itemIds = new Set(items.map(i => i.id));
    let dependencyCount = 0;
    items.forEach(item => {
      if (item.dependencies) {
        const externalDeps = item.dependencies.filter(d => !itemIds.has(d));
        if (externalDeps.length > 0) {
          dependencyCount += externalDeps.length;
        }
      }
    });

    if (dependencyCount > 0) {
      warnings.push(`${dependencyCount} external dependency/dependencies detected. Related items may be affected.`);
    }

    // Check system items
    const systemItems = items.filter(i => i.status === 'system');
    if (systemItems.length > 0) {
      errors.push(`Cannot delete ${systemItems.length} system item(s)`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateBulkArchive(items: Item[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!items || items.length === 0) {
      errors.push('No items selected');
    }

    if (items.length > 10000) {
      warnings.push(`Large batch size (${items.length} items) may take longer to process`);
    }

    // Check for duplicates
    const uniqueIds = new Set(items.map(i => i.id));
    if (uniqueIds.size !== items.length) {
      errors.push('Duplicate items detected in selection');
    }

    // Check already archived items
    const archivedItems = items.filter(i => i.status === 'archived');
    if (archivedItems.length > 0) {
      warnings.push(`${archivedItems.length} item(s) already archived`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateBulkRestore(items: Item[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!items || items.length === 0) {
      errors.push('No items selected');
    }

    // Check that items are archived
    const nonArchivedItems = items.filter(i => i.status !== 'archived');
    if (nonArchivedItems.length > 0) {
      errors.push(`${nonArchivedItems.length} item(s) not in archived state`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateBulkExport(
    items: Item[],
    format: ExportFormat,
    fields?: string[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!items || items.length === 0) {
      errors.push('No items selected');
    }

    if (!format || !['csv', 'json', 'excel'].includes(format)) {
      errors.push('Invalid export format');
    }

    // Check file size estimate
    const estimatedSize = items.length * 2; // Rough estimate in KB
    if (estimatedSize > 50000) {
      warnings.push(`Large export size (~${Math.round(estimatedSize / 1024)}MB). May take a while.`);
    }

    if (format === 'excel' && items.length > 100000) {
      errors.push('Excel format limited to 100,000 rows');
    }

    if (fields && fields.length === 0) {
      warnings.push('No fields selected. All fields will be exported.');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateBulkDuplicate(items: Item[], count: number = 1): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!items || items.length === 0) {
      errors.push('No items selected');
    }

    if (count < 1 || count > 10) {
      errors.push('Copy count must be between 1 and 10');
    }

    // Check total resulting items
    const totalItems = (items.length || 0) * count;
    if (totalItems > 50000) {
      errors.push(`Duplication would create ${totalItems} items (max 50,000 per batch)`);
    }

    if (totalItems > 1000) {
      warnings.push(`Will create ${totalItems} total items. This may take a while.`);
    }

    // Check read-only items
    const readOnlyItems = items.filter(i => i.status === 'locked' || i.status === 'system');
    if (readOnlyItems.length > 0) {
      warnings.push(`${readOnlyItems.length} item(s) in read-only status cannot be duplicated`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ==================== Generic Validation ====================

  validateOperationType(operationType: BulkOperationType, itemTypes: string[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if operation is supported for item types
    const unsupportedOps: Record<string, BulkOperationType[]> = {
      'system': ['delete', 'duplicate'],
      'locked': ['update', 'delete', 'duplicate'],
    };

    itemTypes.forEach(type => {
      if (unsupportedOps[type]?.includes(operationType)) {
        errors.push(`${operationType} operation not supported for ${type} items`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateBatchSize(
    itemCount: number,
    operationType: BulkOperationType
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Max batch sizes per operation
    const maxSizes: Record<BulkOperationType, number> = {
      update: 10000,
      delete: 5000,
      archive: 10000,
      restore: 10000,
      export: 50000,
      duplicate: 1000,
    };

    const maxSize = maxSizes[operationType];
    if (itemCount > maxSize) {
      errors.push(`Batch size exceeds limit of ${maxSize} for ${operationType} operation`);
    }

    // Warnings for large batches
    const largeThreshold = maxSize * 0.8;
    if (itemCount > largeThreshold) {
      warnings.push(`Large batch (${itemCount} items). Processing may take several minutes.`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateAPIRate(operationCount: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Max 10 concurrent operations
    if (operationCount > 10) {
      errors.push(`Too many concurrent operations (max 10). Please wait for some to complete.`);
    } else if (operationCount > 5) {
      warnings.push(`${operationCount} operations running. API may be rate-limited.`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ==================== Helper Methods ====================

  isValidationError(error: unknown): boolean {
    return error instanceof Error && error.message.includes('Validation');
  }

  mergeValidationResults(...results: ValidationResult[]): ValidationResult {
    const merged: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    results.forEach(result => {
      if (!result.valid) merged.valid = false;
      merged.errors.push(...result.errors);
      merged.warnings.push(...result.warnings);
    });

    return merged;
  }
}

export const bulkValidation = new BulkValidationService();
