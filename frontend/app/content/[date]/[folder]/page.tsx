'use client';

// Chi tiết một video: mọi thứ để đăng YouTube (video, thumbnail, tiêu đề, mô tả, tags, phụ đề, giờ đăng) + nút tự đăng.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Copy, Check, Loader2, Download, ExternalLink, ImageOff, Clock, Upload } from 'lucide-react';
import { contentAPI, ContentDetail, ContentFile } from '@/lib/api';
import { StepDots, StageBadge, ChannelBadge, fmtDuration, fmtDate } from '@/components/ContentStatus';
import { useAccounts, useChannelAccount, AccountSelect, SchedulePicker, UploadBadge, canQueue, fmtWhen, toLocalInput, fromLocalInput } from '@/components/ContentUpload';

/** Bảng tự đăng YouTube cho video này */
function AutoUpload({ d, reload }: { d: ContentDetail; reload: () => void }) {
  const { accounts, error: accErr } = useAccounts();
  const [accountId, setAccountId] = useChannelAccount(d.channel);
  const [when, setWhen] = useState(() => toLocalInput(d.postAt)); // giờ công khai, mặc định 12:00 PM ET ngày đăng
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const u = d.upload;
  const active = !!u && ['pending', 'uploading', 'downloading', 'downloaded'].includes(u.status);
  const ready = canQueue(d.status.stageKey, u);

  const act = async (fn: () => Promise<{ message: string }>) => {
    setBusy(true); setMsg('');
    try { setMsg((await fn()).message); reload(); } catch (e: any) { setMsg(e.message || 'Lỗi'); } finally { setBusy(false); }
  };

  if (d.status.uploadedUrl) return null;
  return (
    <section className="bg-white border rounded-lg p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold text-sm text-gray-800 flex items-center gap-2"><Upload className="w-4 h-4 text-blue-600" />Tự đăng YouTube</h2>
        <UploadBadge upload={u} detail />
        {u?.email && <span className="text-xs text-gray-500">bằng {u.email}</span>}
      </div>
      {u?.status === 'failed' && u.error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 break-words">{u.error}</div>}
      {u?.status === 'completed' && !u.videoUrl && <div className="text-xs text-amber-700">Đã upload nhưng chưa lấy được link. Lấy link trong YouTube Studio rồi chạy: <code>npm run content -- uploaded {d.id} &lt;link&gt;</code></div>}
      {u?.scheduleDate && active && <div className="text-xs text-gray-600">Sẽ công khai lúc {fmtWhen(u.scheduleDate)} (giờ máy)</div>}
      {!active && u?.status !== 'completed' && (
        <div className="flex flex-wrap items-center gap-2">
          <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} className="min-w-[220px]" />
          <SchedulePicker value={when} onChange={setWhen} />
          <button disabled={!ready || !accountId || !when || busy} onClick={() => act(() => contentAPI.queueUpload([d.id], accountId!, fromLocalInput(when)))}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-blue-700">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}{u?.status === 'failed' ? 'Thử lại' : 'Đăng video này'}
          </button>
          {!ready && <span className="text-xs text-gray-500">chưa sẵn sàng: {d.status.stage}</span>}
          <span className="text-xs text-gray-400 basis-full">Bấm Đăng → mở Chrome của tài khoản, upload ngay và hẹn công khai lúc giờ đã chọn (mặc định {d.postTime.et}).</span>
        </div>
      )}
      {u?.status === 'pending' && (
        <button disabled={busy} onClick={() => act(() => contentAPI.cancelUpload(d.id))} className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50">Bỏ khỏi hàng đợi</button>
      )}
      {accErr && <div className="text-xs text-red-600">{accErr}</div>}
      {msg && <div className="text-xs text-gray-700">{msg}</div>}
    </section>
  );
}

function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50 shrink-0"
    >
      {ok ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}{ok ? 'Đã copy' : label}
    </button>
  );
}

// "kola superdeep borehole" → "#kolasuperdeepborehole"; YouTube bỏ qua mọi hashtag nếu có quá 15
const toHashtags = (tags: string[]) =>
  Array.from(new Set(tags.map(t => t.replace(/[^a-zA-Z0-9]+/g, '')).filter(Boolean))).slice(0, 15).map(t => `#${t}`).join(' ');

function Field({ label, copy, actions, children }: { label: string; copy?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white border rounded-lg">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h2 className="font-semibold text-sm text-gray-800">{label}</h2>
        <div className="flex gap-2">{actions}{copy !== undefined && <CopyBtn text={copy} />}</div>
      </div>
      <div className="p-4 text-sm">{children}</div>
    </section>
  );
}

