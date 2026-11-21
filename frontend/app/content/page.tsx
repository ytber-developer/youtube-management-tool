'use client';

// Trang /content: trạng thái từng video (tự cập nhật theo file trên đĩa) + tự đăng YouTube các video đã sẵn sàng.
// Viết kịch bản, build, giọng vẫn chạy qua chat AI → `npm run content -- …`.
// Bố cục: mỗi hàng là một ngày đăng, mỗi cột là một kênh.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Film, Loader2, ExternalLink, ImageOff, Upload } from 'lucide-react';
import { contentAPI, ContentVideo } from '@/lib/api';
import { CHANNEL, DOT, DOT_TEXT, StepDots, StageBadge, ChannelBadge, fmtDuration, fmtDate } from '@/components/ContentStatus';
import { useAccounts, useChannelAccount, AccountSelect, UploadBadge, canQueue } from '@/components/ContentUpload';

const REFRESH_MS = 15000;
const CHANNELS = Object.keys(CHANNEL);

function VideoCard({ v }: { v: ContentVideo }) {
  return (
    <Link href={`/content/${v.id}`} className="group flex gap-3 bg-white border rounded-lg p-2 hover:shadow-md hover:border-blue-300 transition">
      <div className="relative w-40 sm:w-44 shrink-0 aspect-video rounded overflow-hidden bg-gray-100 flex items-center justify-center">
        {v.thumbnail
          ? <img src={contentAPI.fileUrl(v.id, 'thumbnail.png', v.thumbnail)} alt="" loading="lazy" className="w-full h-full object-cover" />
          : <ImageOff className="w-7 h-7 text-gray-300" />}
        <span className="absolute bottom-1 right-1 px-1 rounded bg-black/75 text-white text-[11px] tabular-nums">{fmtDuration(v.status.durationEst)}</span>
      </div>
      <div className="min-w-0 flex-1 flex flex-col gap-1.5">
        <div className="font-semibold text-sm text-gray-900 leading-snug line-clamp-2 group-hover:text-blue-700">
          <span className="text-gray-400 font-normal">#{v.number} </span>{v.title}
        </div>
        {v.status.errors.length > 0 && <div className="text-xs text-red-600 line-clamp-2">{v.status.errors.slice(0, 2).join(' · ')}{v.status.errors.length > 2 ? ` (+${v.status.errors.length - 2})` : ''}</div>}
        {v.status.missingScenes.length > 0 && <div className="text-xs text-red-600">thiếu ảnh cảnh {v.status.missingScenes.join(', ')}</div>}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5"><StageBadge status={v.status} /><UploadBadge upload={v.upload} /></span>
          <div className="flex items-center gap-2">
            {v.status.uploadedUrl && <ExternalLink className="w-3.5 h-3.5 text-blue-600" aria-label="đã có link YouTube" />}
            <StepDots status={v.status} />
          </div>
        </div>
      </div>
    </Link>
  );
}

/** Một kênh trong bảng "Tự đăng": chọn tài khoản + nút xếp mọi video sẵn sàng của kênh vào hàng đợi */
function ChannelUploader({ channel, videos, accounts, onQueued }: {
  channel: string; videos: ContentVideo[]; accounts: { id: number; email: string; channelName?: string }[]; onQueued: () => void;
}) {
  const [accountId, setAccountId] = useChannelAccount(channel);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const ready = videos.filter(v => canQueue(v.status.stageKey, v.upload));
  const queued = videos.filter(v => v.upload && ['pending', 'uploading', 'downloading', 'downloaded'].includes(v.upload.status)).length;
  const account = accounts.find(a => a.id === accountId);

  const run = async () => {
    if (!accountId || !ready.length) return;
    setBusy(true); setMsg('');
    try {
      const r = await contentAPI.queueUpload(ready.map(v => v.id), accountId);
      const skipped = r.data.skipped.length ? ` · bỏ qua ${r.data.skipped.length}: ${r.data.skipped.slice(0, 3).map(x => x.reason).join('; ')}` : '';
      setMsg(`${r.message}${skipped}`);
      onQueued();
    } catch (e: any) { setMsg(e.message || 'Lỗi'); }
    finally { setBusy(false); setConfirm(false); }
  };

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <ChannelBadge channel={channel} />
        <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} className="flex-1 min-w-[200px]" />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
        {!confirm ? (
          <button onClick={() => setConfirm(true)} disabled={!accountId || !ready.length || busy}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-blue-700">
            <Upload className="w-4 h-4" />Đăng {ready.length} video sẵn sàng
          </button>
        ) : (
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="text-gray-800">Upload <b>{ready.length}</b> video bằng <b>{account?.email}</b>, mỗi video công khai 12:00 PM ET ngày đăng của nó?</span>
            <button onClick={run} disabled={busy} className="px-3 py-1 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40">
              {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Đăng'}
            </button>
            <button onClick={() => setConfirm(false)} disabled={busy} className="px-3 py-1 rounded border text-sm bg-white hover:bg-gray-50">Huỷ</button>
          </span>
        )}
        {queued > 0 && <span>{queued} đang trong hàng đợi</span>}
      </div>
      {msg && <div className="text-xs text-gray-700">{msg}</div>}
    </div>
  );
}

