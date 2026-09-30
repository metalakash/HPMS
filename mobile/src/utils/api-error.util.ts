/**
 * API Error Utilities - Standardized error handling
 */

import { AxiosError } from 'axios';

export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public details?: any,
    public isNetworkError: boolean = false
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Parse axios error into standardized ApiError
 */
export function parseApiError(error: any): ApiError {
  // Network error (no response)
  if (!error.response && error.message) {
    return new ApiError(
      0,
      error.message || 'Network error',
      null,
      true
    );
  }

  // Handle axios error
  if (error.response) {
    const { status, data } = error.response;
    const message = data?.detail || data?.message || error.message;

    return new ApiError(status, message, data, false);
  }

  // Generic error
  return new ApiError(
    0,
    error.message || 'Unknown error',
    null,
    true
  );
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: ApiError): boolean {
  // Retry on network errors
  if (error.isNetworkError) {
    return true;
  }

  // Retry on specific status codes
  const retryableStatus = [408, 429, 500, 502, 503, 504];
  return retryableStatus.includes(error.status);
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: ApiError): string {
  if (error.isNetworkError) {
    return 'Network connection failed. Please check your internet.';
  }

  switch (error.status) {
    case 400:
      return 'Invalid request. Please check your input.';
    case 401:
      return 'Please log in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 429:
      return 'Too many requests. Please try again later.';
    case 500:
      return 'Server error. Please try again later.';
    case 502:
    case 503:
    case 504:
      return 'Service unavailable. Please try again later.';
    default:
      return error.message || 'An error occurred.';
  }
}

/**
 * Validation error helper
 */
export interface ValidationError {
  field: string;
  message: string;
}

export function parseValidationErrors(details: any): ValidationError[] {
  if (!details || !Array.isArray(details)) {
    return [];
  }

  return details.map((error: any) => ({
    field: error.loc?.[1] || 'unknown',
    message: error.msg || 'Invalid input',
  }));
}
