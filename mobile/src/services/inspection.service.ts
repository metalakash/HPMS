import axios, { AxiosError } from 'axios';
import { cacheService } from './cache.service';
import { retryService } from '../utils/retry.util';
import { apiErrorUtil } from '../utils/api-error.util';
import FormData from 'form-data';

const API_BASE = process.env.REACT_APP_API_URL || 'https://api.hpms.com';
const ENDPOINTS = {
  INSPECTIONS: `${API_BASE}/inspections`,
  INSPECTION_DETAIL: (id: string) => `${API_BASE}/inspections/${id}`,
  INSPECTION_PHOTOS: (id: string) => `${API_BASE}/inspections/${id}/photos`,
  INSPECTION_SUBMIT: (id: string) => `${API_BASE}/inspections/${id}/submit`,
  DRAFTS: `${API_BASE}/inspections/drafts`,
  DRAFT_DETAIL: (id: string) => `${API_BASE}/inspections/drafts/${id}`,
};

const CACHE_KEYS = {
  INSPECTIONS_LIST: 'inspections_list',
  INSPECTION_DETAIL: (id: string) => `inspection_detail_${id}`,
  INSPECTION_DRAFTS: 'inspection_drafts',
};

export interface Inspection {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  type: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  photos: InspectionPhoto[];
  checklist: ChecklistItem[];
  signature: SignatureData;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
}

export interface InspectionPhoto {
  id: string;
  inspectionId: string;
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  notes: string;
  uploadedAt: string;
}

export interface ChecklistItem {
  id: string;
  name: string;
  completed: boolean;
  notes: string;
}

export interface SignatureData {
  inspectorName: string;
  data: string; // Base64 encoded
  timestamp: string;
}

export interface InspectionDraft {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  type: string;
  photos: InspectionPhoto[];
  checklist: ChecklistItem[];
  signature: SignatureData | null;
  status: 'draft' | 'pending_sync';
  savedAt: string;
  lastModified: string;
}

class InspectionService {
  // Get all inspections
  async getInspections(page: number = 1, limit: number = 10) {
    const cacheKey = CACHE_KEYS.INSPECTIONS_LIST;
    const cached = await cacheService.get<Inspection[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await retryService.retry(() =>
        axios.get<Inspection[]>(ENDPOINTS.INSPECTIONS, {
          params: { page, limit },
          headers: { Authorization: `Bearer ${this.getToken()}` },
        })
      );

      await cacheService.set(cacheKey, response.data, 5 * 60 * 1000); // 5 min TTL
      return response.data;
    } catch (error) {
      throw apiErrorUtil.parseApiError(error as AxiosError);
    }
  }

  // Get single inspection
  async getInspection(id: string) {
    const cacheKey = CACHE_KEYS.INSPECTION_DETAIL(id);
    const cached = await cacheService.get<Inspection>(cacheKey);
    if (cached) return cached;

    try {
      const response = await retryService.retry(() =>
        axios.get<Inspection>(ENDPOINTS.INSPECTION_DETAIL(id), {
          headers: { Authorization: `Bearer ${this.getToken()}` },
        })
      );

      await cacheService.set(cacheKey, response.data, 10 * 60 * 1000); // 10 min TTL
      return response.data;
    } catch (error) {
      throw apiErrorUtil.parseApiError(error as AxiosError);
    }
  }

