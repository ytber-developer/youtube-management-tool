'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Search, ChevronLeft, ChevronRight, ExternalLink, Upload, X, FileText, RotateCw, Download, Chrome, Image as ImageIcon, Edit2, Check } from 'lucide-react';
import { buildApiUrl, API_ENDPOINTS } from '@/lib/constants';
import { accountsAPI } from '@/lib/api';

interface Channel {
  id: number;
  email: string;
  channelName: string;
  channelLink: string;
  isAuthenticator: boolean;
  isCreateChannel: boolean;
  isUploadAvatar?: boolean;
  avatarUrl?: string;
  imageName?: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export default function ListChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  
  // Retry state
  const [retryingId, setRetryingId] = useState<number | null>(null);
  
  // Open browser state
  const [openingBrowserId, setOpeningBrowserId] = useState<number | null>(null);
  
  // Upload avatars state
  const [uploadingAvatars, setUploadingAvatars] = useState(false);
  
  // Upload single avatar state
  const [uploadingAvatarId, setUploadingAvatarId] = useState<number | null>(null);
  
  // Edit avatar URL state
  const [editingAvatarId, setEditingAvatarId] = useState<number | null>(null);
  const [avatarUrlInput, setAvatarUrlInput] = useState<string>('');
  
  // Pagination & Search
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  const [search, setSearch] = useState('');
  const [searchBy, setSearchBy] = useState<'all' | 'email' | 'channelName'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'incomplete' | 'complete'>('all');

  // Fetch channels on mount and when pagination/search/filter changes
  useEffect(() => {
    fetchChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, search, searchBy, filterStatus]);

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (search) {
        params.append('search', search);
        params.append('searchBy', searchBy);
      }

      // Add status filter
      if (filterStatus !== 'all') {
        params.append('status', filterStatus);
      }

