import axios, { AxiosError } from 'axios';
import * as FileSystem from 'expo-file-system';
import { retryService } from '../utils/retry.util';
import { apiErrorUtil } from '../utils/api-error.util';

const API_BASE = process.env.REACT_APP_API_URL || 'https://api.hpms.com';

export interface PhotoUploadProgress {
  total: number;
  loaded: number;
  percentage: number;
}

export interface PhotoUploadResult {
  id: string;
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

class PhotoUploadService {
  private uploadQueue: Map<string, PhotoUploadProgress> = new Map();

  /**
   * Upload a single photo with progress tracking
   */
  async uploadPhoto(
    inspectionId: string,
    photoUri: string,
    onProgress?: (progress: PhotoUploadProgress) => void
  ): Promise<PhotoUploadResult> {
    try {
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(photoUri);
      if (!fileInfo.exists) {
        throw new Error('Photo file not found');
      }

      // Compress if needed (large photos)
      const compressedUri = await this.compressPhoto(photoUri);
      const fileName = this.extractFileName(photoUri);
      const mimeType = 'image/jpeg';

      // Create FormData
      const formData = new FormData();
      formData.append('inspectionId', inspectionId);
      formData.append('photo', {
        uri: compressedUri,
        type: mimeType,
        name: fileName,
      } as any);

      // Upload with retry and progress tracking
      const response = await retryService.retry(
        () =>
          axios.post(
            `${API_BASE}/inspections/${inspectionId}/photos`,
            formData,
            {
              headers: {
                'Content-Type': 'multipart/form-data',
                Authorization: `Bearer ${this.getToken()}`,
              },
              onUploadProgress: (progressEvent) => {
                const percentage = Math.round(
                  (progressEvent.loaded / (progressEvent.total || 1)) * 100
                );
                const progress: PhotoUploadProgress = {
                  total: progressEvent.total || 0,
                  loaded: progressEvent.loaded,
                  percentage,
                };
                this.uploadQueue.set(fileName, progress);
                onProgress?.(progress);
              },
            }
          ),
        5, // max retries for file upload
        1000 // initial delay
      );

      // Clean up compressed file if different from original
      if (compressedUri !== photoUri) {
        try {
          await FileSystem.deleteAsync(compressedUri);
        } catch (e) {
          console.warn('Failed to delete compressed photo:', e);
        }
      }

      this.uploadQueue.delete(fileName);
      return response.data;
    } catch (error) {
      throw apiErrorUtil.parseApiError(error as AxiosError);
    }
  }

  /**
   * Upload multiple photos in parallel
   */
  async uploadPhotos(
    inspectionId: string,
    photoUris: string[],
    onProgress?: (fileName: string, progress: PhotoUploadProgress) => void
  ): Promise<PhotoUploadResult[]> {
    const uploadPromises = photoUris.map((uri) =>
      this.uploadPhoto(inspectionId, uri, (progress) => {
        const fileName = this.extractFileName(uri);
        onProgress?.(fileName, progress);
      }).catch((error) => {
        console.error(`Failed to upload ${uri}:`, error);
        return null;
      })
    );

    const results = await Promise.all(uploadPromises);
    return results.filter((r) => r !== null) as PhotoUploadResult[];
  }

  /**
   * Compress photo to reduce file size
   */
  private async compressPhoto(photoUri: string): Promise<string> {
    try {
      // Use expo-image-manipulator or similar for compression
      // For now, return original URI
      // In production, compress to max 2MB with quality 0.8
      return photoUri;
    } catch (error) {
      console.warn('Photo compression failed, using original:', error);
      return photoUri;
    }
  }

  /**
   * Delete uploaded photo
   */
  async deletePhoto(inspectionId: string, photoId: string): Promise<void> {
    try {
      await axios.delete(
        `${API_BASE}/inspections/${inspectionId}/photos/${photoId}`,
        {
          headers: { Authorization: `Bearer ${this.getToken()}` },
        }
      );
    } catch (error) {
      throw apiErrorUtil.parseApiError(error as AxiosError);
    }
  }

  /**
   * Get upload progress for all queued uploads
   */
  getUploadProgress(): Map<string, PhotoUploadProgress> {
    return new Map(this.uploadQueue);
  }

  /**
   * Cancel upload (if supported by axios)
   */
  cancelUpload(fileName: string): void {
    this.uploadQueue.delete(fileName);
  }

  /**
   * Clear all upload progress
   */
  clearUploadProgress(): void {
    this.uploadQueue.clear();
  }

  /**
   * Save photo locally for offline sync
   */
  async savePhotoLocally(
    inspectionId: string,
    photoUri: string,
    photoId: string
  ): Promise<string> {
    try {
      const localPath = `${FileSystem.documentDirectory}inspections/${inspectionId}/${photoId}.jpg`;
      const dir = localPath.substring(0, localPath.lastIndexOf('/'));

      // Create directory if needed
      try {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      } catch (e) {
        // Directory might already exist
      }

      // Copy photo to local storage
      await FileSystem.copyAsync({
        from: photoUri,
        to: localPath,
      });

      return localPath;
    } catch (error) {
      console.error('Failed to save photo locally:', error);
      throw error;
    }
  }

  /**
   * Load photo from local storage
   */
  async loadPhotoLocally(inspectionId: string, photoId: string): Promise<string | null> {
    try {
      const localPath = `${FileSystem.documentDirectory}inspections/${inspectionId}/${photoId}.jpg`;
      const fileInfo = await FileSystem.getInfoAsync(localPath);

      if (fileInfo.exists) {
        return localPath;
      }
      return null;
    } catch (error) {
      console.error('Failed to load photo locally:', error);
      return null;
    }
  }

  /**
   * Delete local photo
   */
  async deletePhotoLocally(inspectionId: string, photoId: string): Promise<void> {
    try {
      const localPath = `${FileSystem.documentDirectory}inspections/${inspectionId}/${photoId}.jpg`;
      await FileSystem.deleteAsync(localPath);
    } catch (error) {
      console.warn('Failed to delete local photo:', error);
    }
  }

  private extractFileName(uri: string): string {
    return uri.split('/').pop() || `photo-${Date.now()}.jpg`;
  }

  private getToken(): string {
    // Get token from secure storage
    return 'token_placeholder';
  }
}

export const photoUploadService = new PhotoUploadService();