  // Create inspection
  async createInspection(data: Partial<Inspection>) {
    try {
      const response = await axios.post<Inspection>(
        ENDPOINTS.INSPECTIONS,
        data,
        {
          headers: {
            Authorization: `Bearer ${this.getToken()}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Invalidate cache
      await this.invalidateInspectionsCache();
      return response.data;
    } catch (error) {
      throw apiErrorUtil.parseApiError(error as AxiosError);
    }
  }

  // Upload inspection photos
  async uploadPhotos(inspectionId: string, photos: File[]) {
    const formData = new FormData();
    photos.forEach((photo, index) => {
      formData.append(`photos[${index}]`, photo);
    });

    try {
      const response = await retryService.retry(() =>
        axios.post<InspectionPhoto[]>(
          ENDPOINTS.INSPECTION_PHOTOS(inspectionId),
          formData,
          {
            headers: {
              Authorization: `Bearer ${this.getToken()}`,
              'Content-Type': 'multipart/form-data',
            },
          }
        )
      );

      // Invalidate inspection detail cache
      await cacheService.remove(CACHE_KEYS.INSPECTION_DETAIL(inspectionId));
      return response.data;
    } catch (error) {
      throw apiErrorUtil.parseApiError(error as AxiosError);
    }
  }

  // Submit inspection
  async submitInspection(id: string, data: Inspection) {
    try {
      const response = await axios.post<Inspection>(
        ENDPOINTS.INSPECTION_SUBMIT(id),
        data,
        {
          headers: { Authorization: `Bearer ${this.getToken()}` },
        }
      );

      // Invalidate caches
      await this.invalidateInspectionsCache();
      await cacheService.remove(CACHE_KEYS.INSPECTION_DETAIL(id));
      return response.data;
    } catch (error) {
      throw apiErrorUtil.parseApiError(error as AxiosError);
    }
  }

  // Draft management
  async getDrafts() {
    const cacheKey = CACHE_KEYS.INSPECTION_DRAFTS;
    const cached = await cacheService.get<InspectionDraft[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await retryService.retry(() =>
        axios.get<InspectionDraft[]>(ENDPOINTS.DRAFTS, {
          headers: { Authorization: `Bearer ${this.getToken()}` },
        })
      );

      await cacheService.set(cacheKey, response.data, 15 * 60 * 1000); // 15 min TTL
      return response.data;
    } catch (error) {
      // Return empty array if offline
      return [];
    }
  }

  // Save draft
  async saveDraft(draft: InspectionDraft) {
    try {
      const response = await axios.post<InspectionDraft>(
        ENDPOINTS.DRAFTS,
        draft,
        {
          headers: { Authorization: `Bearer ${this.getToken()}` },
        }
      );

      // Invalidate cache
      await cacheService.remove(CACHE_KEYS.INSPECTION_DRAFTS);
      return response.data;
    } catch (error) {
      // If offline, save to local DB (handled by WatermelonDB in database service)
      throw apiErrorUtil.parseApiError(error as AxiosError);
    }
  }

  // Update draft
  async updateDraft(id: string, draft: Partial<InspectionDraft>) {
    try {
      const response = await axios.patch<InspectionDraft>(
        ENDPOINTS.DRAFT_DETAIL(id),
        draft,
        {
          headers: { Authorization: `Bearer ${this.getToken()}` },
        }
      );

      // Invalidate cache
      await cacheService.remove(CACHE_KEYS.INSPECTION_DRAFTS);
      return response.data;
    } catch (error) {
      throw apiErrorUtil.parseApiError(error as AxiosError);
    }
  }

  // Delete draft
  async deleteDraft(id: string) {
    try {
      await axios.delete(ENDPOINTS.DRAFT_DETAIL(id), {
        headers: { Authorization: `Bearer ${this.getToken()}` },
      });

      // Invalidate cache
      await cacheService.remove(CACHE_KEYS.INSPECTION_DRAFTS);
    } catch (error) {
      throw apiErrorUtil.parseApiError(error as AxiosError);
    }
  }

  // Sync draft to server
  async syncDraft(id: string) {
    try {
      const response = await retryService.retry(() =>
        axios.post(`${ENDPOINTS.DRAFT_DETAIL(id)}/sync`, {}, {
          headers: { Authorization: `Bearer ${this.getToken()}` },
        })
      );

      // Invalidate caches
      await cacheService.remove(CACHE_KEYS.INSPECTION_DRAFTS);
      await this.invalidateInspectionsCache();
      return response.data;
    } catch (error) {
      throw apiErrorUtil.parseApiError(error as AxiosError);
    }
  }

  // Invalidate caches
  private async invalidateInspectionsCache() {
    await cacheService.remove(CACHE_KEYS.INSPECTIONS_LIST);
  }

  private getToken(): string {
    // Get token from store or secure storage
    // This would be implemented with secure token storage
    return 'token_placeholder';
  }
}

export const inspectionService = new InspectionService();
