'use client';

import { useState, useEffect } from 'react';
import { PlayCircle, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/constants';

export default function BoostViewsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // List of channels/accounts fetched from API
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);

  // Pagination state for accounts
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(50);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [formData, setFormData] = useState({
    videoUrl: '',
    duration: 60,
    useAccounts: true,
    autoSubscribe: true,
    autoLike: true,
    autoComment: false,
    humanBehavior: true,
  });

  // Fetch a specific page; append controls whether to append results or replace
  const fetchAccountsPage = async (pageNum = 1, append = false) => {
    setLoadingAccounts(true);
    try {
      const res = await fetch(`${buildApiUrl(API_ENDPOINTS.ACCOUNTS.LIST)}?page=${pageNum}&limit=${limit}`);
      if (!res.ok) {
        setLoadingAccounts(false);
        return;
      }
      const data = await res.json();
      // API might return { data: [...], total, page, limit } or directly an array
      const list = data.data || data.docs || data || [];

      if (append) {
        setChannels(prev => {
          // avoid duplicates by id/_id/email
          const existingIds = new Set(prev.map(ch => ch.id || ch._id || ch.email || ch.channelId));
          const toAdd = list.filter((ch: any) => {
            const id = ch.id || ch._id || ch.email || ch.channelId;
            return !existingIds.has(id);
          });
          return [...prev, ...toAdd];
        });
      } else {
        setChannels(list);
      }

      // Try to infer total & totalPages
      const total = data.total || data.totalDocs || data.meta?.total || null;
      if (total) {
        setTotalCount(total);
        setTotalPages(Math.ceil(total / limit));
      } else if (data.pages) {
        setTotalPages(data.pages);
      }

      setPage(pageNum);
    } catch (e) {
      console.warn('Could not fetch accounts', e);
    } finally {
      setLoadingAccounts(false);
    }
  };

  // Initial load
  useEffect(() => {
    let mounted = true;
    if (mounted) fetchAccountsPage(1, false);
    return () => { mounted = false; };
  }, [limit]);

  const toggleChannel = (id: string) => {
    setSelectedChannels(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      return [...prev, id];
    });
  };

  const selectAllChannels = () => {
    const allIds = channels.map((ch: any) => ch.id || ch._id || ch.email || ch.channelId || JSON.stringify(ch));
    setSelectedChannels(allIds);
  };

  const deselectAllChannels = () => {
    setSelectedChannels([]);
  };

  const loadMore = async () => {
    // append next page if available
    const next = (totalPages && page >= totalPages) ? null : page + 1;
    if (!next) return;
    await fetchAccountsPage(next, true);
  };

  const goToPrev = async () => {
    if (page <= 1) return;
    await fetchAccountsPage(page - 1, false);
  };

  const goToNext = async () => {
    if (totalPages && page >= totalPages) return;
    await fetchAccountsPage(page + 1, false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload = { ...formData, selectedChannels };

      const response = await fetch(buildApiUrl(API_ENDPOINTS.WATCH.BATCH), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to start boost campaign');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start campaign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Tăng lượt xem</h1>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
        <form onSubmit={handleSubmit}>
          {/* URL + options on one row */}
          <div className="flex items-center gap-3 mb-3">
            <input
              type="url"
              required
              value={formData.videoUrl}
              onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=..."
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {loading ? (
                <><Loader2 className="animate-spin" size={15} /> Đang chạy...</>
              ) : (
                <><PlayCircle size={15} /> Bắt đầu</>
              )}
            </button>
          </div>

          {/* Checkboxes inline */}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {[
              { id: 'useAccounts', label: 'Dùng tài khoản', key: 'useAccounts' },
              { id: 'autoSubscribe', label: 'Auto subscribe (25%)', key: 'autoSubscribe' },
              { id: 'autoLike', label: 'Auto like (15%)', key: 'autoLike' },
              { id: 'autoComment', label: 'Auto comment (5%)', key: 'autoComment' },
              { id: 'humanBehavior', label: 'Human behavior', key: 'humanBehavior' },
            ].map(({ id, label, key }) => (
              <label key={id} htmlFor={id} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  id={id}
                  checked={(formData as any)[key]}
                  onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })}
                  className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-xs text-gray-600">{label}</span>
              </label>
            ))}
          </div>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 mb-6">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-red-900">Lỗi</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Success Message */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-semibold text-green-900">Chiến dịch đã khởi động thành công!</h3>
              <p className="text-sm text-green-700 mt-1">
                {result.message || 'Chiến dịch tăng view đang chạy'}
              </p>
            </div>
          </div>

          {/* Campaign Details */}
          {result.data && (
            <div className="bg-white rounded-lg p-4 space-y-2">
              <h4 className="font-semibold text-gray-900 mb-2">Chi tiết chiến dịch:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-600">ID chiến dịch:</div>
                <div className="font-mono text-gray-900">{result.data.campaignId}</div>
                
                <div className="text-gray-600">Tổng số tab:</div>
                <div className="text-gray-900">—</div>
                
                <div className="text-gray-600">Kích thước lô:</div>
                <div className="text-gray-900">—</div>
                
                <div className="text-gray-600">Thời lượng:</div>
                <div className="text-gray-900">{formData.duration} giây</div>
                
                <div className="text-gray-600">Sử dụng tài khoản:</div>
                <div className="text-gray-900">{formData.useAccounts ? 'Có' : 'Không'}</div>
                
                <div className="text-gray-600">Tự động đăng ký:</div>
                <div className="text-gray-900">{formData.autoSubscribe ? 'Có' : 'Không'}</div>
                
                <div className="text-gray-600">Hành vi giống người:</div>
                <div className="text-gray-900">{formData.humanBehavior ? 'Đã bật' : 'Đã tắt'}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Channel selection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-medium text-gray-800">Chọn kênh để buff view</h3>
            <p className="text-xs text-gray-500">Mỗi kênh = 1 lượt xem. Chọn càng nhiều kênh thì càng nhiều view.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAllChannels}
              disabled={loadingAccounts || channels.length === 0}
              className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium hover:bg-green-100 disabled:opacity-50 transition-colors"
            >
              Chọn tất cả ({channels.length})
            </button>
            <button
              type="button"
              onClick={deselectAllChannels}
              disabled={selectedChannels.length === 0}
              className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              Bỏ chọn
            </button>
          </div>
        </div>

        {/* Search + pagination row */}
        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            placeholder="Tìm kiếm email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="button" onClick={goToPrev} disabled={page <= 1 || loadingAccounts} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-200">←</button>
          <span className="text-sm text-gray-500 whitespace-nowrap">Trang {page}{totalPages ? ` / ${totalPages}` : ''}</span>
          <button type="button" onClick={goToNext} disabled={(totalPages != null && page >= totalPages) || loadingAccounts} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-200">→</button>
          <button type="button" onClick={loadMore} disabled={loadingAccounts || (totalPages != null && page >= totalPages)} className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm hover:bg-blue-100 disabled:opacity-40 transition-colors">Tải thêm</button>
        </div>

        {/* Channel grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-96 overflow-y-auto pr-1">
          {loadingAccounts && (
            <div className="col-span-3 text-sm text-gray-400 text-center py-6">Đang tải danh sách kênh...</div>
          )}
          {!loadingAccounts && channels.length === 0 && (
            <div className="col-span-3 text-sm text-gray-400 text-center py-6">Không có kênh nào</div>
          )}

          {channels
            .filter((ch: any) => {
              if (!searchQuery.trim()) return true;
              const label = ch.email || ch.name || ch.displayName || ch.channelId || '';
              return label.toLowerCase().includes(searchQuery.toLowerCase());
            })
            .map((ch: any) => {
              const id = ch.id || ch._id || ch.email || ch.channelId || JSON.stringify(ch);
              const label = ch.email || ch.name || ch.displayName || ch.channelId || id;
              const isSelected = selectedChannels.includes(id);
              return (
                <label
                  key={id}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50 border-blue-300 text-blue-800'
                      : 'hover:bg-gray-50 border-gray-200 text-gray-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleChannel(id)}
                    className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded flex-shrink-0"
                  />
                  <span className="text-xs truncate">{label}</span>
                </label>
              );
            })}
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between text-sm border-t pt-3">
          <div className="flex items-center gap-2">
            <span className={`font-semibold ${selectedChannels.length > 0 ? 'text-blue-700' : 'text-gray-400'}`}>
              Đã chọn: {selectedChannels.length} kênh
            </span>
            {totalCount && (
              <span className="text-gray-400">/ {totalCount} tổng</span>
            )}
            {selectedChannels.length > 0 && selectedChannels.length === channels.length && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Tất cả trang này</span>
            )}
          </div>
          {searchQuery && (
            <span className="text-xs text-gray-400">
              Hiển thị {channels.filter((ch: any) => {
                const label = ch.email || ch.name || ch.displayName || ch.channelId || '';
                return label.toLowerCase().includes(searchQuery.toLowerCase());
              }).length} kết quả
            </span>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Cách hoạt động</h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li>• Mở nhiều tab trình duyệt để xem video của bạn</li>
          <li>• Mô phỏng hành vi con người với độ trễ và tương tác ngẫu nhiên</li>
          <li>• Có thể tự động đăng ký kênh</li>
          <li>• Xử lý theo lô để tránh quá tải hệ thống</li>
          <li>• Mỗi lượt xem được tính là lượt xem YouTube thực</li>
        </ul>
      </div>
    </div>
  );
}
