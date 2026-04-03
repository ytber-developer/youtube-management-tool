'use client';

import { useState, useEffect, useCallback } from 'react';
import { PlayCircle, AlertCircle, Loader2, Pause, Square, Trash2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VideoProgress {
  url: string;
  index: number;
  total: number;
  done: number;
  failed: number;
  pending: number;
}

interface Campaign {
  id: number;
  name: string;
  status: 'pending' | 'running' | 'paused' | 'done';
  video_urls: string[];
  current_video_index: number;
  totalTasks: number;
  doneTasks: number;
  failedTasks: number;
  runningTasks: number;
  pendingTasks: number;
  videoProgress: VideoProgress[];
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusColor: Record<string, string> = {
  running: 'bg-blue-100 text-blue-700',
  paused:  'bg-yellow-100 text-yellow-700',
  done:    'bg-green-100 text-green-700',
  pending: 'bg-gray-100 text-gray-600',
};

const statusLabel: Record<string, string> = {
  running: 'Đang chạy',
  paused:  'Tạm dừng',
  done:    'Hoàn thành',
  pending: 'Chờ',
};

function ProgressBar({ value, total, color = 'bg-blue-500' }: { value: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  );
}

// ─── Campaign Card ─────────────────────────────────────────────────────────────

function CampaignCard({ campaign, onAction, onDelete }: {
  campaign: Campaign;
  onAction: (id: number, action: 'pause' | 'resume' | 'stop') => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[campaign.status]}`}>
            {statusLabel[campaign.status]}
          </span>
          <span className="text-sm font-medium text-gray-800 truncate">{campaign.name}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {campaign.status === 'running' && (
            <button onClick={() => onAction(campaign.id, 'pause')} title="Tạm dừng"
              className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors">
              <Pause size={14} />
            </button>
          )}
          {campaign.status === 'paused' && (
            <button onClick={() => onAction(campaign.id, 'resume')} title="Tiếp tục"
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <PlayCircle size={14} />
            </button>
          )}
          {(campaign.status === 'running' || campaign.status === 'paused') && (
            <button onClick={() => onAction(campaign.id, 'stop')} title="Dừng"
              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <Square size={14} />
            </button>
          )}
          {campaign.status === 'done' && (
            <button onClick={() => onDelete(campaign.id)} title="Xoá"
              className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
              <Trash2 size={14} />
            </button>
          )}
          <button onClick={() => setExpanded(v => !v)}
            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Overall progress */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Tổng tiến độ: {campaign.doneTasks}/{campaign.totalTasks} tasks</span>
          {campaign.failedTasks > 0 && <span className="text-red-500">{campaign.failedTasks} lỗi</span>}
        </div>
        <ProgressBar value={campaign.doneTasks} total={campaign.totalTasks} />
      </div>

      {/* Video info */}
      <div className="text-xs text-gray-500">
        Video {Math.min(campaign.current_video_index + 1, campaign.video_urls.length)}/{campaign.video_urls.length}
        {campaign.status === 'running' && campaign.runningTasks > 0 && (
          <span className="ml-2 text-blue-600">· {campaign.runningTasks} đang xem</span>
        )}
      </div>

      {/* Expanded: per-video breakdown */}
      {expanded && (
        <div className="border-t pt-3 space-y-2">
          {campaign.videoProgress.map((vp) => (
            <div key={vp.index}>
              <div className="flex justify-between text-xs mb-1">
                <span className={`font-medium ${vp.index === campaign.current_video_index ? 'text-blue-700' : 'text-gray-500'}`}>
                  {vp.index === campaign.current_video_index && campaign.status === 'running' ? '▶ ' : ''}
                  Video {vp.index + 1}: <span className="font-mono text-gray-400">{vp.url.slice(0, 40)}...</span>
                </span>
                <span className="text-gray-400">{vp.done}/{vp.total}</span>
              </div>
              <ProgressBar
                value={vp.done}
                total={vp.total}
                color={vp.index < campaign.current_video_index ? 'bg-green-500' : vp.index === campaign.current_video_index ? 'bg-blue-500' : 'bg-gray-300'}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BoostViewsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // Accounts
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form
  const [videoUrlsText, setVideoUrlsText] = useState('');
  const [options, setOptions] = useState({
    autoSubscribe: true,
    autoLike: true,
    autoComment: false,
    humanBehavior: true,
  });

  // ── Fetch accounts ──────────────────────────────────────────────────────────

  const fetchAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const res = await fetch(`${buildApiUrl(API_ENDPOINTS.ACCOUNTS.LIST)}?limit=200`);
      if (!res.ok) return;
      const data = await res.json();
      const list = data.data || data.docs || data || [];
      setChannels(list);
      setTotalCount(data.pagination?.total || data.total || list.length);
    } catch (e) {
      console.warn('Could not fetch accounts', e);
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => { fetchAccounts(); }, []);

  // ── Fetch campaigns ─────────────────────────────────────────────────────────

  const fetchCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.CAMPAIGNS.LIST));
      if (!res.ok) return;
      const data = await res.json();
      setCampaigns(data.data || []);
    } catch (e) {
      console.warn('Could not fetch campaigns', e);
    } finally {
      setLoadingCampaigns(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
    // Auto-refresh every 15s if any running campaign
    const interval = setInterval(() => {
      fetchCampaigns();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchCampaigns]);

  // ── Account selection ───────────────────────────────────────────────────────

  const toggleChannel = (id: string) => {
    setSelectedChannels(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const filteredChannels = channels.filter(ch => {
    if (!searchQuery.trim()) return true;
    const label = ch.email || ch.name || '';
    return label.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const selectAll = () => setSelectedChannels(filteredChannels.map(ch => String(ch.id || ch._id || ch.email)));
  const deselectAll = () => setSelectedChannels([]);

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const videoUrls = videoUrlsText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (videoUrls.length === 0) {
      setError('Nhập ít nhất 1 URL video');
      setLoading(false);
      return;
    }
    if (selectedChannels.length === 0) {
      setError('Chọn ít nhất 1 tài khoản');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.CAMPAIGNS.CREATE), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrls,
          accountIds: selectedChannels.map(id => (isNaN(Number(id)) ? id : Number(id))),
          options
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Tạo chiến dịch thất bại');
      setVideoUrlsText('');
      setSelectedChannels([]);
      await fetchCampaigns();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Campaign actions ────────────────────────────────────────────────────────

  const handleAction = async (id: number, action: 'pause' | 'resume' | 'stop') => {
    const url = action === 'pause'
      ? buildApiUrl(API_ENDPOINTS.CAMPAIGNS.PAUSE(id))
      : action === 'resume'
      ? buildApiUrl(API_ENDPOINTS.CAMPAIGNS.RESUME(id))
      : buildApiUrl(API_ENDPOINTS.CAMPAIGNS.STOP(id));
    await fetch(url, { method: 'POST' });
    await fetchCampaigns();
  };

  const handleDelete = async (id: number) => {
    await fetch(buildApiUrl(API_ENDPOINTS.CAMPAIGNS.DELETE(id)), { method: 'DELETE' });
    await fetchCampaigns();
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const runningCount = campaigns.filter(c => c.status === 'running').length;

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Buff View</h1>
        <div className="flex items-center gap-2">
          {runningCount > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
              {runningCount} chiến dịch đang chạy
            </span>
          )}
          <button onClick={fetchCampaigns} disabled={loadingCampaigns}
            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw size={15} className={loadingCampaigns ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Create form */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <form onSubmit={handleSubmit} className="space-y-3">

          {/* Video URLs */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              URL Video (mỗi dòng 1 link)
            </label>
            <textarea
              rows={3}
              value={videoUrlsText}
              onChange={e => setVideoUrlsText(e.target.value)}
              placeholder={"https://www.youtube.com/watch?v=...\nhttps://www.youtube.com/watch?v=...\nhttps://www.youtube.com/shorts/..."}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-none"
            />
            {videoUrlsText && (
              <p className="text-xs text-gray-400 mt-1">
                {videoUrlsText.split('\n').filter(l => l.trim()).length} URL — chạy tuần tự, video trước done mới qua video sau
              </p>
            )}
          </div>

          {/* Options + Submit */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {[
                { key: 'autoSubscribe', label: 'Subscribe (25%)' },
                { key: 'autoLike',      label: 'Like (15%)' },
                { key: 'autoComment',   label: 'Comment (5%)' },
                { key: 'humanBehavior', label: 'Human behavior' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox"
                    checked={(options as any)[key]}
                    onChange={e => setOptions(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="text-xs text-gray-600">{label}</span>
                </label>
              ))}
            </div>
            <button type="submit" disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap flex-shrink-0">
              {loading ? <><Loader2 size={14} className="animate-spin" /> Đang tạo...</> : <><PlayCircle size={14} /> Tạo chiến dịch</>}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </form>
      </div>

      {/* Account selection */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600">
            Tài khoản <span className={`font-semibold ${selectedChannels.length > 0 ? 'text-blue-600' : 'text-gray-400'}`}>({selectedChannels.length} đã chọn{totalCount ? ` / ${totalCount}` : ''})</span>
          </span>
          <div className="flex gap-1.5">
            <button type="button" onClick={selectAll} disabled={filteredChannels.length === 0}
              className="text-xs px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 disabled:opacity-40 transition-colors">
              Chọn tất cả ({filteredChannels.length})
            </button>
            <button type="button" onClick={deselectAll} disabled={selectedChannels.length === 0}
              className="text-xs px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 disabled:opacity-40 transition-colors">
              Bỏ chọn
            </button>
          </div>
        </div>

        <input
          type="text"
          placeholder="Tìm email..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1 max-h-64 overflow-y-auto pr-1">
          {loadingAccounts && <div className="col-span-4 text-center text-xs text-gray-400 py-4">Đang tải...</div>}
          {!loadingAccounts && filteredChannels.length === 0 && (
            <div className="col-span-4 text-center text-xs text-gray-400 py-4">Không có tài khoản</div>
          )}
          {filteredChannels.map((ch: any) => {
            const id = String(ch.id || ch._id || ch.email);
            const label = ch.email || ch.name || id;
            const selected = selectedChannels.includes(id);
            return (
              <label key={id}
                className={`flex items-center gap-1.5 px-2 py-1.5 border rounded-lg cursor-pointer transition-colors text-xs ${
                  selected ? 'bg-blue-50 border-blue-300 text-blue-800' : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}>
                <input type="checkbox" checked={selected} onChange={() => toggleChannel(id)}
                  className="w-3 h-3 text-blue-600 border-gray-300 rounded flex-shrink-0" />
                <span className="truncate">{label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Campaigns list */}
      {campaigns.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">Chiến dịch ({campaigns.length})</h2>
          {campaigns.map(c => (
            <CampaignCard key={c.id} campaign={c} onAction={handleAction} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {!loadingCampaigns && campaigns.length === 0 && (
        <div className="text-center text-sm text-gray-400 py-6">Chưa có chiến dịch nào</div>
      )}

    </div>
  );
}
