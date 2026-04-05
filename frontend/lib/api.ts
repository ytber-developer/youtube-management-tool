import { API_BASE_URL, API_ENDPOINTS, buildApiUrl } from './constants';

// Types
export interface WatchVideoRequest {
  videoUrl: string;
  tabs?: number;
  duration?: number;
  useAccounts?: boolean;
  humanBehavior?: boolean;
  randomDuration?: boolean;
  autoSubscribe?: boolean;
  autoComment?: boolean;
  autoLike?: boolean;
  batchSize?: number;
}

export interface WatchVideoResponse {
  success: boolean;
  message: string;
  data?: any[];
  summary?: {
    total: number;
    success: number;
    failed: number;
    videoUrl: string;
    duration: number;
  };
}

export interface Account {
  id: number;
  email: string;
  channelName?: string;
  channelLink?: string;
  isAuthenticator?: boolean;
  isCreateChannel?: boolean;
  isUploadAvatar?: boolean;
  avatarUrl?: string;
  imageName?: string;
}

export interface AccountsResponse {
  success: boolean;
  data: Account[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ImportChannelsResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface RetryVerifyResponse {
  success: boolean;
  message: string;
  data: {
    id: number;
    email: string;
    channelName?: string;
    channelLink?: string;
    is_authenticator: boolean;
    is_create_channel: boolean;
  };
  error?: string;
}

export interface UploadVideoRequest {
  id?: number;
  email?: string;
  sourceUrl?: string; // Optional when uploading file
  videoFile?: File; // For direct file upload
  title?: string;
  description?: string;
  visibility?: 'public' | 'unlisted' | 'private';
  tags?: string[];
  scheduleDate?: string; // ISO format: '2025-01-27T20:00:00'
}

export interface UploadVideoResponse {
  success: boolean;
  message: string;
  data?: {
    email: string;
    videoUrl: string;
    title: string;
    visibility: string;
    download?: {
      filePath: string;
      title: string;
      description: string;
    };
    upload?: {
      email: string;
      videoUrl: string;
      title: string;
      visibility: string;
    };
  };
  error?: string;
}

export interface BatchUploadVideoItem {
  sourceUrl: string;
  title?: string;
  description?: string;
  visibility?: 'public' | 'unlisted' | 'private';
  tags?: string[];
  scheduleDate?: string;
}

export interface CreateUploadCampaignRequest {
  id?: number;
  email?: string;
  name?: string;
  scheduledStartAt?: string;
  visibility?: 'public' | 'unlisted' | 'private';
  scheduleDate?: string;
  videos: Array<{ sourceUrl: string; title?: string; description?: string }>;
}

export interface UploadCampaignVideo {
  id: number;
  order_index: number;
  title: string | null;
  source_url: string;
  status: 'pending' | 'downloading' | 'uploading' | 'completed' | 'failed' | 'skipped';
  video_url: string | null;
  error_message: string | null;
  uploaded_at: string | null;
}

export interface UploadCampaign {
  id: number;
  name: string;
  email: string;
  status: 'new' | 'running' | 'pending' | 'done';
  scheduled_start_at: string | null;
  total_videos: number;
  completedVideos: number;
  failedVideos: number;
  pendingVideos: number;
  activeVideos: number;
  videos: UploadCampaignVideo[];
  account?: { id: number; email: string; channel_name: string | null };
  createdAt: string;
}

export interface BatchUploadRequest {
  id?: number;
  email?: string;
  videos: BatchUploadVideoItem[];
}

export interface BatchUploadResult {
  index: number;
  sourceUrl: string;
  success: boolean;
  message: string;
  videoUrl?: string;
  error?: string;
}

export interface UploadedVideo {
  id: number;
  account_youtube_id: number;
  email: string;
  video_url: string | null;
  title: string | null;
  source_url: string | null;
  video_visibility: 'public' | 'unlisted' | 'private';
  schedule_date: string | null;
  scheduled_start_at: string | null;
  status: 'pending' | 'downloading' | 'uploading' | 'completed' | 'failed' | 'skipped';
  error_message: string | null;
  uploaded_at: string | null;
  created_at: string;
  updated_at: string;
  account?: { id: number; email: string; channel_name: string | null; channel_link: string | null };
}

export interface UploadedVideosResponse {
  success: boolean;
  data: UploadedVideo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface BatchUploadResponse {
  success: boolean;
  message: string;
  data?: {
    results: BatchUploadResult[];
    summary: {
      total: number;
      success: number;
      failed: number;
    };
  };
}

// AdSense check result type
export interface AdsenseCheckResult {
  email: string;
  success: boolean;
  status: 'ok' | 'fail';
  message: string;
  screenshotBase64?: string | null;
}

export interface AdsenseCheckResponse {
  success: boolean;
  count: number;
  data: AdsenseCheckResult[];
}

// Helper function for API requests
async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = buildApiUrl(endpoint);
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Watch API
export const watchAPI = {
  // Watch video batch
  watchBatch: (data: WatchVideoRequest): Promise<WatchVideoResponse> => {
    return request<WatchVideoResponse>(API_ENDPOINTS.WATCH.BATCH, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// Accounts API
export const accountsAPI = {
  // Get accounts with pagination and search
  getAccounts: (params?: { 
    page?: number; 
    limit?: number; 
    search?: string 
  }): Promise<AccountsResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.search) searchParams.append('search', params.search);
    
    const endpoint = `${API_ENDPOINTS.ACCOUNTS.LIST}?${searchParams.toString()}`;
    return request<AccountsResponse>(endpoint);
  },
  
  // Import channels from CSV (with optional avatars ZIP)
  importChannels: async (csvFile: File, avatarsZip?: File): Promise<ImportChannelsResponse> => {
    const formData = new FormData();
    formData.append('file', csvFile);
    if (avatarsZip) {
      formData.append('avatars', avatarsZip);
    }
    
    const url = buildApiUrl(API_ENDPOINTS.AUTHENTICATOR);
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header - browser will set it with boundary for multipart/form-data
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Import failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    
    return response.json();
  },
  
  // Retry verify authenticator and create channel for account by ID
  retryVerify: async (id: number): Promise<RetryVerifyResponse> => {
    const url = buildApiUrl(API_ENDPOINTS.AUTHENTICATOR_RETRY(id));
    const response = await fetch(url, {
      method: 'POST',
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Retry verify failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    
    return response.json();
  },
  
  // Upload avatars for accounts that failed
  uploadAvatars: async (): Promise<any> => {
    const url = buildApiUrl('/api/v1/youtube/upload-avatar');
    const response = await fetch(url, {
      method: 'POST',
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload avatars failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    
    return response.json();
  },

  // Upload avatar for single account
  uploadAvatarSingle: async (accountId: number): Promise<any> => {
    const url = buildApiUrl(`/api/v1/youtube/upload-avatar/${accountId}`);
    const response = await fetch(url, {
      method: 'POST',
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload avatar failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    
    return response.json();
  },

  // Update avatar URL for account
  updateAvatarUrl: async (accountId: number, avatarUrl: string): Promise<any> => {
    const url = buildApiUrl(`/api/v1/accounts/${accountId}/avatar-url`);
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ avatarUrl }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Update avatar URL failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    
    return response.json();
  },

  // Delete all accounts
  deleteAllAccounts: async (): Promise<any> => {
    const url = buildApiUrl(API_ENDPOINTS.ACCOUNTS.DELETE_ALL);
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Delete all accounts failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    return response.json();
  },

  // Delete account by ID
  deleteAccount: async (accountId: number): Promise<any> => {
    const url = buildApiUrl(API_ENDPOINTS.ACCOUNTS.DELETE(accountId));
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Delete account failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    return response.json();
  },
};

// Upload API
export const uploadAPI = {
  // Download video from URL and upload to YouTube
  downloadAndUpload: async (data: UploadVideoRequest): Promise<UploadVideoResponse> => {
    // If uploading a file, use FormData
    if (data.videoFile) {
      const formData = new FormData();
      if (data.id) formData.append('id', data.id.toString());
      if (data.email) formData.append('email', data.email);
      formData.append('videoFile', data.videoFile);
      if (data.title) formData.append('title', data.title);
      if (data.description) formData.append('description', data.description);
      if (data.visibility) formData.append('visibility', data.visibility);
      if (data.scheduleDate) formData.append('scheduleDate', data.scheduleDate);
      if (data.tags) formData.append('tags', JSON.stringify(data.tags));

      const url = buildApiUrl(API_ENDPOINTS.UPLOAD.DOWNLOAD_AND_UPLOAD);
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return response.json();
    }

    // Otherwise, use JSON for URL-based download
    return request<UploadVideoResponse>(API_ENDPOINTS.UPLOAD.DOWNLOAD_AND_UPLOAD, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Get uploaded videos list
  getUploadedVideos: (params?: { 
    page?: number; 
    limit?: number; 
    search?: string 
  }): Promise<UploadedVideosResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.search) searchParams.append('search', params.search);
    
    const endpoint = `${API_ENDPOINTS.UPLOAD.VIDEOS}?${searchParams.toString()}`;
    return request<UploadedVideosResponse>(endpoint);
  },

  // Batch upload videos (max 15 videos at once)
  batchUpload: (data: BatchUploadRequest): Promise<BatchUploadResponse> => {
    return request<BatchUploadResponse>(API_ENDPOINTS.UPLOAD.BATCH_UPLOAD, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Batch upload files from computer (max 15 files at once)
  batchUploadFiles: async (formData: FormData): Promise<BatchUploadResponse> => {
    const url = buildApiUrl(API_ENDPOINTS.UPLOAD.BATCH_UPLOAD_FILES);
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Batch file upload failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  },

  // Create upload campaign (cron processes videos sequentially, 1 campaign at a time)
  createUploadCampaign: (data: CreateUploadCampaignRequest): Promise<{ success: boolean; message: string; data?: { id: number; name: string; status: string; totalVideos: number; scheduledStartAt: string | null } }> => {
    return request(API_ENDPOINTS.UPLOAD.CAMPAIGNS, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Get upload campaigns with progress
  getUploadCampaigns: (params?: { status?: string; page?: number; limit?: number }): Promise<{ success: boolean; data: UploadCampaign[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    return request(`${API_ENDPOINTS.UPLOAD.CAMPAIGNS}?${searchParams.toString()}`);
  },

  // Hold / release / cancel a campaign
  updateUploadCampaignStatus: async (id: number, action: 'hold' | 'release' | 'cancel'): Promise<{ success: boolean; data: { id: number; status: string } }> => {
    const url = buildApiUrl(API_ENDPOINTS.UPLOAD.CAMPAIGN_STATUS(id));
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Update failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    return response.json();
  },
};

// AdSense API
export const adsenseAPI = {
  // Upload CSV file (multipart/form-data with field 'file') and check accounts
  checkCsv: async (formData: FormData): Promise<any> => {
    const url = buildApiUrl('/api/v1/accounts/adsense/check');
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      // Try parse JSON error, otherwise throw generic
      const ct = response.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const err = await response.json().catch(() => ({ message: 'Adsense check failed' }));
        throw new Error(err.message || `HTTP ${response.status}`);
      }
      const txt = await response.text().catch(() => 'Request failed');
      throw new Error(txt || `HTTP ${response.status}`);
    }

    // Handle CSV response (download) or JSON
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/csv') || contentType.includes('application/csv')) {
      const blob = await response.blob();
      // Try to extract filename from content-disposition
      const disposition = response.headers.get('content-disposition') || '';
      let filename = 'adsense-results.csv';
      const match = disposition.match(/filename\*=UTF-8''([^;\n\r]+)/i) || disposition.match(/filename="?([^";]+)"?/i);
      if (match && match[1]) {
        filename = decodeURIComponent(match[1]);
      }
      return { isCsv: true, blob, filename };
    }

    // Otherwise parse JSON
    const json = await response.json().catch(() => null);
    return json;
  }
};

export interface SetupStatus {
  connected: boolean;
  totalMigrations: number;
  executedMigrations: number;
  pendingMigrations: number;
  migrations: { name: string; executed_at: string }[];
}

export interface MigrateResponse {
  success: boolean;
  message: string;
  data: { migrated: string[]; message: string };
}

// Setup API
export const setupAPI = {
  getStatus: (): Promise<{ success: boolean; data: SetupStatus }> =>
    request(API_ENDPOINTS.SETUP.STATUS),

  migrate: (): Promise<MigrateResponse> =>
    request(API_ENDPOINTS.SETUP.MIGRATE, { method: 'POST' }),

  pull: (): Promise<{ success: boolean; data: { output: string; message: string } }> =>
    request(API_ENDPOINTS.SETUP.PULL, { method: 'POST' }),
};

// Export a combined API object
export const api = {
  watch: watchAPI,
  accounts: accountsAPI,
  upload: uploadAPI,
  adsense: adsenseAPI,
  setup: setupAPI,
};

export default api;

