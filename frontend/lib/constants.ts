export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3006';

export const API_ENDPOINTS = {
  ACCOUNTS: {
    LIST: '/api/v1/accounts',
    EXPORT: '/api/v1/accounts/export',
    OPEN_BROWSER: (id: number) => `/api/v1/accounts/${id}/open-browser`,
    DELETE: (id: number) => `/api/v1/accounts/${id}`,
    DELETE_ALL: '/api/v1/accounts',
    DELETE_BULK: '/api/v1/accounts/bulk'
  },
  WATCH: {
    BATCH: '/api/v1/watch/video',
    BATCH_ACCOUNTS: '/api/v1/watch/batch-accounts',
  },
  CAMPAIGNS: {
    LIST: '/api/v1/campaigns',
    CREATE: '/api/v1/campaigns',
    GET: (id: number) => `/api/v1/campaigns/${id}`,
    HOLD: (id: number) => `/api/v1/campaigns/${id}/hold`,
    RELEASE: (id: number) => `/api/v1/campaigns/${id}/release`,
    STOP: (id: number) => `/api/v1/campaigns/${id}/stop`,
    DELETE: (id: number) => `/api/v1/campaigns/${id}`,
  },
  UPLOAD: {
    DOWNLOAD_AND_UPLOAD: '/api/v1/upload/download-and-upload',
    BATCH_UPLOAD: '/api/v1/upload/batch-upload',
    BATCH_UPLOAD_FILES: '/api/v1/upload/batch-upload-files',
    YOUTUBE: '/api/v1/upload/youtube',
    DOWNLOAD: '/api/v1/upload/download',
    DOWNLOADS: '/api/v1/upload/downloads',
    VIDEOS: '/api/v1/upload/videos',
    CAMPAIGNS: '/api/v1/upload/campaigns',
    CAMPAIGNS_FILES: '/api/v1/upload/campaigns/files',
    CAMPAIGN_STATUS: (id: number) => `/api/v1/upload/campaigns/${id}/status`,
    CAMPAIGN_VIDEO_DELETE: (campaignId: number, videoId: number) => `/api/v1/upload/campaigns/${campaignId}/videos/${videoId}`,
  },
  AUTHENTICATOR: '/api/v1/authenticator',
  AUTHENTICATOR_RETRY: (id: number) => `/api/v1/authenticator/retry/${id}`,
  SETUP: {
    STATUS: '/api/v1/setup/status',
    MIGRATE: '/api/v1/setup/migrate',
    PULL: '/api/v1/setup/pull',
  },
};

export const buildApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};
