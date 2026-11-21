'use client';

// Trang /fb-page: quản lý bài đăng của page Facebook "Hôm Nay Mới Biết".
// Dữ liệu đọc từ content-vi/ (lịch + bài đã viết + video dựng). Tool không tự đăng lên Facebook:
// bạn copy caption/video sang Facebook rồi đánh dấu "đã đăng" ở đây. Viết/kiểm chứng/dựng bài vẫn chạy qua chat AI.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Facebook, Loader2, Film, Image as ImageIcon, Check, Copy, X, Search, ExternalLink, CircleDashed, ShieldCheck } from 'lucide-react';
import { fbPageAPI, FbPost, FbPostDetail, FbPostStage } from '@/lib/api';
import { fmtDate } from '@/components/ContentStatus';

const REFRESH_MS = 15000;

const STAGE: Record<FbPostStage, { label: string; cls: string }> = {
  planned: { label: 'Chưa viết', cls: 'bg-gray-100 text-gray-600' },
  written: { label: 'Đã viết', cls: 'bg-amber-100 text-amber-800' },
  checked: { label: 'Đã kiểm chứng', cls: 'bg-sky-100 text-sky-800' },
  ready: { label: 'Sẵn sàng đăng', cls: 'bg-blue-100 text-blue-700' },
  posted: { label: 'Đã đăng', cls: 'bg-green-100 text-green-700' },
};
const FILTERS: { key: 'all' | FbPostStage; label: string }[] = [
  { key: 'all', label: 'Tất cả' }, { key: 'planned', label: 'Chưa viết' }, { key: 'written', label: 'Đã viết' },
  { key: 'checked', label: 'Đã kiểm chứng' }, { key: 'ready', label: 'Sẵn sàng đăng' }, { key: 'posted', label: 'Đã đăng' },
];
const FORMATS: { key: 'reels' | 'photo'; label: string }[] = [{ key: 'reels', label: 'Reels' }, { key: 'photo', label: 'Ảnh' }];

