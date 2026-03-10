export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3006';

export const API_ENDPOINTS = {
  ACCOUNTS: {
    LIST: '/api/v1/accounts',
    EXPORT: '/api/v1/accounts/export',
    OPEN_BROWSER: (id: number) => `/api/v1/accounts/${id}/open-browser`,
    DELETE: (id: number) => `/api/v1/accounts/${id}`
  },
  WATCH: {
    BATCH: '/api/v1/watch/video',
    BATCH_ACCOUNTS: '/api/v1/watch/batch-accounts',
  },
  UPLOAD: {
    DOWNLOAD_AND_UPLOAD: '/api/v1/upload/download-and-upload',
    BATCH_UPLOAD: '/api/v1/upload/batch-upload',
    BATCH_UPLOAD_FILES: '/api/v1/upload/batch-upload-files',
    YOUTUBE: '/api/v1/upload/youtube',
    DOWNLOAD: '/api/v1/upload/download',
    DOWNLOADS: '/api/v1/upload/downloads',
    VIDEOS: '/api/v1/upload/videos',
  },
  AUTHENTICATOR: '/api/v1/authenticator',
  AUTHENTICATOR_RETRY: (id: number) => `/api/v1/authenticator/retry/${id}`,
};

export const buildApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};