      const url = `${buildApiUrl(API_ENDPOINTS.ACCOUNTS.LIST)}?${params}`;
      console.log('Fetching channels from:', url);

      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Channels data:', data);
        setChannels(data.data || []);
        setPagination(data.pagination);
      } else {
        console.error('Failed to fetch channels:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleFilterChange = (newFilter: 'all' | 'incomplete' | 'complete') => {
    setFilterStatus(newFilter);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleImport = async () => {
    if (!csvFile) {
      setImportError('Vui lòng chọn file CSV');
      return;
    }

    setImporting(true);
    setImportError('');
    setImportSuccess('');

    try {
      const result = await accountsAPI.importChannels(csvFile);
      setImportSuccess(result.message || 'Import thành công!');
      
      // Refresh channels list after 2 seconds
      setTimeout(() => {
        setShowImportModal(false);
        setCsvFile(null);
        setImportSuccess('');
        fetchChannels();
      }, 2000);
    } catch (error: any) {
      setImportError(error.message || 'Import thất bại');
    } finally {
      setImporting(false);
    }
  };

  const resetImportModal = () => {
    setShowImportModal(false);
    setCsvFile(null);
    setImportError('');
    setImportSuccess('');
  };

  const handleRetryVerify = async (id: number) => {
    if (retryingId) return; // Prevent multiple retries
    
    setRetryingId(id);
    
    try {
      const result = await accountsAPI.retryVerify(id);
      
      // Update channel status in the current list immediately
      setChannels(prevChannels => 
        prevChannels.map(channel => 
          channel.id === id 
            ? {
                ...channel,
                isAuthenticator: result.data.is_authenticator,
                isCreateChannel: result.data.is_create_channel,
                channelName: result.data.channelName || channel.channelName,
                channelLink: result.data.channelLink || channel.channelLink
              }
            : channel
        )
      );
      
      alert(`✅ ${result.message}`);
    } catch (error: any) {
      alert(`❌ ${error.message || 'Retry verify failed'}`);
    } finally {
      setRetryingId(null);
    }
  };

  const handleExport = async () => {
    try {
      const url = buildApiUrl(API_ENDPOINTS.ACCOUNTS.EXPORT);
      
      // Fetch the CSV file
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to export accounts');
      }
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'accounts.csv';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      // Create blob and download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
    } catch (error: any) {
      console.error('Export failed:', error);
      alert(`❌ Export failed: ${error.message}`);
    }
  };

  const handleOpenBrowser = async (id: number, email: string) => {
    if (openingBrowserId) return; // Prevent multiple opens
    
    setOpeningBrowserId(id);
    
    try {
      const url = buildApiUrl(API_ENDPOINTS.ACCOUNTS.OPEN_BROWSER(id));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`✅ ${result.message}\n\n${result.data.note}`);
      } else {
        // Handle specific error cases
        if (response.status === 409) {
          // Browser already open
          const shouldClose = confirm(`⚠️  ${result.message}\n\nDo you want to close it now?`);
          if (shouldClose) {
            await handleCloseBrowser(id, email);
          }
        } else {
          throw new Error(result.message || 'Failed to open browser');
        }
      }
      
    } catch (error: any) {
      console.error('Open browser failed:', error);
      alert(`❌ Open browser failed: ${error.message}`);
    } finally {
      setOpeningBrowserId(null);
    }
  };

  const handleCloseBrowser = async (id: number, email: string) => {
    try {
      const url = buildApiUrl(`/api/v1/accounts/${id}/close-browser`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`✅ ${result.message}`);
      } else {
        throw new Error(result.message || 'Failed to close browser');
      }
      
    } catch (error: any) {
      console.error('Close browser failed:', error);
      alert(`❌ Close browser failed: ${error.message}`);
    }
  };

  const handleRetryUploadAvatars = async () => {
    if (uploadingAvatars) return;
    
    const confirmed = confirm(
      '� Retry upload avatar cho các kênh bị fail?\n\n' +
      'Quá trình này sẽ:\n' +
      '- Tìm các kênh đã tạo nhưng CHƯA upload avatar thành công\n' +
      '- Download avatar từ Facebook (nếu chưa có file local)\n' +
      '- Upload lên YouTube Studio\n\n' +
      'Chỉ xử lý các kênh bị fail ở bước upload avatar.\n\n' +
      'Tiếp tục?'
    );
    
    if (!confirmed) return;
    
    setUploadingAvatars(true);
    
    try {
      const result = await accountsAPI.uploadAvatars();
      
      if (result.success) {
        const { total, success, failed } = result.summary;
        alert(
          `✅ ${result.message}\n\n` +
          `📊 Kênh cần retry: ${total}\n` +
          `✓ Upload thành công: ${success}\n` +
          `✗ Vẫn thất bại: ${failed}`
        );
        
        // Refresh channels list
        fetchChannels();
      } else {
        throw new Error(result.message || 'Retry upload avatars failed');
      }
      
    } catch (error: any) {
      console.error('Retry upload avatars failed:', error);
      alert(`❌ Retry failed: ${error.message}`);
    } finally {
      setUploadingAvatars(false);
    }
  };

  const handleUploadAvatarSingle = async (channelId: number, email: string) => {
    const confirmed = confirm(
      `Upload avatar cho kênh: ${email}?\n\n` +
      'Hệ thống sẽ:\n' +
      '- Download avatar từ Facebook (nếu chưa có)\n' +
      '- Mở YouTube Studio\n' +
      '- Upload avatar lên kênh\n\n' +
      'Tiếp tục?'
    );
    
    if (!confirmed) return;
    
    setUploadingAvatarId(channelId);
    
    try {
      const result = await accountsAPI.uploadAvatarSingle(channelId);
      
      if (result.success) {
        alert(`✅ Upload avatar thành công cho ${email}`);
        // Refresh channels list
        fetchChannels();
      } else {
        throw new Error(result.message || 'Upload avatar failed');
      }
      
    } catch (error: any) {
      console.error('Upload avatar failed:', error);
      alert(`❌ Upload avatar failed: ${error.message}`);
    } finally {
      setUploadingAvatarId(null);
    }
  };

  const handleUpdateAvatarUrl = async (channelId: number, email: string) => {
    if (!avatarUrlInput.trim()) {
      alert('Vui lòng nhập avatar URL');
      return;
    }

    // Validate URL
    try {
      new URL(avatarUrlInput);
    } catch (e) {
      alert('URL không hợp lệ. Vui lòng nhập URL đúng định dạng (http:// hoặc https://)');
      return;
    }

    const confirmed = confirm(
      `Update avatar URL cho kênh: ${email}?\n\n` +
      `URL: ${avatarUrlInput}\n\n` +
      'Tiếp tục?'
    );
    
    if (!confirmed) return;
    
    try {
      const result = await accountsAPI.updateAvatarUrl(channelId, avatarUrlInput);
      
      if (result.success) {
        alert(`✅ Đã update avatar URL cho ${email}`);
        setEditingAvatarId(null);
        setAvatarUrlInput('');
        // Refresh channels list
        fetchChannels();
      } else {
        throw new Error(result.message || 'Update avatar URL failed');
      }
      
    } catch (error: any) {
      console.error('Update avatar URL failed:', error);
      alert(`❌ Update failed: ${error.message}`);
    }
  };

  const handleCancelEditAvatar = () => {
    setEditingAvatarId(null);
    setAvatarUrlInput('');
  };

  const handleDeleteAccount = async (id: number, email: string) => {
    const confirmed = confirm(`Xác nhận xóa account ${email} (ID: ${id})?`);
    if (!confirmed) return;

    try {
      const result = await accountsAPI.deleteAccount(id);
      if (result.success) {
        alert(`✅ ${result.message}`);
        // Refresh list
        fetchChannels();
      } else {
        throw new Error(result.message || 'Delete failed');
      }
    } catch (error: any) {
      console.error('Delete account failed:', error);
      alert(`❌ Delete failed: ${error.message}`);
    }
  };

  return (
    <div className="p-6">
      {/* Compact Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kênh YouTube</h1>
          <p className="text-sm text-gray-500 mt-1">Danh sách tất cả kênh YouTube</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRetryUploadAvatars}
            disabled={uploadingAvatars}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Retry upload avatar cho các kênh bị fail"
          >
            {uploadingAvatars ? (
              <>
                <RotateCw size={16} className="animate-spin" />
                Đang retry...
              </>
            ) : (
              <>
                <RotateCw size={16} />
                Retry Avatar
              </>
            )}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            title="Export all accounts to CSV"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload size={16} />
            Import Channels
          </button>
          <button
            onClick={fetchChannels}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Compact Stats */}
      {!loading && pagination.total > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500 mb-0.5">Tổng số kênh</div>
            <div className="text-2xl font-bold text-gray-900">{pagination.total}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500 mb-0.5">Có tên kênh</div>
            <div className="text-2xl font-bold text-green-600">
              {channels.filter(c => c.channelName).length}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500 mb-0.5">Chưa hoàn thành</div>
            <div className="text-2xl font-bold text-orange-600">
              {channels.filter(c => !c.isAuthenticator || !c.isCreateChannel).length}
            </div>
          </div>
        </div>
      )}

      {/* Compact Search & Filter */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <form onSubmit={handleSearch}>
          <div className="flex gap-2 items-center mb-3">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm kiếm kênh..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={searchBy}
              onChange={(e) => setSearchBy(e.target.value as any)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tất cả</option>
              <option value="email">Email</option>
              <option value="channelName">Tên kênh</option>
            </select>
            <button
              type="submit"
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Tìm
            </button>
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSearchInput('');
                }}
                className="px-4 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Xóa
              </button>
            )}
          </div>
          
          {/* Compact Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">Lọc:</span>
            <button
              type="button"
              onClick={() => handleFilterChange('all')}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange('incomplete')}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                filterStatus === 'incomplete'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Chưa hoàn thành
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange('complete')}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                filterStatus === 'complete'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Đã hoàn thành
            </button>
          </div>
        </form>
      </div>

      {/* Compact Channels Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700">Email</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700">Tên kênh</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700">Link</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-700">2FA</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-700">Channel</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-700">Avatar</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-700">Browser</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-700">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    <RefreshCw className="animate-spin mx-auto mb-2" size={20} />
                    <div className="text-sm">Đang tải kênh...</div>
                  </td>
                </tr>
              ) : channels.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                    {search 
                      ? 'Không tìm thấy kênh nào phù hợp.' 
                      : filterStatus !== 'all'
                      ? 'Không tìm thấy kênh nào với bộ lọc này.'
                      : 'Không tìm thấy kênh nào.'}
                  </td>
                </tr>
              ) : (
                channels.map((channel) => (
                  <tr key={channel.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-gray-900">{channel.email}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-900">{channel.channelName || '-'}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {channel.channelLink ? (
                        <a
                          href={channel.channelLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          Xem
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {channel.isAuthenticator ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                          ✓
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                          ✗
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {channel.isCreateChannel ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                          ✓
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                          ✗
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {editingAvatarId === channel.id ? (
                        // Edit mode: show input and buttons
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="text"
                            value={avatarUrlInput}
                            onChange={(e) => setAvatarUrlInput(e.target.value)}
                            placeholder="https://..."
                            className="w-32 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdateAvatarUrl(channel.id, channel.email)}
                            className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                            title="Save"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={handleCancelEditAvatar}
                            className="inline-flex items-center justify-center w-6 h-6 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                            title="Cancel"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        // View mode: show status and action buttons (no avatar image)
                        <div className="flex items-center justify-center gap-1">
                          {channel.isUploadAvatar ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                              ✓
                            </span>
                          ) : channel.isCreateChannel ? (
                            <>
                              {channel.avatarUrl && (
                                <button
                                  onClick={() => handleUploadAvatarSingle(channel.id, channel.email)}
                                  disabled={uploadingAvatarId === channel.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  title="Upload avatar to YouTube"
                                >
                                  <ImageIcon size={10} className={uploadingAvatarId === channel.id ? 'animate-pulse' : ''} />
                                  {uploadingAvatarId === channel.id ? '...' : 'Up'}
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setEditingAvatarId(channel.id);
                                  setAvatarUrlInput(channel.avatarUrl || '');
                                }}
                                className="inline-flex items-center justify-center w-6 h-6 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                                title="Edit avatar URL"
                              >
                                <Edit2 size={10} />
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => handleOpenBrowser(channel.id, channel.email)}
                        disabled={openingBrowserId === channel.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Open browser with profile/cookie"
                      >
                        <Chrome size={12} className={openingBrowserId === channel.id ? 'animate-pulse' : ''} />
                        {openingBrowserId === channel.id ? 'Opening...' : 'Open'}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {(!channel.isAuthenticator || !channel.isCreateChannel) ? (
                        <button
                          onClick={() => handleRetryVerify(channel.id)}
                          disabled={retryingId === channel.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Retry verify authenticator and create channel"
                        >
                          <RotateCw size={12} className={retryingId === channel.id ? 'animate-spin' : ''} />
                          {retryingId === channel.id ? 'Đang xử lý...' : 'Retry'}
                        </button>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleDeleteAccount(channel.id, channel.email)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                            title="Delete account"
                          >
                            Xóa
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Compact Pagination */}
        {!loading && channels.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-xs text-gray-600">
              Hiển thị {channels.length} / {pagination.total} kênh
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={!pagination.hasPrev}
                className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-gray-700">
                Trang {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={!pagination.hasNext}
                className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Import Channels</h2>
              <button
                onClick={resetImportModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* CSV File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File CSV (Bắt buộc)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-500 transition-colors">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="flex flex-col items-center cursor-pointer"
                  >
                    <FileText size={32} className="text-gray-400 mb-2" />
                    {csvFile ? (
                      <span className="text-sm text-gray-900">{csvFile.name}</span>
                    ) : (
                      <span className="text-sm text-gray-500">Click để chọn file CSV</span>
                    )}
                  </label>
                </div>
              </div>

              {/* Error Message */}
              {importError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {importError}
                </div>
              )}

              {/* Success Message */}
              {importSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                  {importSuccess}
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={resetImportModal}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={importing}
              >
                Huỷ
              </button>
              <button
                onClick={handleImport}
                disabled={!csvFile || importing}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {importing ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw size={16} className="animate-spin" />
                    Đang import...
                  </span>
                ) : (
                  'Import'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
