'use client';

import { useState, useEffect } from 'react';
import { Search, ExternalLink, Calendar, Loader2, ChevronLeft, ChevronRight, Upload, X, CheckCircle, XCircle } from 'lucide-react';
import { api, type UploadedVideo, type Account, type UploadVideoRequest } from '@/lib/api';

interface UploadResult {
  success: boolean;
  message: string;
  videoUrl?: string;
}

export default function ListVideosPage() {
  const [videos, setVideos] = useState<UploadedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Upload modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [channels, setChannels] = useState<Account[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
  const [uploadMode, setUploadMode] = useState<'url' | 'file'>('url'); // Toggle between URL and File
  const [sourceUrl, setSourceUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [scheduleDate, setScheduleDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(false);

  useEffect(() => {
    loadVideos();
  }, [page, search]);

  const loadVideos = async () => {
    try {
      setLoading(true);
      const response = await api.upload.getUploadedVideos({
        page,
        limit,
        search
      });
      setVideos(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotal(response.pagination.total);
    } catch (error) {
      console.error('Failed to load videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChannels = async () => {
    try {
      setLoadingChannels(true);
      const response = await api.accounts.getAccounts({ limit: 1000 });
      setChannels(response.data);
    } catch (error) {
      console.error('Failed to load channels:', error);
    } finally {
      setLoadingChannels(false);
    }
  };

  const openUploadModal = () => {
    setShowUploadModal(true);
    loadChannels();
    // Reset form
    setSelectedChannel(null);
    setUploadMode('url');
    setSourceUrl('');
    setVideoFile(null);
    setTitle('');
    setDescription('');
    setVisibility('public');
    setScheduleDate('');
    setUploadResult(null);
  };

  const closeUploadModal = () => {
    setShowUploadModal(false);
    setUploadResult(null);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate based on upload mode
    if (!selectedChannel) {
      setUploadResult({
        success: false,
        message: 'Vui lòng chọn kênh YouTube'
      });
      return;
    }

    if (uploadMode === 'url' && !sourceUrl) {
      setUploadResult({
        success: false,
        message: 'Vui lòng nhập link video'
      });
      return;
    }

    if (uploadMode === 'file' && !videoFile) {
      setUploadResult({
        success: false,
        message: 'Vui lòng chọn file video'
      });
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const uploadData: UploadVideoRequest = {
        id: selectedChannel,
        visibility,
        scheduleDate: scheduleDate || undefined,
      };

      // Add title and description if provided
      if (title) uploadData.title = title;
      if (description) uploadData.description = description;

      // Add either sourceUrl or videoFile
      if (uploadMode === 'url') {
        uploadData.sourceUrl = sourceUrl;
      } else {
        uploadData.videoFile = videoFile!;
      }

      const response = await api.upload.downloadAndUpload(uploadData);
      
      setUploadResult({
        success: response.success,
        message: response.message,
        videoUrl: response.data?.videoUrl,
      });

      // Reload videos list on success
      if (response.success) {
        setTimeout(() => {
          loadVideos();
          closeUploadModal();
        }, 2000);
      }
    } catch (error: any) {
      setUploadResult({
        success: false,
        message: error.message || 'Upload failed'
      });
    } finally {
      setUploading(false);
    }
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setHours(now.getHours() + 2);
    return now.toISOString().slice(0, 16);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1); // Reset to first page on search
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const extractVideoId = (url: string | null | undefined) => {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/);
    return match ? match[1] : null;
  };

  const getThumbnail = (videoUrl: string | null | undefined) => {
    if (!videoUrl) return null;
    const videoId = extractVideoId(videoUrl);
    return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Danh Sách Video</h1>
          <p className="text-sm text-gray-600 mt-1">
            {total > 0 ? `${total} video đã upload` : 'Chưa có video nào'}
          </p>
        </div>
        <button
          onClick={openUploadModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload Video
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Tìm theo email, title, hoặc URL..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>
      </div>

      {/* Videos List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : videos.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500">Không tìm thấy video nào</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Video</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Kênh</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Ngày Upload</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {videos.map((video) => {
                  const thumbnail = getThumbnail(video.video_url);
                  return (
                    <tr key={video.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {thumbnail && (
                            <img
                              src={thumbnail}
                              alt={video.title || 'Video thumbnail'}
                              className="w-24 h-14 object-cover rounded"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {video.title || 'Untitled'}
                            </p>
                            {video.video_url ? (
                              <p className="text-xs text-gray-500 truncate">
                                ID: {extractVideoId(video.video_url) || 'N/A'}
                              </p>
                            ) : (
                              <p className="text-xs text-orange-500">
                                Chưa upload
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {video.account?.channel_name || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500">{video.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {video.source_url ? (
                          <a
                            href={video.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Link
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <Calendar className="w-3 h-3" />
                          {formatDate(video.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {video.video_url ? (
                          <a
                            href={video.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            YouTube
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400 px-3 py-1">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <p className="text-xs text-gray-600">
                Trang {page} / {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-xs font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded text-xs font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-gray-900">Upload Video</h2>
              <button
                onClick={closeUploadModal}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <form onSubmit={handleUploadSubmit} className="space-y-4">
                {/* Channel Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Kênh YouTube
                  </label>
                  {loadingChannels ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    </div>
                  ) : (
                    <select
                      value={selectedChannel || ''}
                      onChange={(e) => setSelectedChannel(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      required
                    >
                      <option value="">-- Chọn kênh --</option>
                      {channels.map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          {channel.channelName || channel.email}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Upload Mode Toggle */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Nguồn Video
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setUploadMode('url');
                        setVideoFile(null);
                      }}
                      className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                        uploadMode === 'url'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      🔗 Từ URL
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadMode('file');
                        setSourceUrl('');
                      }}
                      className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                        uploadMode === 'file'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      📁 Từ File
                    </button>
                  </div>
                </div>

                {/* Source Video URL (only show if mode is 'url') */}
                {uploadMode === 'url' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Link Video
                    </label>
                    <input
                      type="url"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      placeholder="https://www.facebook.com/reel/..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      required={uploadMode === 'url'}
                    />
                    <p className="text-xs text-gray-500 mt-1">Facebook, TikTok, Instagram, Google Drive, etc.</p>
                  </div>
                )}

                {/* Video File Upload (only show if mode is 'file') */}
                {uploadMode === 'file' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Chọn File Video
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="flex-1 cursor-pointer">
                        <div className={`px-3 py-2 border-2 border-dashed rounded-md text-center transition-colors ${
                          videoFile 
                            ? 'border-green-400 bg-green-50' 
                            : 'border-gray-300 hover:border-blue-400 bg-gray-50'
                        }`}>
                          <input
                            type="file"
                            accept="video/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setVideoFile(file);
                                // Auto-fill title from filename if empty
                                if (!title) {
                                  setTitle(file.name.replace(/\.[^/.]+$/, ''));
                                }
                              }
                            }}
                            className="hidden"
                            required={uploadMode === 'file'}
                          />
                          {videoFile ? (
                            <div className="text-xs">
                              <p className="font-medium text-green-700">✓ {videoFile.name}</p>
                              <p className="text-gray-500 mt-0.5">
                                {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">
                              <p>📤 Click để chọn file</p>
                              <p className="mt-0.5">MP4, MOV, AVI, etc.</p>
                            </div>
                          )}
                        </div>
                      </label>
                      {videoFile && (
                        <button
                          type="button"
                          onClick={() => setVideoFile(null)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Xóa file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Title (optional, but auto-filled for file uploads) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Tiêu đề (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={uploadMode === 'file' ? 'Tự động lấy từ tên file' : 'Tự động lấy từ video nguồn'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>

                {/* Description (optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Mô tả (tùy chọn)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Mô tả video..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                  />
                </div>

                {/* Visibility */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Hiển thị
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['public', 'unlisted', 'private'] as const).map((vis) => (
                      <button
                        key={vis}
                        type="button"
                        onClick={() => setVisibility(vis)}
                        className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                          visibility === vis
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {vis === 'public' && '🌍 Public'}
                        {vis === 'unlisted' && '🔗 Unlisted'}
                        {vis === 'private' && '🔒 Private'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Schedule Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Lên lịch (tùy chọn)
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={getMinDateTime()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Để trống để đăng ngay. Tối thiểu 2 giờ sau hiện tại.
                  </p>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={uploading || !selectedChannel || (uploadMode === 'url' ? !sourceUrl : !videoFile)}
                  className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-sm"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      {uploadMode === 'file' ? 'Đang upload...' : 'Đang xử lý...'}
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload lên YouTube
                    </>
                  )}
                </button>
              </form>

              {/* Upload Result */}
              {uploadResult && (
                <div className={`mt-4 p-3 rounded-md ${
                  uploadResult.success 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-start">
                    {uploadResult.success ? (
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className={`text-xs font-medium ${
                        uploadResult.success ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {uploadResult.message}
                      </p>
                      {uploadResult.videoUrl && (
                        <a
                          href={uploadResult.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                        >
                          Xem video →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