export default function ContentStatusPage() {
  const { accounts, error: accErr } = useAccounts();
  const [videos, setVideos] = useState<ContentVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await contentAPI.list();
      setVideos(r.data);
      setError('');
      setUpdatedAt(new Date());
    } catch (e: any) {
      setError(e.message || 'Không tải được danh sách');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  // ngày → kênh → video; ngày sớm nhất = Ngày 1
  const days = useMemo(() => {
    const m = new Map<string, Record<string, ContentVideo[]>>();
    videos.forEach(v => {
      if (!m.has(v.date)) m.set(v.date, {});
      (m.get(v.date)![v.channel] ||= []).push(v);
    });
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [videos]);

  const counts = useMemo(() => {
    const c = { error: 0, building: 0, ready: 0, done: 0 };
    videos.forEach(v => {
      const k = v.status.stageKey;
      if (k === 'script') c.error++;
      else if (k === 'uploaded') c.ready++;
      else if (k === 'done') c.done++;
      else c.building++;
    });
    return c;
  }, [videos]);

  const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD giờ máy

  if (loading) return <div className="p-6 flex items-center gap-2 text-gray-600"><Loader2 className="w-5 h-5 animate-spin" />Đang tải...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Film className="w-6 h-6 text-blue-600" />Nội dung</h1>
          <p className="text-sm text-gray-600 mt-1">
            {videos.length} video · {days.length} ngày · <span className="text-red-600">{counts.error} kịch bản lỗi</span> · {counts.building} đang làm ·{' '}
            <span className="text-blue-700">{counts.ready} chờ đăng</span> · <span className="text-green-700">{counts.done} đã đăng</span>
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-3">
            {(Object.keys(DOT) as (keyof typeof DOT)[]).map(k => (
              <span key={k} className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-full ${DOT[k]}`} />{DOT_TEXT[k]}</span>
            ))}
          </span>
          {updatedAt && <span>cập nhật {updatedAt.toLocaleTimeString('vi-VN')}</span>}
        </div>
      </div>

      {error && <div className="p-3 rounded border border-red-200 bg-red-50 text-red-800 text-sm">{error}</div>}

      {/* Tự đăng YouTube: tool mở Chrome của tài khoản, upload final.mp4 + thumbnail + tiêu đề/mô tả/tags, hẹn giờ công khai 12:00 PM ET */}
      <section className="bg-white border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold text-sm text-gray-800 flex items-center gap-2"><Upload className="w-4 h-4 text-blue-600" />Tự đăng YouTube</h2>
        <p className="text-xs text-gray-500">
          Bấm Đăng → tool mở Chrome của tài khoản và upload ngay, từng video một, hẹn công khai 12:00 PM ET ngày đăng. Muốn chọn giờ khác thì vào trang chi tiết video.
          Upload xong tự ghi link vào video. Tài khoản phải đã đăng nhập và có kênh.
        </p>
        {accErr && <div className="text-xs text-red-600">{accErr}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CHANNELS.map(ch => (
            <ChannelUploader key={ch} channel={ch} videos={videos.filter(v => v.channel === ch)} accounts={accounts} onQueued={load} />
          ))}
        </div>
      </section>

      {/* Tiêu đề cột kênh (ẩn trên màn hình hẹp, khi đó mỗi thẻ có nhãn kênh riêng) */}
      <div className="hidden md:grid grid-cols-[96px_1fr_1fr] gap-3 sticky top-0 z-10 bg-gray-50/95 backdrop-blur py-2 border-b">
        <div className="text-xs font-medium text-gray-500 self-center">Ngày đăng</div>
        {CHANNELS.map(ch => <div key={ch}><ChannelBadge channel={ch} /></div>)}
      </div>

      <div className="space-y-3">
        {days.map(([date, byChannel], i) => {
          const isToday = date === today;
          return (
            <div key={date} className={`grid grid-cols-1 md:grid-cols-[96px_1fr_1fr] gap-3 rounded-lg ${isToday ? 'ring-2 ring-blue-500 ring-offset-4 ring-offset-gray-50' : ''}`}>
              <div className="flex md:flex-col items-baseline md:items-start gap-2 md:gap-0.5 md:pt-1">
                <div className={`text-sm font-bold ${isToday ? 'text-blue-700' : 'text-gray-900'}`}>Ngày {i + 1}</div>
                <div className="text-xs text-gray-600">{isToday ? 'hôm nay' : fmtDate(date)}</div>
                <div className="text-[11px] text-gray-400">{date}</div>
              </div>
              {CHANNELS.map(ch => (
                <div key={ch} className="space-y-2 min-w-0">
                  <div className="md:hidden"><ChannelBadge channel={ch} /></div>
                  {(byChannel[ch] || []).map(v => <VideoCard key={v.id} v={v} />)}
                  {!byChannel[ch] && <div className="h-full min-h-[60px] rounded-lg border border-dashed text-xs text-gray-400 flex items-center justify-center">không có video</div>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {videos.length === 0 && <div className="text-sm text-gray-500 p-8 text-center">Chưa có video nào trong content/.</div>}
    </div>
  );
}
