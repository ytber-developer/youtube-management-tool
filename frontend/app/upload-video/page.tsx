'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, CheckCircle, XCircle, Loader2, Search, ChevronDown, FileVideo, Link2, Clock, Trash2, RefreshCw, ChevronUp } from 'lucide-react';
import { api, type Account, type BatchUploadVideoItem, type BatchUploadResult, type UploadCampaign } from '@/lib/api';

export default function UploadVideoPage() {
  const [channels, setChannels] = useState<Account[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
  const [uploadMode, setUploadMode] = useState<'url' | 'file'>('url');
  const [urlsText, setUrlsText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploads, setUploads] = useState<Array<{
    id: number; channelId: number; channelName?: string; mode: 'url' | 'file';
    itemCount: number; status: 'uploading' | 'success' | 'failed'; message?: string;
    results?: BatchUploadResult[]; startedAt: number;
  }>>([]);
  const [results, setResults] = useState<BatchUploadResult[] | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [globalVisibility, setGlobalVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [globalScheduleDate, setGlobalScheduleDate] = useState('');
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [videoSchedules, setVideoSchedules] = useState<Record<number, string>>({});
  const [urlRows, setUrlRows] = useState<Array<{ url: string; title: string; scheduledAt: string }>>([{ url: '', title: '', scheduledAt: '' }]);
  // Upload campaigns
  const [campaigns, setCampaigns] = useState<UploadCampaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<number>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadChannels();
    loadCampaigns();
  }, []);

  // Auto-refresh every 30s when any campaign is active
  useEffect(() => {
    const hasActive = campaigns.some(c => c.status === 'new' || c.status === 'running');
    if (!hasActive) return;
    const timer = setInterval(loadCampaigns, 30000);
    return () => clearInterval(timer);
  }, [campaigns]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadChannels = async () => {
    try {
      setLoadingChannels(true);
      const res = await api.accounts.getAccounts({ limit: 1000 });
      setChannels(res.data);
    } catch (e) { /* ignore */ } finally { setLoadingChannels(false); }
  };

  const loadCampaigns = async () => {
    try {
      setCampaignsLoading(true);
      const res = await api.upload.getUploadCampaigns({ limit: 50 });
      setCampaigns(res.data || []);
    } catch (e) { /* ignore */ } finally { setCampaignsLoading(false); }
  };

  const updateCampaignStatus = async (id: number, action: 'hold' | 'release' | 'cancel') => {
    const labels = { hold: 'tạm dừng', release: 'tiếp tục', cancel: 'hủy' };
    if (!confirm(`Bạn có chắc muốn ${labels[action]} campaign này?`)) return;
    try {
      await api.upload.updateUploadCampaignStatus(id, action);
      await loadCampaigns();
    } catch (e: any) { alert(e?.message || 'Failed'); }
  };

  const toggleExpand = (id: number) => {
    setExpandedCampaigns(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const isValidHttpUrl = (s: string) => {
    try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; }
    catch { return false; }
  };

  const parseVideoItems = (text: string): Array<{ sourceUrl: string; title?: string | null }> => {
    if (!text) return [];
    return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const p = line.indexOf('|');
      if (p >= 0) {
        const url = line.slice(0, p).trim();
        const title = line.slice(p + 1).trim();
        return { sourceUrl: url, title: title || null };
      }
      return { sourceUrl: line, title: null };
    }).filter(i => isValidHttpUrl(i.sourceUrl));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 15) { alert('Tối đa 15 files'); return; }
    setSelectedFiles(files.filter(f => { const ok = f.type.startsWith('video/'); if (!ok) alert(`"${f.name}" không phải video`); return ok; }));
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 Bytes';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannel) { alert('Vui lòng chọn kênh YouTube'); return; }

    if (uploadMode === 'url') {
      const videoItems = parseVideoItems(urlsText);
      if (!videoItems.length) { alert('Vui lòng nhập ít nhất 1 URL'); return; }
      if (videoItems.length > 15) { alert('Tối đa 15 URLs'); return; }

      // ── Hẹn giờ: đọc từ urlRows ────────────────────────────────────────────
      if (scheduleMode === 'later') {
        const validRows = urlRows.filter(r => isValidHttpUrl(r.url));
        if (!validRows.length) { alert('Vui lòng nhập ít nhất 1 URL hợp lệ'); return; }
        if (validRows.length > 15) { alert('Tối đa 15 URLs'); return; }
        try {
          const res = await api.upload.createUploadCampaign({
            id: selectedChannel,
            visibility: globalVisibility,
            scheduleDate: globalScheduleDate || undefined,
            videos: validRows.map(r => ({
              sourceUrl: r.url,
              title: r.title || undefined,
              scheduledStartAt: r.scheduledAt || undefined,
            })),
          });
          if (res.success) {
            setUrlRows([{ url: '', title: '', scheduledAt: '' }]);
            alert(res.message);
            await loadCampaigns();
          } else {
            alert(res.message || 'Tạo campaign thất bại');
          }
        } catch (err: any) { alert(err?.message || 'Failed'); }
        return;
      }

      // ── Upload ngay (batch, không qua queue) ───────────────────────────────
      setResults(null);
      const jobId = Date.now();
      const channelName = selectedChannelData?.channelName;
      setUploads(prev => [{ id: jobId, channelId: selectedChannel, channelName, mode: 'url', itemCount: videoItems.length, status: 'uploading', message: 'Đang upload...', startedAt: Date.now() }, ...prev]);

      (async () => {
        try {
          const videos: BatchUploadVideoItem[] = videoItems.map(i => ({ sourceUrl: i.sourceUrl, title: i.title || undefined, visibility: globalVisibility, scheduleDate: globalScheduleDate || undefined }));
          const res = await api.upload.batchUpload({ id: selectedChannel, videos });
          setUploads(prev => prev.map(j => j.id === jobId ? { ...j, status: 'success', message: 'Hoàn tất', results: res.data?.results || [] } : j));
          setResults(res.data?.results || []);
          if (res.success) setUrlsText('');
        } catch (err: any) {
          setUploads(prev => prev.map(j => j.id === jobId ? { ...j, status: 'failed', message: err?.message || 'Failed' } : j));
          alert(err?.message || 'Upload failed');
        }
      })();

    } else {
      // File upload
      if (!selectedFiles.length) { alert('Vui lòng chọn ít nhất 1 file'); return; }
      if (selectedFiles.length > 15) { alert('Tối đa 15 files'); return; }

      // ── Hẹn giờ: upload files lên server, tạo campaign ────────────────────
      if (scheduleMode === 'later') {
        try {
          const formData = new FormData();
          formData.append('id', selectedChannel.toString());
          formData.append('visibility', globalVisibility);
          if (globalScheduleDate) formData.append('scheduleDate', globalScheduleDate);
          selectedFiles.forEach((f, i) => {
            formData.append('video', f);
            if (videoSchedules[i]) formData.append(`scheduledStartAt_${i}`, videoSchedules[i]);
          });
          const res = await api.upload.createUploadCampaignFiles(formData);
          if (res.success) {
            setSelectedFiles([]);
            if (fileInputRef.current) fileInputRef.current.value = '';
            setVideoSchedules({});
            alert(res.message);
            await loadCampaigns();
          } else {
            alert(res.message || 'Tạo campaign thất bại');
          }
        } catch (err: any) { alert(err?.message || 'Failed'); }
        return;
      }

      // ── Upload ngay ────────────────────────────────────────────────────────
      const jobId = Date.now();
      const channelName = selectedChannelData?.channelName;
      setUploads(prev => [{ id: jobId, channelId: selectedChannel, channelName, mode: 'file', itemCount: selectedFiles.length, status: 'uploading', message: 'Đang upload...', startedAt: Date.now() }, ...prev]);

      (async () => {
        try {
          const formData = new FormData();
          formData.append('id', selectedChannel.toString());
          formData.append('visibility', globalVisibility);
          if (globalScheduleDate) formData.append('scheduleDate', globalScheduleDate);
          selectedFiles.forEach(f => formData.append('video', f));
          const res = await api.upload.batchUploadFiles(formData);
          setUploads(prev => prev.map(j => j.id === jobId ? { ...j, status: 'success', message: 'Hoàn tất', results: res.data?.results || [] } : j));
          setResults(res.data?.results || []);
          if (res.success) { setSelectedFiles([]); if (fileInputRef.current) fileInputRef.current.value = ''; }
        } catch (err: any) {
          setUploads(prev => prev.map(j => j.id === jobId ? { ...j, status: 'failed', message: err?.message || 'Failed' } : j));
          alert(err?.message || 'Upload failed');
        }
      })();
    }
  };

  const getMinDateTime = () => { const d = new Date(); d.setHours(d.getHours() + 2); return d.toISOString().slice(0, 16); };

  const filteredChannels = channels.filter(c => {
    const q = searchQuery.toLowerCase();
    return (c.channelName || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q);
  });

  const selectedChannelData = channels.find(c => c.id === selectedChannel);
  const urlCount = parseVideoItems(urlsText).length;
  const urlRowCount = urlRows.filter(r => isValidHttpUrl(r.url)).length;
  const itemCount = uploadMode === 'url'
    ? (scheduleMode === 'later' ? urlRowCount : urlCount)
    : selectedFiles.length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">🎬 Upload Video</h1>
        <p className="text-sm text-gray-600 mt-2">
          <span className="font-semibold">Upload ngay</span> hoặc <span className="font-semibold">hẹn giờ</span> — mỗi campaign upload tuần tự từng video, chỉ 1 campaign chạy tại 1 thời điểm.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Channel Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">🎯 Kênh YouTube</label>
            {loadingChannels ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2 text-sm text-gray-600">Đang tải...</span>
              </div>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <button type="button" onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm bg-white text-left flex items-center justify-between hover:bg-gray-50 hover:border-blue-400 transition-all">
                  {selectedChannelData ? (
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{selectedChannelData.channelName || 'Chưa có tên kênh'}</div>
                      <div className="text-xs text-gray-500 truncate mt-0.5">{selectedChannelData.email}</div>
                    </div>
                  ) : <span className="text-gray-500">-- Chọn kênh YouTube --</span>}
                  <ChevronDown className={`w-5 h-5 text-gray-400 ml-2 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {isDropdownOpen && (
                  <div className="absolute z-20 w-full mt-2 bg-white border-2 border-gray-300 rounded-lg shadow-xl max-h-96 overflow-hidden">
                    <div className="p-3 border-b-2 border-gray-200 sticky top-0 bg-white">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Tìm kênh hoặc email..."
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm" onClick={e => e.stopPropagation()} />
                      </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {filteredChannels.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-gray-500">Không tìm thấy kênh</div>
                      ) : filteredChannels.map(ch => (
                        <button key={ch.id} type="button" onClick={() => { setSelectedChannel(ch.id); setIsDropdownOpen(false); setSearchQuery(''); }}
                          className={`w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 ${selectedChannel === ch.id ? 'bg-blue-50' : ''}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 text-sm truncate">{ch.channelName || 'Chưa có tên kênh'}</div>
                              <div className="text-xs text-gray-500 truncate mt-0.5">{ch.email}</div>
                            </div>
                            {selectedChannel === ch.id && <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Upload Mode */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">📋 Chọn cách upload</label>
            <div className="grid grid-cols-2 gap-4">
              {(['url', 'file'] as const).map(mode => (
                <button key={mode} type="button" onClick={() => { setUploadMode(mode); setResults(null); }}
                  className={`p-4 rounded-lg border-2 transition-all ${uploadMode === mode ? 'bg-blue-50 border-blue-600 shadow-md' : 'bg-white border-gray-300 hover:border-blue-400'}`}>
                  <div className="flex items-center gap-3">
                    {mode === 'url' ? <Link2 className={`w-6 h-6 ${uploadMode === 'url' ? 'text-blue-600' : 'text-gray-400'}`} /> : <FileVideo className={`w-6 h-6 ${uploadMode === 'file' ? 'text-blue-600' : 'text-gray-400'}`} />}
                    <div className="text-left">
                      <div className={`font-semibold ${uploadMode === mode ? 'text-blue-900' : 'text-gray-700'}`}>{mode === 'url' ? 'Nhập URLs' : 'Chọn Files'}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{mode === 'url' ? 'TikTok, Facebook, Instagram...' : 'Upload file từ máy tính (tối đa 15)'}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* URL input */}
          {uploadMode === 'url' ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">
                  🔗 Danh sách URLs
                  {scheduleMode === 'later'
                    ? urlRows.filter(r => isValidHttpUrl(r.url)).length > 0 && <span className={`ml-2 text-xs font-medium px-2 py-1 rounded ${urlRows.filter(r => isValidHttpUrl(r.url)).length > 15 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{urlRows.filter(r => isValidHttpUrl(r.url)).length}/15</span>
                    : urlCount > 0 && <span className={`ml-2 text-xs font-medium px-2 py-1 rounded ${urlCount > 15 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{urlCount}/15</span>
                  }
                </label>
              </div>

              {scheduleMode === 'now' ? (
                <textarea value={urlsText} onChange={e => setUrlsText(e.target.value)} rows={10}
                  placeholder={`Mỗi URL trên 1 dòng. Hỗ trợ cú pháp: URL|Tiêu đề\n\nhttps://www.facebook.com/reel/...\nhttps://www.tiktok.com/@user/video/...\nhttps://www.facebook.com/reel/...|Tiêu đề tùy chọn`}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              ) : (
                <div className="space-y-2">
                  <div className="grid text-xs font-medium text-gray-400 px-1 pb-1" style={{ gridTemplateColumns: '1fr 150px 185px 28px' }}>
                    <span>URL video</span><span>Tiêu đề (tuỳ chọn)</span><span>⏰ Thời gian upload</span><span></span>
                  </div>
                  {urlRows.map((row, i) => (
                    <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr 150px 185px 28px' }}>
                      <input type="url" value={row.url}
                        onChange={e => setUrlRows(prev => prev.map((r, j) => j === i ? { ...r, url: e.target.value } : r))}
                        placeholder="https://www.facebook.com/reel/..."
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono" />
                      <input type="text" value={row.title}
                        onChange={e => setUrlRows(prev => prev.map((r, j) => j === i ? { ...r, title: e.target.value } : r))}
                        placeholder="Tên video..."
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      <input type="datetime-local" value={row.scheduledAt}
                        onChange={e => setUrlRows(prev => prev.map((r, j) => j === i ? { ...r, scheduledAt: e.target.value } : r))}
                        min={new Date().toISOString().slice(0, 16)}
                        className="w-full px-2 py-2 border-2 border-orange-300 rounded-lg text-xs focus:ring-2 focus:ring-orange-400 focus:border-orange-400 bg-orange-50" />
                      <button type="button"
                        onClick={() => setUrlRows(prev => prev.length === 1 ? [{ url: '', title: '', scheduledAt: '' }] : prev.filter((_, j) => j !== i))}
                        className="text-red-400 hover:text-red-600 flex items-center justify-center">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {urlRows.length < 15 && (
                    <button type="button"
                      onClick={() => setUrlRows(prev => [...prev, { url: '', title: '', scheduledAt: '' }])}
                      className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-all">
                      + Thêm video
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📁 Chọn video files
                {selectedFiles.length > 0 && <span className={`ml-2 text-xs font-medium px-2 py-1 rounded ${selectedFiles.length > 15 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{selectedFiles.length}/15</span>}
              </label>
              <input ref={fileInputRef} type="file" accept="video/*" multiple onChange={handleFileSelect} className="hidden" id="file-upload" />
              <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                <FileVideo className="w-10 h-10 text-gray-400 mb-2" />
                <span className="text-sm font-medium text-gray-700">Click để chọn files</span>
                <span className="text-xs text-gray-400 mt-1">Tối đa 15 files .mp4 .mov .avi</span>
              </label>
              {selectedFiles.length > 0 && (
                <div className="mt-3 space-y-1 border border-gray-200 rounded-lg p-2 bg-gray-50">
                  {scheduleMode === 'later' && (
                    <p className="text-xs font-medium text-orange-700 mb-2 px-1">⏰ Thời gian upload cho từng file (để trống = upload sớm nhất)</p>
                  )}
                  {selectedFiles.map((f, i) => (
                    <div key={i} className={`flex items-center gap-2 p-2 rounded ${scheduleMode === 'later' ? 'bg-white border border-orange-100' : 'bg-white'}`}>
                      <FileVideo className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span className="text-sm text-gray-800 truncate flex-1 min-w-0">{f.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{formatFileSize(f.size)}</span>
                      {scheduleMode === 'later' && (
                        <input type="datetime-local" value={videoSchedules[i] || ''} onChange={e => setVideoSchedules(prev => ({ ...prev, [i]: e.target.value }))}
                          min={new Date().toISOString().slice(0, 16)}
                          className="flex-shrink-0 text-xs px-2 py-1 border border-orange-300 rounded bg-white focus:ring-1 focus:ring-orange-400 focus:outline-none" />
                      )}
                      <button type="button" onClick={() => { setSelectedFiles(prev => prev.filter((_, j) => j !== i)); setVideoSchedules(prev => { const n = { ...prev }; delete n[i]; return n; }); }} className="ml-1 text-red-500 hover:text-red-700 flex-shrink-0">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Settings */}
          <div className="border-t-2 border-gray-200 pt-6 space-y-5">
            <h3 className="text-sm font-semibold text-gray-700">⚙️ Cài đặt</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Chế độ hiển thị</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['public', 'unlisted', 'private'] as const).map(vis => (
                    <button key={vis} type="button" onClick={() => setGlobalVisibility(vis)}
                      className={`px-3 py-2 rounded-md border-2 text-xs font-medium transition-all ${globalVisibility === vis ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'}`}>
                      {vis === 'public' ? '🌐 Public' : vis === 'unlisted' ? '🔗 Unlisted' : '🔒 Private'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Ngày YouTube đăng (tuỳ chọn)</label>
                <input type="datetime-local" value={globalScheduleDate} onChange={e => setGlobalScheduleDate(e.target.value)} min={getMinDateTime()}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-400 mt-1">Để trống = đăng ngay sau khi upload</p>
              </div>
            </div>

            {/* Upload timing */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">⏰ Thời điểm upload</label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setScheduleMode('now')}
                  className={`p-3 rounded-lg border-2 text-sm font-medium flex items-center justify-center gap-2 transition-all ${scheduleMode === 'now' ? 'bg-green-50 border-green-600 text-green-800 shadow-md' : 'bg-white border-gray-300 text-gray-700 hover:border-green-400'}`}>
                  <Upload className="w-4 h-4" /> Upload ngay
                </button>
                <button type="button" onClick={() => setScheduleMode('later')}
                  className={`p-3 rounded-lg border-2 text-sm font-medium flex items-center justify-center gap-2 transition-all ${scheduleMode === 'later' ? 'bg-orange-50 border-orange-500 text-orange-800 shadow-md' : 'bg-white border-gray-300 text-gray-700 hover:border-orange-400'}`}>
                  <Clock className="w-4 h-4" /> Hẹn giờ
                </button>
              </div>
              {scheduleMode === 'later' && (
                <p className="mt-2 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded p-2">
                  Nhập thời gian upload riêng cho từng video bên dưới. Cron chạy mỗi phút, upload <strong>tuần tự</strong> từng cái. Chỉ 1 campaign chạy tại 1 thời điểm.
                </p>
              )}
            </div>
          </div>

          {/* Submit */}
          <button type="submit" disabled={!selectedChannel || itemCount === 0 || itemCount > 15}
            className={`w-full text-white px-6 py-4 rounded-lg font-semibold flex items-center justify-center gap-2 text-base shadow-lg disabled:shadow-none disabled:cursor-not-allowed transition-all ${
              scheduleMode === 'later'
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-300 disabled:to-gray-400'
                : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400'
            }`}>
            {scheduleMode === 'later' ? <><Clock className="w-5 h-5" /> Tạo campaign {itemCount} video{itemCount > 1 ? 's' : ''}</> : <><Upload className="w-5 h-5" /> Upload ngay {itemCount} {uploadMode === 'url' ? 'video' : 'file'}{itemCount > 1 ? 's' : ''}</>}
          </button>
        </form>

        {/* Immediate upload jobs */}
        {uploads.length > 0 && (
          <div className="mt-6 space-y-2">
            {uploads.map(job => (
              <div key={job.id} className={`p-3 rounded-md border ${job.status === 'uploading' ? 'border-blue-300 bg-blue-50' : job.status === 'success' ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    {job.mode === 'url' ? 'URL upload' : 'File upload'} • {job.channelName || job.channelId}
                    <div className="text-xs text-gray-600">{job.itemCount} items • {job.status}</div>
                  </div>
                  {job.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                  {job.status === 'success' && <CheckCircle className="w-4 h-4 text-green-600" />}
                  {job.status === 'failed' && <XCircle className="w-4 h-4 text-red-600" />}
                </div>
                {job.results && job.results.length > 0 && (
                  <div className="text-xs text-gray-700 mt-2 space-y-0.5">
                    {job.results.map(r => <div key={r.index} className="truncate">#{r.index} {r.success ? '✅' : '❌'} {r.message}</div>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Campaigns */}
      <div className="mt-6 bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-500" />
            Upload Campaigns
            {campaigns.length > 0 && <span className="text-sm font-medium bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{campaigns.length}</span>}
          </h2>
          <button onClick={loadCampaigns} disabled={campaignsLoading} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50">
            <RefreshCw className={`w-4 h-4 ${campaignsLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {campaigns.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">Chưa có campaign nào</div>
        ) : (
          <div className="space-y-3">
            {campaigns.map(c => {
              const isExpanded = expandedCampaigns.has(c.id);
              const statusCfg = {
                new: { bg: 'bg-yellow-50 border-yellow-300', badge: 'bg-yellow-100 text-yellow-800', label: 'Chờ' },
                running: { bg: 'bg-blue-50 border-blue-300', badge: 'bg-blue-100 text-blue-800', label: 'Đang chạy' },
                pending: { bg: 'bg-gray-50 border-gray-300', badge: 'bg-gray-100 text-gray-600', label: 'Tạm dừng' },
                done: { bg: 'bg-green-50 border-green-300', badge: 'bg-green-100 text-green-800', label: 'Hoàn tất' },
              }[c.status] || { bg: 'bg-gray-50 border-gray-300', badge: 'bg-gray-100 text-gray-600', label: c.status };

              const pct = c.total_videos > 0 ? Math.round((c.completedVideos / c.total_videos) * 100) : 0;

              return (
                <div key={c.id} className={`rounded-lg border-2 ${statusCfg.bg}`}>
                  {/* Header */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusCfg.badge}`}>{statusCfg.label}</span>
                          <span className="text-xs text-gray-500">#{c.id}</span>
                          {c.status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />}
                          {c.account?.channel_name && <span className="text-xs text-gray-600 font-medium">{c.account.channel_name}</span>}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-gray-800 truncate">{c.name}</div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                          <span>{c.completedVideos}/{c.total_videos} videos</span>
                          {c.failedVideos > 0 && <span className="text-red-600">{c.failedVideos} lỗi</span>}
                          {c.scheduled_start_at && <span>⏰ {new Date(c.scheduled_start_at).toLocaleString('vi-VN')}</span>}
                        </div>
                        {/* Progress bar */}
                        {c.status !== 'new' && (
                          <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {c.status === 'running' && (
                          <button onClick={() => updateCampaignStatus(c.id, 'hold')} title="Tạm dừng" className="p-1.5 text-yellow-600 hover:bg-yellow-100 rounded transition-colors text-xs font-medium px-2">Pause</button>
                        )}
                        {c.status === 'pending' && (
                          <button onClick={() => updateCampaignStatus(c.id, 'release')} title="Tiếp tục" className="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors text-xs font-medium px-2">Resume</button>
                        )}
                        {(c.status === 'new' || c.status === 'pending') && (
                          <button onClick={() => updateCampaignStatus(c.id, 'cancel')} title="Hủy campaign" className="p-1.5 text-red-500 hover:bg-red-100 rounded transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => toggleExpand(c.id)} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded transition-colors">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded: video list */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 divide-y divide-gray-100">
                      {(c.videos || []).sort((a, b) => (a.orderIndex ?? a.order_index ?? 0) - (b.orderIndex ?? b.order_index ?? 0)).map(v => {
                        const vCfg = {
                          pending: { icon: '⏳', color: 'text-gray-500' },
                          downloading: { icon: '📥', color: 'text-blue-600' },
                          uploading: { icon: '📤', color: 'text-purple-600' },
                          completed: { icon: '✅', color: 'text-green-600' },
                          failed: { icon: '❌', color: 'text-red-600' },
                          skipped: { icon: '⏭️', color: 'text-gray-400' },
                        }[v.status] || { icon: '•', color: 'text-gray-400' };

                        // Support both snake_case (older API) and camelCase (controller mapping)
                        const id = v.id;
                        const title = v.title || v.sourceUrl || v.source_url || '';
                        const sourceUrl = v.sourceUrl || v.source_url || '';
                        const errorMessage = v.errorMessage || v.error_message || null;
                        const scheduledStartAt = v.scheduledStartAt || v.scheduled_start_at || null;
                        const scheduleDate = v.scheduleDate || v.schedule_date || null;
                        const localFilePath = v.localFilePath || v.local_file_path || null;
                        const videoUrl = v.videoUrl || v.video_url || null;

                        const uploadTimeLabel = scheduledStartAt ? new Date(scheduledStartAt).toLocaleString('vi-VN') : 'ASAP';
                        const publishTimeLabel = scheduleDate ? new Date(scheduleDate).toLocaleString('vi-VN') : (v.video_visibility || v.video_visibility === 'public' ? 'After upload' : '—');

                        const copyPath = async (p: string | null) => {
                          if (!p) return;
                          try { await navigator.clipboard.writeText(p); alert('Đã copy đường dẫn file'); }
                          catch { alert('Không thể copy'); }
                        };

                        return (
                          <div key={id} className="px-4 py-2.5 flex items-center gap-3">
                            <span className="text-base flex-shrink-0">{vCfg.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-gray-700 truncate">{title}</div>
                              {title && sourceUrl && <div className="text-xs text-gray-400 truncate">{sourceUrl}</div>}

                              <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                                <div className="px-2 py-0.5 bg-gray-100 rounded">Upload: <span className="font-medium text-gray-700">{uploadTimeLabel}</span></div>
                                <div className="px-2 py-0.5 bg-gray-100 rounded">Publish: <span className="font-medium text-gray-700">{publishTimeLabel}</span></div>
                                {localFilePath && (
                                  <button type="button" onClick={() => copyPath(localFilePath)} className="px-2 py-0.5 bg-white border rounded text-xs text-gray-600 hover:bg-gray-50">
                                    {localFilePath.length > 40 ? `${localFilePath.slice(0, 30)}...${localFilePath.slice(-8)}` : localFilePath}
                                  </button>
                                )}
                              </div>

                              {errorMessage && <div className="text-xs text-red-500 truncate mt-1">{errorMessage}</div>}
                            </div>
                            {videoUrl && (
                              <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex-shrink-0">Xem</a>
                            )}
                            {(v.status === 'downloading' || v.status === 'uploading') && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 flex-shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