const StageBadge = ({ stage }: { stage: FbPostStage }) => (
  <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${STAGE[stage].cls}`}>{STAGE[stage].label}</span>
);

function CopyButton({ text, label = 'Sao chép' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* trình duyệt chặn clipboard */ }
  };
  return (
    <button onClick={copy} className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-white text-xs hover:bg-gray-50">
      {done ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}{done ? 'Đã chép' : label}
    </button>
  );
}

function PostCard({ p, onOpen }: { p: FbPost; onOpen: (id: string) => void }) {
  const Icon = p.format === 'reels' ? Film : ImageIcon;
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-gray-500"><Icon className="w-3.5 h-3.5" />{p.format === 'reels' ? 'Reels' : 'Ảnh'}<span className="text-gray-300">·</span>{p.area}</span>
        <StageBadge stage={p.stage} />
      </div>
      <div className="font-semibold text-sm text-gray-900 leading-snug line-clamp-2">{p.title}</div>
      {p.id ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className={`inline-flex items-center gap-1 ${p.video ? 'text-green-700' : 'text-gray-400'}`}><Film className="w-3 h-3" />{p.video ? 'có video' : 'chưa có video'}</span>
          <span className={`inline-flex items-center gap-1 ${p.factChecked ? 'text-green-700' : 'text-gray-400'}`}><ShieldCheck className="w-3 h-3" />{p.factChecked ? 'đã kiểm chứng' : 'chưa kiểm chứng'}</span>
          {p.posted?.url && <ExternalLink className="w-3 h-3 text-blue-600" aria-label="có link bài đăng" />}
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2 text-xs text-gray-400">
          <span className="line-clamp-2">{p.answer}</span>
        </div>
      )}
    </>
  );
  return p.id ? (
    <button onClick={() => onOpen(p.id!)} className="text-left w-full flex flex-col gap-1.5 bg-white border rounded-lg p-3 hover:shadow-md hover:border-blue-300 transition">{body}</button>
  ) : (
    <div className="flex flex-col gap-1.5 bg-gray-50 border border-dashed rounded-lg p-3">
      {body}
      <div className="flex items-center gap-2 mt-1">
        <CopyButton label="Chép lệnh nhờ AI viết" text={`Viết và kiểm chứng bài ${p.format === 'reels' ? 'Reels' : 'ảnh'} ngày ${p.date.split('-').reverse().slice(0, 2).join('/')} (${p.hook})`} />
      </div>
    </div>
  );
}

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-800">{title}</h3>{right}</div>
      {children}
    </section>
  );
}
const Pre = ({ children }: { children: string }) => <pre className="whitespace-pre-wrap break-words text-xs bg-gray-50 border rounded p-3 text-gray-800 font-sans leading-relaxed">{children || '—'}</pre>;

const toLocalInput = (iso?: string | null) => {
  const d = iso ? new Date(iso) : new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

function DetailDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<FbPostDetail | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [url, setUrl] = useState('');
  const [at, setAt] = useState('');
  const [note, setNote] = useState('');

  const apply = (x: FbPostDetail) => { setD(x); setUrl(x.posted?.url || ''); setAt(toLocalInput(x.posted?.at)); setNote(x.note); };
  useEffect(() => { fbPageAPI.detail(id).then(r => apply(r.data)).catch(e => setError(e.message || 'Không tải được bài')); }, [id]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);

  const save = async (patch: Parameters<typeof fbPageAPI.update>[1]) => {
    setSaving(true); setError('');
    try { apply((await fbPageAPI.update(id, patch)).data); onChanged(); } catch (e: any) { setError(e.message || 'Lỗi khi lưu'); } finally { setSaving(false); }
  };

  const fullPost = d ? `${d.caption.split('\n').filter(l => !/^Ảnh:|^\(Video dùng|^Bản đồ:/.test(l)).join('\n').trim()}\n\n${d.hashtags.join(' ')}` : '';
  const credit = d?.caption.split('\n').find(l => /^(Ảnh|Bản đồ):/.test(l)) || '';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-2xl h-full bg-white overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-white border-b p-4">
          <div className="min-w-0">
            <div className="text-xs text-gray-500">{d ? `${fmtDate(d.date)} · ${d.format === 'reels' ? 'Reels' : 'Ảnh'} · ${d.area}` : id}</div>
            <h2 className="font-bold text-gray-900 leading-snug">{d?.title || 'Đang tải…'}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="Đóng"><X className="w-5 h-5" /></button>
        </div>

        {!d && !error && <div className="p-6 flex items-center gap-2 text-gray-600"><Loader2 className="w-5 h-5 animate-spin" />Đang tải...</div>}
        {error && <div className="m-4 p-3 rounded border border-red-200 bg-red-50 text-red-800 text-sm">{error}</div>}

        {d && (
          <div className="p-4 space-y-5">
            <div className="flex flex-wrap items-center gap-2"><StageBadge stage={d.stage} />{saving && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}</div>

            {(
              <Section title="Video" right={d.video && <a href={fbPageAPI.videoUrl(d.id!, d.video.mtime)} download className="text-xs text-blue-600 hover:underline">Tải reel.mp4 ({(d.video.size / 1048576).toFixed(1)} MB)</a>}>
                {d.video
                  ? <video src={fbPageAPI.videoUrl(d.id!, d.video.mtime)} controls preload="metadata" className="w-full max-w-[280px] aspect-[9/16] rounded-lg bg-black mx-auto" />
                  : <div className="text-sm text-gray-500 border border-dashed rounded p-4 text-center">Chưa có video. Nhờ AI dựng: “dựng video cho bài {d.date}”.</div>}
              </Section>
            )}

            <Section title="Caption đăng Facebook (kèm hashtag)" right={<CopyButton text={fullPost} />}><Pre>{fullPost}</Pre></Section>
            {credit && <Section title="Credit ảnh (dán vào bình luận đầu tiên)" right={<CopyButton text={credit} />}><Pre>{credit}</Pre></Section>}

            <Section title="Trạng thái">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={d.factChecked} disabled={saving} onChange={e => save({ factChecked: e.target.checked })} className="w-4 h-4" />
                Đã kiểm chứng nội dung (fb-fact-checker đạt)
              </label>
              <div className="rounded border p-3 space-y-2 bg-gray-50">
                <div className="text-sm font-medium text-gray-800">Đã đăng lên page?</div>
                <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Link bài trên Facebook (https://www.facebook.com/…)" className="w-full border rounded px-2 py-1.5 text-sm bg-white" />
                <div className="flex flex-wrap items-center gap-2">
                  <input type="datetime-local" value={at} onChange={e => setAt(e.target.value)} className="border rounded px-2 py-1 text-sm bg-white" />
                  <button disabled={saving} onClick={() => save({ postedUrl: url, postedAt: new Date(at).toISOString() })} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40">
                    {d.posted ? 'Cập nhật' : 'Đánh dấu đã đăng'}
                  </button>
                  {d.posted && <button disabled={saving} onClick={() => save({ postedUrl: null, postedAt: null })} className="px-3 py-1.5 rounded border bg-white text-sm hover:bg-gray-50">Bỏ đánh dấu</button>}
                </div>
                {d.posted?.url && <a href={d.posted.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 inline-flex items-center gap-1 hover:underline"><ExternalLink className="w-3 h-3" />Mở bài đăng</a>}
              </div>
              <textarea value={note} onChange={e => setNote(e.target.value)} onBlur={() => note !== d.note && save({ note })} placeholder="Ghi chú (ví dụ: reach, bình luận đáng chú ý)…" rows={2} className="w-full border rounded px-2 py-1.5 text-sm" />
            </Section>

            {d.narration && <Section title="Lời đọc" right={<CopyButton text={d.narration} />}><Pre>{d.narration}</Pre></Section>}
            <Section title="Kịch bản theo cảnh"><Pre>{d.script}</Pre></Section>
            <Section title="Nguồn thông tin"><Pre>{d.sources}</Pre></Section>
            <Section title="Nguồn ảnh"><Pre>{d.imageSources}</Pre></Section>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FbPagePage() {
  const [posts, setPosts] = useState<FbPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [filter, setFilter] = useState<'all' | FbPostStage>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setPosts((await fbPageAPI.list()).data); setError(''); setUpdatedAt(new Date()); }
    catch (e: any) { setError(e.message || 'Không tải được danh sách'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, REFRESH_MS); return () => clearInterval(t); }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: posts.length };
    posts.forEach(p => { c[p.stage] = (c[p.stage] || 0) + 1; });
    return c;
  }, [posts]);

  const days = useMemo(() => {
    const q = query.trim().toLowerCase();
    const m = new Map<string, FbPost[]>();
    posts.filter(p => (filter === 'all' || p.stage === filter) && (!q || `${p.title} ${p.area} ${p.hook}`.toLowerCase().includes(q)))
      .forEach(p => { if (!m.has(p.date)) m.set(p.date, []); m.get(p.date)!.push(p); });
    return Array.from(m.entries());
  }, [posts, filter, query]);

  const today = new Date().toLocaleDateString('sv-SE');
  const next = posts.find(p => p.stage === 'ready' || p.stage === 'checked' || p.stage === 'written');

  if (loading) return <div className="p-6 flex items-center gap-2 text-gray-600"><Loader2 className="w-5 h-5 animate-spin" />Đang tải...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Facebook className="w-6 h-6 text-blue-600" />Page Facebook · Hôm Nay Mới Biết</h1>
          <p className="text-sm text-gray-600 mt-1">
            {posts.length} bài trong lịch · <span className="text-amber-700">{(counts.written || 0) + (counts.checked || 0)} đang làm</span> ·{' '}
            <span className="text-blue-700">{counts.ready || 0} sẵn sàng đăng</span> · <span className="text-green-700">{counts.posted || 0} đã đăng</span>
          </p>
        </div>
        {updatedAt && <span className="text-xs text-gray-500">cập nhật {updatedAt.toLocaleTimeString('vi-VN')}</span>}
      </div>

      {error && <div className="p-3 rounded border border-red-200 bg-red-50 text-red-800 text-sm">{error}</div>}

      {next?.id && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
          <span className="text-blue-900">Bài tiếp theo cần xử lý: <b>{fmtDate(next.date)}</b> · {next.title}</span>
          <button onClick={() => setOpenId(next.id)} className="px-3 py-1 rounded bg-blue-600 text-white font-medium hover:bg-blue-700">Mở</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded-full text-sm border ${filter === f.key ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white hover:bg-gray-50 text-gray-700'}`}>
            {f.label} <span className="opacity-70">{counts[f.key] || 0}</span>
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm theo tiêu đề, mảng…" className="pl-8 pr-2 py-1.5 border rounded text-sm w-56" />
        </div>
      </div>

      <div className="hidden md:grid grid-cols-[96px_1fr_1fr] gap-3 sticky top-0 z-10 bg-gray-50/95 backdrop-blur py-2 border-b text-xs font-medium text-gray-500">
        <div>Ngày đăng</div>{FORMATS.map(f => <div key={f.key}>{f.label}</div>)}
      </div>

      <div className="space-y-3">
        {days.map(([date, ps]) => {
          const isToday = date === today;
          return (
            <div key={date} className={`grid grid-cols-1 md:grid-cols-[96px_1fr_1fr] gap-3 rounded-lg ${isToday ? 'ring-2 ring-blue-500 ring-offset-4 ring-offset-gray-50' : ''}`}>
              <div className="flex md:flex-col items-baseline md:items-start gap-2 md:gap-0.5 md:pt-1">
                <div className={`text-sm font-bold ${isToday ? 'text-blue-700' : 'text-gray-900'}`}>{fmtDate(date)}</div>
                <div className="text-xs text-gray-500">{isToday ? 'hôm nay' : date}</div>
              </div>
              {FORMATS.map(f => (
                <div key={f.key} className="space-y-2 min-w-0">
                  {ps.filter(p => p.format === f.key).map(p => <PostCard key={p.id || `${p.date}-${p.format}`} p={p} onOpen={setOpenId} />)}
                  {!ps.some(p => p.format === f.key) && <div className="min-h-[56px] rounded-lg border border-dashed text-xs text-gray-300 flex items-center justify-center"><CircleDashed className="w-4 h-4" /></div>}
                </div>
              ))}
            </div>
          );
        })}
        {days.length === 0 && <div className="text-sm text-gray-500 p-8 text-center">Không có bài nào khớp bộ lọc.</div>}
      </div>

      {openId && <DetailDrawer id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}
