'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Globe, Plus, ListPlus, RefreshCw, Loader2, Pencil, Trash2, Zap, X, Wand2, CheckCircle, XCircle, HelpCircle, Search,
} from 'lucide-react';
import { accountsAPI, proxyAPI, Account, ProxyItem, ProxyProtocol } from '@/lib/api';

type Notice = { type: 'success' | 'error'; text: string } | null;

const PROTOCOLS: ProxyProtocol[] = ['http', 'https', 'socks5', 'socks4'];

const emptyForm = { protocol: 'http' as ProxyProtocol, host: '', port: '', username: '', password: '', label: '', country: '' };

function StatusBadge({ p }: { p: ProxyItem }) {
  if (p.status === 'active') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="w-3.5 h-3.5" />Hoạt động</span>;
  }
  if (p.status === 'dead') {
    return <span title={p.lastError} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700"><XCircle className="w-3.5 h-3.5" />Lỗi</span>;
  }
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"><HelpCircle className="w-3.5 h-3.5" />Chưa kiểm tra</span>;
}

function IpVersionBadge({ p }: { p: ProxyItem }) {
  if (!p.ipVersion) return null;
  const v6 = p.ipVersion === 6;
  return (
    <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${v6 ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
      IPv{p.ipVersion}
    </span>
  );
}

const isIPv6Proxy = (p?: ProxyItem) => !!p && (p.ipVersion === 6 || p.hostIsIPv6);

export default function ProxiesPage() {
  const [proxies, setProxies] = useState<ProxyItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<string | null>(null); // khoá nút đang chạy: 'check-5', 'check-all', ...

  // Form thêm / sửa 1 proxy
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  // Thêm nhiều
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkProtocol, setBulkProtocol] = useState<ProxyProtocol>('http');
  const [bulkCountry, setBulkCountry] = useState('');
  const [bulkErrors, setBulkErrors] = useState<{ line: number; value: string; error: string }[]>([]);

  // Gán proxy
  const [search, setSearch] = useState('');
  // all | with | without | active | dead | unknown | ipv6 | p:<proxyId>
  const [proxyFilter, setProxyFilter] = useState('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkProxyId, setBulkProxyId] = useState<string>('');
  const [maxPerProxy, setMaxPerProxy] = useState(1);

  const load = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([
        proxyAPI.list(),
        accountsAPI.getAccounts({ page: 1, limit: 5000 }),
      ]);
      setProxies(p.data || []);
      setAccounts(a.data || []);
    } catch (e: any) {
      setNotice({ type: 'error', text: e.message || 'Không tải được dữ liệu' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (key: string, fn: () => Promise<{ message?: string } | void>) => {
    setBusy(key);
    setNotice(null);
    try {
      const res = await fn();
      if (res && res.message) setNotice({ type: 'success', text: res.message });
      await load();
    } catch (e: any) {
      setNotice({ type: 'error', text: e.message || 'Có lỗi xảy ra' });
    } finally {
      setBusy(null);
    }
  };

  // ── Thêm / sửa 1 proxy ────────────────────────────────────
  const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowForm(true); setShowBulk(false); };
  const openEdit = (p: ProxyItem) => {
    setEditingId(p.id);
    setForm({ protocol: p.protocol, host: p.host, port: String(p.port), username: p.username, password: '', label: p.label, country: p.country });
    setShowForm(true);
    setShowBulk(false);
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    run('form', async () => {
      const payload = { ...form, port: Number(form.port) };
      const res = editingId ? await proxyAPI.update(editingId, payload) : await proxyAPI.create(payload);
      setShowForm(false);
      return res;
    });
  };

  // ── Thêm nhiều ────────────────────────────────────────────
  const submitBulk = (e: React.FormEvent) => {
    e.preventDefault();
    run('bulk', async () => {
      const res = await proxyAPI.createBulk(bulkText, bulkProtocol, bulkCountry);
      setBulkErrors(res.data?.errors || []);
      if (!res.data?.errors?.length) { setBulkText(''); setShowBulk(false); }
      return res;
    });
  };

  // ── Gán proxy ─────────────────────────────────────────────
  const proxyById = useMemo(() => new Map(proxies.map(p => [p.id, p])), [proxies]);
  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter(a => {
      const p = a.proxyId ? proxyById.get(a.proxyId) : undefined;

      // Lọc theo proxy
      if (proxyFilter === 'with' && !p) return false;
      if (proxyFilter === 'without' && p) return false;
      if (['active', 'dead', 'unknown'].includes(proxyFilter) && (!p || p.status !== proxyFilter)) return false;
      if (proxyFilter === 'ipv6' && !isIPv6Proxy(p)) return false;
      if (proxyFilter.startsWith('p:') && a.proxyId !== Number(proxyFilter.slice(2))) return false;

      // Tìm theo email, tên kênh, hoặc thông tin proxy đang gắn (host, IP, ghi chú)
      if (!q) return true;
      const haystack = [
        a.email, a.channelName,
        p?.host, p ? `${p.host}:${p.port}` : '', p?.lastIp, p?.label, p?.country,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [accounts, search, proxyFilter, proxyById]);

  const filterCounts = useMemo(() => {
    const status = (a: Account) => (a.proxyId ? proxyById.get(a.proxyId)?.status : undefined);
    return {
      all: accounts.length,
      with: accounts.filter(a => a.proxyId && proxyById.has(a.proxyId)).length,
      without: accounts.filter(a => !a.proxyId || !proxyById.has(a.proxyId)).length,
      active: accounts.filter(a => status(a) === 'active').length,
      dead: accounts.filter(a => status(a) === 'dead').length,
      unknown: accounts.filter(a => status(a) === 'unknown').length,
      ipv6: accounts.filter(a => isIPv6Proxy(a.proxyId ? proxyById.get(a.proxyId) : undefined)).length,
    };
  }, [accounts, proxyById]);

  const isFiltering = !!search.trim() || proxyFilter !== 'all';
  const clearFilters = () => { setSearch(''); setProxyFilter('all'); };

  // Bấm "N account" ở bảng proxy → lọc danh sách account theo proxy đó
  const showAccountsOfProxy = (proxyId: number) => {
    setSearch('');
    setProxyFilter(`p:${proxyId}`);
    document.getElementById('assign-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const toggle = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allFilteredSelected = filteredAccounts.length > 0 && filteredAccounts.every(a => selected.has(a.id));
  const toggleAll = () => setSelected(prev => {
    const next = new Set(prev);
    if (allFilteredSelected) filteredAccounts.forEach(a => next.delete(a.id));
    else filteredAccounts.forEach(a => next.add(a.id));
    return next;
  });

  const proxyOptionLabel = (p: ProxyItem) =>
    `#${p.id} ${p.label ? `${p.label} — ` : ''}${p.hostIsIPv6 ? `[${p.host}]` : p.host}:${p.port}${p.ipVersion ? ` · IPv${p.ipVersion}` : ''}${p.status === 'dead' ? ' (lỗi)' : ''} · ${p.accounts.length} acc`;

  const assignedCount = accounts.filter(a => a.proxyId).length;

  if (loading) {
    return <div className="p-6 flex items-center gap-2 text-gray-600"><Loader2 className="w-5 h-5 animate-spin" />Đang tải...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Globe className="w-6 h-6 text-blue-600" />Proxy</h1>
          <p className="text-sm text-gray-600 mt-1">
            Mỗi account dùng cố định 1 proxy. Tool kiểm tra proxy trước mỗi lần mở Chrome; proxy lỗi thì tác vụ dừng ngay với thông báo rõ ràng.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
            <Plus className="w-4 h-4" />Thêm proxy
          </button>
          <button onClick={() => { setShowBulk(true); setShowForm(false); setBulkErrors([]); }} className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50">
            <ListPlus className="w-4 h-4" />Thêm nhiều
          </button>
          <button
            onClick={() => run('check-all', () => proxyAPI.checkAll())}
            disabled={!!busy || proxies.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {busy === 'check-all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}Kiểm tra tất cả
          </button>
        </div>
      </div>

      {notice && (
        <div className={`flex items-start justify-between gap-3 p-3 rounded border text-sm ${notice.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Form thêm / sửa 1 proxy */}
      {showForm && (
        <form onSubmit={submitForm} className="bg-white rounded-lg shadow-sm border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{editingId ? `Sửa proxy #${editingId}` : 'Thêm proxy'}</h2>
            <button type="button" onClick={() => setShowForm(false)}><X className="w-4 h-4 text-gray-500" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <label className="text-sm md:col-span-1">
              <span className="block text-gray-700 mb-1">Giao thức</span>
              <select value={form.protocol} onChange={e => setForm({ ...form, protocol: e.target.value as ProxyProtocol })} className="w-full border rounded px-2 py-1.5">
                {PROTOCOLS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="text-sm md:col-span-3">
              <span className="block text-gray-700 mb-1">Host *</span>
              <input required value={form.host} onChange={e => setForm({ ...form, host: e.target.value.trim() })} placeholder="103.x.x.x, 2001:db8::1 hoặc proxy.example.com" className="w-full border rounded px-2 py-1.5 font-mono" />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="block text-gray-700 mb-1">Port *</span>
              <input required type="number" min={1} max={65535} value={form.port} onChange={e => setForm({ ...form, port: e.target.value })} className="w-full border rounded px-2 py-1.5 font-mono" />
            </label>
            <label className="text-sm md:col-span-3">
              <span className="block text-gray-700 mb-1">Username</span>
              <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} autoComplete="off" className="w-full border rounded px-2 py-1.5 font-mono" />
            </label>
            <label className="text-sm md:col-span-3">
              <span className="block text-gray-700 mb-1">Password {editingId && <span className="text-gray-400">(để trống = giữ nguyên)</span>}</span>
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} autoComplete="new-password" className="w-full border rounded px-2 py-1.5 font-mono" />
            </label>
            <label className="text-sm md:col-span-4">
              <span className="block text-gray-700 mb-1">Ghi chú</span>
              <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="VD: ZiO dân cư tĩnh - hết hạn 08/12" className="w-full border rounded px-2 py-1.5" />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="block text-gray-700 mb-1">Quốc gia</span>
              <input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} placeholder="VN" className="w-full border rounded px-2 py-1.5" />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy === 'form'} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-60">
              {busy === 'form' && <Loader2 className="w-4 h-4 animate-spin" />}{editingId ? 'Lưu' : 'Thêm'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded text-sm">Huỷ</button>
          </div>
        </form>
      )}

      {/* Thêm nhiều */}
      {showBulk && (
        <form onSubmit={submitBulk} className="bg-white rounded-lg shadow-sm border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Thêm nhiều proxy</h2>
            <button type="button" onClick={() => setShowBulk(false)}><X className="w-4 h-4 text-gray-500" /></button>
          </div>
          <p className="text-xs text-gray-600">
            Mỗi dòng 1 proxy. Hỗ trợ: <code className="bg-gray-100 px-1">host:port:user:pass</code>, <code className="bg-gray-100 px-1">user:pass@host:port</code>,{' '}
            <code className="bg-gray-100 px-1">host:port</code>, <code className="bg-gray-100 px-1">socks5://user:pass@host:port</code>.
            Host IPv6 ghi trong ngoặc vuông: <code className="bg-gray-100 px-1">[2001:db8::1]:port:user:pass</code>. Dòng bắt đầu bằng # sẽ bị bỏ qua, proxy trùng tự bỏ qua.
          </p>
          <textarea
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            rows={8}
            placeholder={'103.1.2.3:8080:user1:pass1\n103.1.2.4:8080:user2:pass2'}
            className="w-full border rounded px-3 py-2 font-mono text-sm"
          />
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="block text-gray-700 mb-1">Giao thức mặc định</span>
              <select value={bulkProtocol} onChange={e => setBulkProtocol(e.target.value as ProxyProtocol)} className="border rounded px-2 py-1.5">
                {PROTOCOLS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-gray-700 mb-1">Quốc gia</span>
              <input value={bulkCountry} onChange={e => setBulkCountry(e.target.value)} placeholder="VN" className="border rounded px-2 py-1.5 w-24" />
            </label>
            <button type="submit" disabled={busy === 'bulk' || !bulkText.trim()} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-60">
              {busy === 'bulk' && <Loader2 className="w-4 h-4 animate-spin" />}Thêm
            </button>
          </div>
          {bulkErrors.length > 0 && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 space-y-0.5">
              {bulkErrors.map(e => <div key={e.line}>Dòng {e.line}: <span className="font-mono">{e.value}</span> — {e.error}</div>)}
            </div>
          )}
        </form>
      )}

      {/* Danh sách proxy */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h2 className="font-semibold">Danh sách proxy ({proxies.length})</h2>
          <span className="text-xs text-gray-500">
            {proxies.filter(p => p.status === 'active').length} hoạt động · {proxies.filter(p => p.status === 'dead').length} lỗi
          </span>
        </div>
        {proxies.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">Chưa có proxy nào. Bấm “Thêm proxy” hoặc “Thêm nhiều” để bắt đầu.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">Proxy</th>
                  <th className="px-4 py-2 text-left">Trạng thái</th>
                  <th className="px-4 py-2 text-left">IP ra ngoài</th>
                  <th className="px-4 py-2 text-left">Account</th>
                  <th className="px-4 py-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {proxies.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">{p.id}</td>
                    <td className="px-4 py-2">
                      <div className="font-mono">{p.display}</div>
                      <div className="text-xs text-gray-500">{[p.label, p.country].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge p={p} />
                      {p.status === 'dead' && p.lastError && <div className="text-xs text-red-600 mt-1 max-w-xs truncate" title={p.lastError}>{p.lastError}</div>}
                    </td>
                    <td className="px-4 py-2">
                      {p.lastIp ? <span className="font-mono break-all">{p.lastIp}</span> : <span className="text-gray-400">—</span>}
                      <IpVersionBadge p={p} />
                      {p.lastLatencyMs != null && <span className="text-xs text-gray-500 ml-1">({p.lastLatencyMs}ms)</span>}
                    </td>
                    <td className="px-4 py-2">
                      {p.accounts.length === 0 ? <span className="text-gray-400">—</span> : (
                        <button
                          onClick={() => showAccountsOfProxy(p.id)}
                          title={`Xem các account dùng proxy này:\n${p.accounts.map(a => a.email).join('\n')}`}
                          className={`underline decoration-dotted hover:text-blue-600 ${p.accounts.length > 1 ? 'text-amber-700' : ''}`}
                        >
                          {p.accounts.length} account
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => run(`check-${p.id}`, () => proxyAPI.check(p.id))}
                          disabled={!!busy}
                          title="Kiểm tra"
                          className="p-1.5 rounded hover:bg-blue-50 text-blue-600 disabled:opacity-40"
                        >
                          {busy === `check-${p.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        </button>
                        <button onClick={() => openEdit(p)} title="Sửa" className="p-1.5 rounded hover:bg-gray-100 text-gray-600"><Pencil className="w-4 h-4" /></button>
                        <button
                          onClick={() => {
                            const msg = p.accounts.length
                              ? `Xoá proxy #${p.id}? ${p.accounts.length} account đang dùng sẽ bị gỡ proxy (chạy không proxy).`
                              : `Xoá proxy #${p.id}?`;
                            if (window.confirm(msg)) run(`del-${p.id}`, () => proxyAPI.remove(p.id));
                          }}
                          disabled={!!busy}
                          title="Xoá"
                          className="p-1.5 rounded hover:bg-red-50 text-red-600 disabled:opacity-40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Gán proxy cho account */}
      <div id="assign-section" className="bg-white rounded-lg shadow-sm border overflow-hidden scroll-mt-4">
        <div className="px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Gán proxy cho account <span className="text-gray-500 font-normal text-sm">({assignedCount}/{accounts.length} đã có proxy)</span></h2>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Tự gán account chưa có proxy, tối đa</span>
            <input type="number" min={1} value={maxPerProxy} onChange={e => setMaxPerProxy(Math.max(1, Number(e.target.value) || 1))} className="w-16 border rounded px-2 py-1" />
            <span className="text-gray-600">account/proxy</span>
            <button
              onClick={() => run('auto', () => proxyAPI.autoAssign(maxPerProxy))}
              disabled={!!busy || proxies.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              {busy === 'auto' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}Tự gán
            </button>
          </div>
        </div>

        {/* Tìm kiếm + lọc */}
        <div className="px-5 py-3 border-b flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm email, tên kênh, host/IP proxy..."
              className="border rounded pl-8 pr-3 py-1.5 text-sm w-72"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {([
              ['all', 'Tất cả'],
              ['with', 'Đã có proxy'],
              ['without', 'Chưa có proxy'],
              ['active', 'Proxy hoạt động'],
              ['dead', 'Proxy lỗi'],
              ['unknown', 'Proxy chưa kiểm tra'],
              ['ipv6', 'Proxy IPv6'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setProxyFilter(key)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  proxyFilter === key
                    ? key === 'dead' ? 'bg-red-600 border-red-600 text-white' : 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {label} <span className="opacity-75">({filterCounts[key]})</span>
              </button>
            ))}
          </div>
          <select
            value={proxyFilter.startsWith('p:') ? proxyFilter : ''}
            onChange={e => setProxyFilter(e.target.value || 'all')}
            className="border rounded px-2 py-1 text-xs"
          >
            <option value="">Lọc theo 1 proxy…</option>
            {proxies.map(p => <option key={p.id} value={`p:${p.id}`}>{proxyOptionLabel(p)}</option>)}
          </select>
          {isFiltering && (
            <button onClick={clearFilters} className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900">
              <X className="w-3.5 h-3.5" />Xoá lọc
            </button>
          )}
          <span className="ml-auto text-xs text-gray-500">Hiển thị {filteredAccounts.length}/{accounts.length} account</span>
        </div>

        <div className="px-5 py-3 border-b flex flex-wrap items-center gap-3 bg-gray-50">
          <span className="text-sm text-gray-600">Đã chọn {selected.size}</span>
          <select value={bulkProxyId} onChange={e => setBulkProxyId(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
            <option value="">— Chọn proxy —</option>
            <option value="none">Không dùng proxy</option>
            {proxies.map(p => <option key={p.id} value={p.id}>{proxyOptionLabel(p)}</option>)}
          </select>
          <button
            onClick={() => run('bulk-assign', async () => {
              const res = await proxyAPI.assign(Array.from(selected), bulkProxyId === 'none' ? null : Number(bulkProxyId));
              setSelected(new Set());
              return res;
            })}
            disabled={!!busy || selected.size === 0 || !bulkProxyId}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
          >
            Áp dụng cho account đã chọn
          </button>
        </div>

        {accounts.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">Chưa có account nào.</div>
        ) : filteredAccounts.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Không có account nào khớp bộ lọc.{' '}
            <button onClick={clearFilters} className="text-blue-600 hover:underline">Xoá lọc</button>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[600px]">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left w-10"><input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} /></th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Kênh</th>
                  <th className="px-4 py-2 text-left">Proxy</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredAccounts.map(a => {
                  const current = a.proxyId ? proxyById.get(a.proxyId) : undefined;
                  return (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2"><input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} /></td>
                      <td className="px-4 py-2 font-mono text-xs">{a.email}</td>
                      <td className="px-4 py-2 text-gray-600">{a.channelName || '—'}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={a.proxyId ?? ''}
                            disabled={!!busy}
                            onChange={e => run(`assign-${a.id}`, () => proxyAPI.assign([a.id], e.target.value ? Number(e.target.value) : null))}
                            className={`border rounded px-2 py-1 text-xs max-w-xs ${current?.status === 'dead' ? 'border-red-300 text-red-700' : ''}`}
                          >
                            <option value="">Không dùng proxy</option>
                            {proxies.map(p => <option key={p.id} value={p.id}>{proxyOptionLabel(p)}</option>)}
                          </select>
                          {busy === `assign-${a.id}` && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-2 border-t text-xs text-gray-500">
          Đổi proxy của account đang mở browser: tool tự đóng browser cũ và mở lại với proxy mới ở lần chạy tiếp theo.
        </div>
      </div>
    </div>
  );
}