export default function ContentDetailPage() {
  const params = useParams<{ date: string; folder: string }>();
  const id = `${params.date}/${params.folder}`;
  const [d, setD] = useState<ContentDetail | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await contentAPI.detail(id);
      setD(r.data);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Không tải được video');
    }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // theo dõi tiến độ hàng đợi tự đăng
    return () => clearInterval(t);
  }, [load]);

  const back = <Link href="/content" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"><ArrowLeft className="w-4 h-4" />Danh sách</Link>;
  if (error) return <div className="p-6 space-y-4">{back}<div className="p-3 rounded border border-red-200 bg-red-50 text-red-800 text-sm">{error}</div></div>;
  if (!d) return <div className="p-6 flex items-center gap-2 text-gray-600"><Loader2 className="w-5 h-5 animate-spin" />Đang tải...</div>;

  const url = (f: ContentFile) => contentAPI.fileUrl(id, f, d.files[f]);
  const dl = (f: ContentFile, label: string) => d.files[f]
    ? <a href={url(f)} download className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"><Download className="w-3.5 h-3.5" />{label}</a>
    : <span className="text-xs text-gray-400">chưa có {label}</span>;
  const s = d.status;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      {back}

      <div className="bg-white border rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <ChannelBadge channel={d.channel} />
          <span>#{d.number}</span>
          <span>· {fmtDate(d.date)}</span>
          <span>· ~{fmtDuration(s.durationEst)}</span>
          <StageBadge status={s} />
          {s.uploadedUrl && <a href={s.uploadedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline"><ExternalLink className="w-4 h-4" />Xem trên YouTube</a>}
        </div>
        <StepDots status={s} labels />
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Clock className="w-4 h-4 text-gray-400" />Hẹn giờ đăng: <b>{d.postTime.et}</b> <span className="text-gray-500">({d.postTime.vn})</span>
        </div>
        {s.errors.length > 0 && <ul className="text-sm text-red-700 list-disc pl-5">{s.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
      </div>

      <AutoUpload d={d} reload={load} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white border rounded-lg">
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <h2 className="font-semibold text-sm text-gray-800">Video</h2>
            <div className="flex gap-2">{dl('final.mp4', 'final.mp4')}{dl('captions.srt', 'captions.srt')}</div>
          </div>
          <div className="p-4">
            {d.files['final.mp4']
              ? <video controls preload="metadata" src={url('final.mp4')} className="w-full rounded bg-black aspect-video" />
              : <div className="aspect-video rounded bg-gray-100 flex items-center justify-center text-sm text-gray-500">Chưa render video cuối</div>}
            {s.steps.final === 'stale' && <div className="text-xs text-amber-700 mt-2">Video này dựng từ kịch bản/giọng cũ — cần render lại trước khi đăng.</div>}
          </div>
        </section>

        <section className="bg-white border rounded-lg">
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <h2 className="font-semibold text-sm text-gray-800">Thumbnail</h2>
            {dl('thumbnail.png', 'thumbnail.png')}
          </div>
          <div className="p-4">
            {d.files['thumbnail.png']
              ? <img src={url('thumbnail.png')} alt="thumbnail" className="w-full rounded aspect-video object-cover" />
              : <div className="aspect-video rounded bg-gray-100 flex flex-col items-center justify-center text-sm text-gray-400"><ImageOff className="w-8 h-8 mb-1" />Chưa có thumbnail</div>}
            <div className="text-xs text-gray-500 mt-2">Chữ trên thumbnail: <b>{d.thumbnailText}</b></div>
          </div>
        </section>
      </div>

      <Field label="Tiêu đề" copy={d.title}>
        <div className="text-base font-semibold text-gray-900">{d.title}</div>
        <div className="text-xs text-gray-400 mt-1">{d.title.length}/100 ký tự</div>
      </Field>

      <Field label="Mô tả" copy={d.description}>
        <pre className="whitespace-pre-wrap font-sans text-gray-800 leading-relaxed">{d.description}</pre>
        <div className="text-xs text-gray-400 mt-2">{d.description.length}/5000 ký tự</div>
      </Field>

      <Field label="Tags" actions={<><CopyBtn text={toHashtags(d.tags)} label="Copy #hashtag" /><CopyBtn text={d.tags.join(', ')} label="Copy tags" /></>}>
        <div className="flex flex-wrap gap-1">{d.tags.map(t => <span key={t} className="px-2 py-0.5 bg-gray-100 rounded text-xs">{t}</span>)}</div>
        <div className="text-xs text-gray-500 mt-3 break-words">{toHashtags(d.tags)}</div>
        <div className="text-xs text-gray-400 mt-2">
          <b>Copy #hashtag</b> → dán vào cuối ô Description · <b>Copy tags</b> → dán vào ô Tags (Show more) · {d.tags.join(', ').length}/500 ký tự
        </div>
      </Field>
    </div>
  );
}
