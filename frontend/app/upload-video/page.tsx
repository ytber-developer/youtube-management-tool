'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, CheckCircle, XCircle, Loader2, Search, ChevronDown, FileVideo, Link2 } from 'lucide-react';
import { api, type Account, type BatchUploadVideoItem, type BatchUploadResult } from '@/lib/api';

export default function UploadVideoPage() {
  const [channels, setChannels] = useState<Account[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
  const [uploadMode, setUploadMode] = useState<'url' | 'file'>('url');
  const [urlsText, setUrlsText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  // Track concurrent upload jobs so multiple channels can upload simultaneously
  const [uploads, setUploads] = useState<Array<{
    id: number;
    channelId: number;
    channelName?: string;
    mode: 'url' | 'file';
    itemCount: number;
    status: 'uploading' | 'success' | 'failed';
    message?: string;
    results?: BatchUploadResult[];
    startedAt: number;
  }>>([]);
  const [results, setResults] = useState<BatchUploadResult[] | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [globalVisibility, setGlobalVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [globalScheduleDate, setGlobalScheduleDate] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadChannels();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Validate HTTP/HTTPS URL
  const isValidHttpUrl = (s: string) => {
    try {
      const u = new URL(s);
      return (u.protocol === 'http:' || u.protocol === 'https:');
    } catch (e) {
      return false;
    }
  };

  // Parse lines into video items supporting optional "url|title" format
  const parseVideoItems = (text: string): Array<{ sourceUrl: string; title?: string | null }> => {
    if (!text) return [];

    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // Split at first '|' only — allow '|' inside title
        const pipeIndex = line.indexOf('|');
        if (pipeIndex >= 0) {
          const urlPart = line.slice(0, pipeIndex).trim();
          const titlePart = line.slice(pipeIndex + 1).trim();
          return { sourceUrl: urlPart, title: titlePart === '' ? null : titlePart };
        }
        return { sourceUrl: line, title: null };
      })
      .filter(item => item.sourceUrl && isValidHttpUrl(item.sourceUrl));
  };

  // Backwards-compatible small helper: return just URLs (used nowhere now but kept for clarity)
  const extractUrls = (text: string): string[] => parseVideoItems(text).map(i => i.sourceUrl);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length > 15) {
      alert('Tối đa 15 files mỗi lần upload');
      return;
    }

    // Validate file types (video only)
    const validFiles = files.filter(file => {
      const isVideo = file.type.startsWith('video/');
      if (!isVideo) {
        alert(`File "${file.name}" không phải là video`);
      }
      return isVideo;
    });

    setSelectedFiles(validFiles);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedChannel) {
      alert('Vui lòng chọn kênh YouTube');
      return;
    }

    // Validate based on upload mode
    if (uploadMode === 'url') {
      const videoItems = parseVideoItems(urlsText);

      if (videoItems.length === 0) {
        alert('Vui lòng nhập ít nhất 1 URL video (mỗi URL trên 1 dòng)');
        return;
      }

      if (videoItems.length > 15) {
        alert('Tối đa 15 videos mỗi lần upload. Bạn đã nhập ' + videoItems.length + ' URLs');
        return;
      }

      // create upload job and run asynchronously
      setResults(null);
      const jobId = Date.now();
      const channelName = selectedChannelData?.channelName;
      const job = {
        id: jobId,
        channelId: selectedChannel,
        channelName,
        mode: 'url' as const,
        itemCount: videoItems.length,
        status: 'uploading' as const,
        message: 'Đang upload...',
        results: undefined,
        startedAt: Date.now()
      };
      setUploads(prev => [job, ...prev]);

      (async () => {
        try {
          // Build videos array from parsed lines (support optional per-line title)
          const videos: BatchUploadVideoItem[] = videoItems.map(item => ({
            sourceUrl: item.sourceUrl,
            title: item.title || undefined,
            visibility: globalVisibility,
            scheduleDate: globalScheduleDate || undefined,
          }));

          // Call batch upload API
          const response = await api.upload.batchUpload({
            id: selectedChannel as number,
            videos,
          });

          // update job
          setUploads(prev => prev.map(j => j.id === jobId ? {
            ...j,
            status: 'success',
            message: 'Hoàn tất',
            results: response.data?.results || []
          } : j));

          // also update global results display to show last batch results
          setResults(response.data?.results || []);

          if (response.success && response.data?.summary.success) {
            setUrlsText('');
          }
        } catch (error: any) {
          setUploads(prev => prev.map(j => j.id === jobId ? ({ ...j, status: 'failed', message: error?.message || 'Upload failed' }) : j));
          setResults(prev => prev); // keep previous results
          // also show simple alert
          alert(error?.message || 'Upload failed');
        }
      })();
    } else {
      // Upload files from computer
      if (selectedFiles.length === 0) {
        alert('Vui lòng chọn ít nhất 1 file video');
        return;
      }

      if (selectedFiles.length > 15) {
        alert('Tối đa 15 files mỗi lần upload');
        return;
      }

      // create job and run async
      const jobId = Date.now();
      const channelName = selectedChannelData?.channelName;
      const job = {
        id: jobId,
        channelId: selectedChannel as number,
        channelName,
        mode: 'file' as const,
        itemCount: selectedFiles.length,
        status: 'uploading' as const,
        message: 'Đang upload...',
        results: undefined,
        startedAt: Date.now()
      };
      setUploads(prev => [job, ...prev]);

      (async () => {
        try {
          const formData = new FormData();
          formData.append('id', (selectedChannel as number).toString());
          formData.append('visibility', globalVisibility);
          if (globalScheduleDate) {
            formData.append('scheduleDate', globalScheduleDate);
          }

          selectedFiles.forEach((file) => {
            formData.append('video', file);
          });

          const response = await api.upload.batchUploadFiles(formData);

          setUploads(prev => prev.map(j => j.id === jobId ? ({
            ...j,
            status: 'success',
            message: 'Hoàn tất',
            results: response.data?.results || []
          }) : j));

          setResults(response.data?.results || []);

          if (response.success && response.data?.summary.success) {
            setSelectedFiles([]);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        } catch (error: any) {
          setUploads(prev => prev.map(j => j.id === jobId ? ({ ...j, status: 'failed', message: error?.message || 'Upload failed' }) : j));
          alert(error?.message || 'Upload failed');
        }
      })();
    }
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setHours(now.getHours() + 2);
    return now.toISOString().slice(0, 16);
  };

  const filteredChannels = channels.filter(channel => {
    const query = searchQuery.toLowerCase();
    const channelName = (channel.channelName || '').toLowerCase();
    const email = (channel.email || '').toLowerCase();
    return channelName.includes(query) || email.includes(query);
  });

  const selectedChannelData = channels.find(c => c.id === selectedChannel);
  const urlCount = parseVideoItems(urlsText).length;
  const fileCount = selectedFiles.length;
  const itemCount = uploadMode === 'url' ? urlCount : fileCount;
  const successCount = results?.filter(r => r.success).length || 0;
  const totalCount = results?.length || 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">🎬 Upload Video</h1>
        <p className="text-sm text-gray-600 mt-2">
          Upload tối đa <span className="font-semibold text-blue-600">15 videos</span> cùng lúc.{' '}
          <span className="font-semibold">Nhập URLs</span> để tải từ TikTok, Facebook... hoặc{' '}
          <span className="font-semibold">Chọn files</span> từ máy tính.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Channel Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              🎯 Kênh YouTube
            </label>
            {loadingChannels ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2 text-sm text-gray-600">Đang tải danh sách kênh...</span>
              </div>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-left flex items-center justify-between hover:bg-gray-50 hover:border-blue-400 transition-all"
                >
                  {selectedChannelData ? (
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">
                        {selectedChannelData.channelName || 'Chưa có tên kênh'}
                      </div>
                      <div className="text-xs text-gray-500 truncate mt-0.5">
                        {selectedChannelData.email}
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-500">-- Chọn kênh YouTube --</span>
                  )}
                  <ChevronDown className={`w-5 h-5 text-gray-400 ml-2 transition-transform ${isDropdownOpen ? 'transform rotate-180' : ''}`} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute z-20 w-full mt-2 bg-white border-2 border-gray-300 rounded-lg shadow-xl max-h-96 overflow-hidden">
                    <div className="p-3 border-b-2 border-gray-200 sticky top-0 bg-white">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Tìm kiếm kênh hoặc email..."
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>

                    <div className="max-h-72 overflow-y-auto">
                      {filteredChannels.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-gray-500">
                          Không tìm thấy kênh nào
                        </div>
                      ) : (
                        filteredChannels.map((channel) => (
                          <button
                            key={channel.id}
                            type="button"
                            onClick={() => {
                              setSelectedChannel(channel.id);
                              setIsDropdownOpen(false);
                              setSearchQuery('');
                            }}
                            className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                              selectedChannel === channel.id ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 text-sm truncate">
                                  {channel.channelName || 'Chưa có tên kênh'}
                                </div>
                                <div className="text-xs text-gray-500 truncate mt-0.5">
                                  {channel.email}
                                </div>
                              </div>
                              {selectedChannel === channel.id && (
                                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Upload Mode Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              📋 Chọn cách upload
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  setUploadMode('url');
                  setResults(null);
                }}
                className={`p-4 rounded-lg border-2 transition-all ${
                  uploadMode === 'url'
                    ? 'bg-blue-50 border-blue-600 shadow-md'
                    : 'bg-white border-gray-300 hover:border-blue-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Link2 className={`w-6 h-6 ${uploadMode === 'url' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <div className="text-left">
                    <div className={`font-semibold ${uploadMode === 'url' ? 'text-blue-900' : 'text-gray-700'}`}>
                      Nhập URLs
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Tải video từ TikTok, Facebook, Instagram...
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUploadMode('file');
                  setResults(null);
                }}
                className={`p-4 rounded-lg border-2 transition-all ${
                  uploadMode === 'file'
                    ? 'bg-blue-50 border-blue-600 shadow-md'
                    : 'bg-white border-gray-300 hover:border-blue-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileVideo className={`w-6 h-6 ${uploadMode === 'file' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <div className="text-left">
                    <div className={`font-semibold ${uploadMode === 'file' ? 'text-blue-900' : 'text-gray-700'}`}>
                      Chọn Files
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Upload video từ máy tính (tối đa 15 files)
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* URLs Input or File Picker */}
          {uploadMode === 'url' ? (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🔗 Danh sách URLs {urlCount > 0 && (
                  <span className={`ml-2 text-xs font-medium px-2 py-1 rounded ${
                    urlCount > 15 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {urlCount}/15 videos
                  </span>
                )}
              </label>
              <textarea
                value={urlsText}
                onChange={(e) => setUrlsText(e.target.value)}
                placeholder={`Nhập URLs của video (mỗi URL trên 1 dòng, tối đa 15 URLs). Ghi chú: bạn có thể truyền kèm tiêu đề bằng cú pháp:\nhttps://...| Your title here\nNếu không có '|' tiêu đề sẽ được lấy từ metadata hoặc để trống.

Ví dụ:
https://www.facebook.com/reel/123456789
https://www.tiktok.com/@user/video/123456789
https://www.instagram.com/reel/ABC123/
https://drive.google.com/file/d/...
`}
                rows={12}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono resize-none"
                required
              />
              <p className="text-xs text-gray-500 mt-2">
                ✅ Hỗ trợ: Facebook, TikTok, Instagram, Twitter, Google Drive, và nhiều nền tảng khác
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📁 Chọn video files {fileCount > 0 && (
                  <span className={`ml-2 text-xs font-medium px-2 py-1 rounded ${
                    fileCount > 15 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {fileCount}/15 files
                  </span>
                )}
              </label>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
              >
                <FileVideo className="w-12 h-12 text-gray-400 mb-2" />
                <span className="text-sm font-medium text-gray-700">Click để chọn files</span>
                <span className="text-xs text-gray-500 mt-1">Hoặc kéo thả files vào đây</span>
                <span className="text-xs text-gray-400 mt-2">Tối đa 15 files, định dạng video (.mp4, .mov, .avi...)</span>
              </label>

              {selectedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} đã chọn
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFiles([]);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-xs text-red-600 hover:text-red-800 font-medium"
                    >
                      Xóa tất cả
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-3">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileVideo className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {file.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatFileSize(file.size)}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="ml-2 text-red-600 hover:text-red-800 flex-shrink-0"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Global Settings */}
          <div className="border-t-2 border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">⚙️ Cài đặt chung cho tất cả videos</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Visibility */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Chế độ hiển thị
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['public', 'unlisted', 'private'] as const).map((vis) => (
                    <button
                      key={vis}
                      type="button"
                      onClick={() => setGlobalVisibility(vis)}
                      className={`px-3 py-2 rounded-md border-2 text-xs font-medium transition-all ${
                        globalVisibility === vis
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      {vis === 'public' && '�� Public'}
                      {vis === 'unlisted' && '🔗 Unlisted'}
                      {vis === 'private' && '🔒 Private'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Schedule Date */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Lên lịch đăng (tùy chọn)
                </label>
                <input
                  type="datetime-local"
                  value={globalScheduleDate}
                  onChange={(e) => setGlobalScheduleDate(e.target.value)}
                  min={getMinDateTime()}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Để trống để đăng ngay
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!selectedChannel || itemCount === 0 || itemCount > 15}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center text-base shadow-lg disabled:shadow-none"
          >
            <>
              <Upload className="w-5 h-5 mr-2" />
              Upload {itemCount} {uploadMode === 'url' ? 'Video' : 'File'}{itemCount > 1 ? 's' : ''}
            </>
           </button>
         </form>

        {/* Active upload jobs */}
        {uploads.length > 0 && (
          <div className="mt-6 space-y-2">
            {uploads.map(job => (
              <div key={job.id} className={`p-3 rounded-md border ${job.status === 'uploading' ? 'border-blue-300 bg-blue-50' : job.status === 'success' ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    {job.mode === 'url' ? 'URL upload' : 'File upload'} • {job.channelName || job.channelId}
                    <div className="text-xs text-gray-600">{job.itemCount} items • {job.status}</div>
                  </div>
                  <div className="text-sm font-medium">
                    {job.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                    {job.status === 'success' && <CheckCircle className="w-4 h-4 text-green-600" />}
                    {job.status === 'failed' && <XCircle className="w-4 h-4 text-red-600" />}
                  </div>
                </div>
                {job.message && <div className="text-xs text-gray-700 mt-2 font-mono">{job.message}</div>}
                {job.results && job.results.length > 0 && (
                  <div className="text-xs text-gray-700 mt-2">
                    {job.results.map(r => (
                      <div key={r.index} className="truncate">#{r.index} - {r.message}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
