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

  const [formData, setFormData] = useState({
    videoUrl: '',
    duration: 60,
    useAccounts: true,
    autoSubscribe: true,
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
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Tăng lượt xem</h1>
        <p className="text-gray-600 mt-2">Tăng lượt xem và tương tác cho video YouTube của bạn</p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Video URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL Video <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              required
              value={formData.videoUrl}
              onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Duration only (tabs/batch removed) */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Thời lượng xem (giây)
              </label>
              <input
                type="number"
                min="10"
                max="300"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Thời gian xem video</p>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="useAccounts"
                checked={formData.useAccounts}
                onChange={(e) => setFormData({ ...formData, useAccounts: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="useAccounts" className="ml-2 text-sm text-gray-700">
                Sử dụng tài khoản đã import
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoSubscribe"
                checked={formData.autoSubscribe}
                onChange={(e) => setFormData({ ...formData, autoSubscribe: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="autoSubscribe" className="ml-2 text-sm text-gray-700">
                Tự động đăng ký kênh
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="humanBehavior"
                checked={formData.humanBehavior}
                onChange={(e) => setFormData({ ...formData, humanBehavior: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="humanBehavior" className="ml-2 text-sm text-gray-700">
                Bật hành vi giống người (Độ trễ ngẫu nhiên, di chuyển chuột)
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Đang khởi động chiến dịch...
              </>
            ) : (
              <>
                <PlayCircle size={20} />
                Bắt đầu chiến dịch tăng view
              </>
            )}
          </button>
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
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-medium text-gray-800">Chọn kênh (mỗi lần mở 3 tab để xem)</h3>
            <p className="text-xs text-gray-500">Chọn các tài khoản/kênh sẽ được dùng để xem video. Mặc định mở 3 tab/tại lượt chạy.</p>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={goToPrev} disabled={page <= 1 || loadingAccounts} className="px-3 py-1 bg-gray-100 rounded disabled:opacity-50">Prev</button>
            <div className="text-sm text-gray-600">Page {page}{totalPages ? ` / ${totalPages}` : ''}</div>
            <button type="button" onClick={goToNext} disabled={(totalPages != null && page >= totalPages) || loadingAccounts} className="px-3 py-1 bg-gray-100 rounded disabled:opacity-50">Next</button>
            <button type="button" onClick={loadMore} disabled={loadingAccounts || (totalPages != null && page >= totalPages)} className="px-3 py-1 bg-blue-50 text-blue-700 rounded">Load more</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-auto">
          {loadingAccounts && <div className="text-sm text-gray-500">Đang tải danh sách kênh...</div>}
          {!loadingAccounts && channels.length === 0 && <div className="text-sm text-gray-500">Không có kênh</div>}

          {channels.map((ch: any) => {
            const id = ch.id || ch._id || ch.email || ch.channelId || JSON.stringify(ch);
            const label = ch.email || ch.name || ch.displayName || ch.channelId || id;
            return (
              <label key={id} className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={selectedChannels.includes(id)}
                  onChange={() => toggleChannel(id)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 truncate">{label}</span>
              </label>
            );
          })}
        </div>

        <div className="mt-3 text-sm text-gray-600">Đã chọn: {selectedChannels.length} kênh</div>
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
