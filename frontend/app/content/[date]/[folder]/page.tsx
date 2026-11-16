'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Copy, Check, Loader2, Mic, Download, X, ExternalLink, ImageOff } from 'lucide-react';
import { contentAPI, ContentAction, ContentDetail } from '@/lib/api';
import { CHANNEL_META, ACTION_LABEL, StepDots, StageBadge, JobBar, fmtDuration, fmtDate } from '@/components/ContentStatus';

const ACTIONS: ContentAction[] = ['images', 'slides', 'thumb', 'package', 'preview', 'tts', 'render'];

function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-gray-50"
    >
      {ok ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}{ok ? 'Đã copy' : label}
    </button>
  );
}

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white border rounded-lg">
      <div className="flex items-center justify-between px-4 py-2.5 border-b">
        <h2 className="font-semibold text-sm text-gray-800">{title}</h2>
        <div className="flex gap-2">{right}</div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function ContentDetailPage() {
  const params = useParams<{ date: string; folder: string }>();
  const id = `${params.date}/${params.folder}`;
  const [d, setD] = useState<ContentDetail | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [zoom, setZoom] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [url, setUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await contentAPI.detail(id);
      setD(r.data);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Không tải được video');
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (d) setUrl(d.review.uploadedUrl || ''); }, [d?.review.uploadedUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  // Đang có tác vụ → cập nhật mỗi 2 giây
  const busy = !!d?.job;
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [busy, load]);

  const run = async (a: ContentAction) => {
    setMsg('');
    try { await contentAPI.action(id, a); await load(); }
    catch (e: any) { setMsg(e.message); }
  };

  const saveReview = async (body: { imagesReviewed?: boolean; uploadedUrl?: string | null }) => {
    try { await contentAPI.review(id, body); await load(); setMsg('Đã lưu'); }
    catch (e: any) { setMsg(e.message); }
  };

  const upload = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true); setMsg('');
    try { const r = await contentAPI.uploadVoice(id, f); setMsg(r.message || 'Đã nhận giọng đọc, đang render video cuối'); await load(); }
    catch (e: any) { setMsg(e.message); }
    finally { setUploading(false); }
  };

  if (error) return <div className="p-6"><Link href="/content" className="text-sm text-blue-600">← Danh sách</Link><div className="mt-4 p-3 rounded border border-red-200 bg-red-50 text-red-800 text-sm">{error}</div></div>;
  if (!d) return <div className="p-6 flex items-center gap-2 text-gray-600"><Loader2 className="w-5 h-5 animate-spin" />Đang tải...</div>;

  const f = (name: string) => contentAPI.fileUrl(id, name, d.files[name]);
  const s = d.status;
  const tags = d.script.tags.join(', ');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <Link href="/content" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"><ArrowLeft className="w-4 h-4" />Danh sách</Link>

      {/* Đầu trang: thumbnail + tiêu đề + trạng thái */}
      <div className="flex flex-col lg:flex-row gap-5 bg-white border rounded-lg p-4">
        <div className="lg:w-[420px] shrink-0 aspect-video rounded overflow-hidden bg-gray-100 flex items-center justify-center">
          {d.files['thumbnail.png']
            ? <img src={f('thumbnail.png')} alt="thumbnail" className="w-full h-full object-cover cursor-zoom-in" onClick={() => setZoom(f('thumbnail.png'))} />
            : <div className="text-center text-gray-400 text-sm"><ImageOff className="w-8 h-8 mx-auto mb-1" />Chưa có thumbnail</div>}
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className={`px-2 py-0.5 rounded font-medium ${CHANNEL_META[d.channel].badge}`}>{CHANNEL_META[d.channel].name}</span>
            <span className="text-gray-500">#{d.number} · đăng {fmtDate(d.date)} ({d.date}) · ~{fmtDuration(s.durationEst)}</span>
          </div>
          <div className="flex items-start gap-2">
            <h1 className="text-xl font-bold text-gray-900 flex-1">{d.script.title}</h1>
            <CopyBtn text={d.script.title} label="Tiêu đề" />
          </div>
          <div className="text-sm text-gray-600">Chữ trên thumbnail: <b>{d.script.thumbnail_text}</b></div>
          <div className="flex items-center gap-3"><StageBadge status={s} /></div>
          <StepDots status={s} size="lg" />
          {s.errors.length > 0 && <ul className="text-sm text-red-700 list-disc pl-5">{s.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
          {s.missingScenes.length > 0 && <div className="text-sm text-red-600">Thiếu ảnh cảnh: {s.missingScenes.join(', ')} ({s.imagesHave}/{s.imagesNeed})</div>}
          <div className="flex flex-wrap gap-2 pt-1">
            {ACTIONS.map(a => (
              <button key={a} disabled={busy || (a === 'render' && !d.files['voice.mp3'])} onClick={() => run(a)}
                className={`px-3 py-1.5 text-sm rounded border ${a === 'render' ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' : 'hover:bg-gray-50'} disabled:opacity-40 disabled:cursor-not-allowed`}>
                {ACTION_LABEL[a]}
              </button>
            ))}
          </div>
          <JobBar job={d.job} />
          {msg && <div className="text-sm text-gray-700">{msg}</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Lồng tiếng */}
        <Card title="Lồng tiếng (ElevenLabs)" right={d.narration ? <CopyBtn text={d.narration} label="Copy lời đọc" /> : null}>
          <div className="text-xs text-gray-500 mb-2">
            Gợi ý giọng: {d.channel === 'cosmic-what-if' ? 'Adam — trầm, chắc' : 'chưa chọn'} · {d.narration?.length || 0} ký tự
          </div>
          <div
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer text-sm ${drag ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}
          >
            <input ref={fileRef} type="file" accept=".mp3,.m4a,.wav,audio/*" className="hidden" onChange={e => upload(e.target.files?.[0])} />
            {uploading ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Đang tải lên...</span>
              : <><Mic className="w-6 h-6 mx-auto text-gray-400 mb-1" />Kéo thả file giọng đọc (.mp3/.m4a/.wav) vào đây — tự render video cuối</>}
          </div>
          {d.files['voice.mp3'] && <audio controls src={f('voice.mp3')} className="w-full mt-3" />}
        </Card>

        {/* Video */}
        <Card title="Video" right={d.files['captions.srt'] ? <a href={f('captions.srt')} download className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-gray-50"><Download className="w-3.5 h-3.5" />captions.srt</a> : null}>
          {d.files['final.mp4'] ? (
            <><div className="text-xs font-medium text-gray-600 mb-1">Video cuối (có giọng)</div>
              <video controls src={f('final.mp4')} className="w-full rounded bg-black" />
              <a href={f('final.mp4')} download className="inline-flex items-center gap-1 text-xs mt-2 text-blue-600"><Download className="w-3.5 h-3.5" />Tải final.mp4</a></>
          ) : d.files['preview.mp4'] ? (
            <><div className="text-xs font-medium text-gray-600 mb-1">Preview (không tiếng, thời gian ước lượng)</div>
              <video controls src={f('preview.mp4')} className="w-full rounded bg-black" /></>
          ) : <div className="text-sm text-gray-500">Chưa có video. Bấm “Dựng preview”.</div>}
        </Card>
      </div>

      {/* Metadata YouTube */}
      <Card title="Thông tin đăng YouTube">
        <div className="space-y-3 text-sm">
          <div>
            <div className="flex items-center justify-between mb-1"><span className="font-medium">Mô tả</span><CopyBtn text={d.script.description} /></div>
            <pre className="whitespace-pre-wrap font-sans bg-gray-50 border rounded p-3 text-gray-800">{d.script.description}</pre>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1"><span className="font-medium">Tags</span><CopyBtn text={tags} /></div>
            <div className="flex flex-wrap gap-1">{d.script.tags.map(t => <span key={t} className="px-2 py-0.5 bg-gray-100 rounded text-xs">{t}</span>)}</div>
          </div>
          {d.metadata && (
            <details>
              <summary className="cursor-pointer text-gray-600">metadata.md (mô tả đầy đủ kèm credit ảnh, giờ đăng)</summary>
              <div className="flex justify-end my-1"><CopyBtn text={d.metadata} label="Copy metadata.md" /></div>
              <pre className="whitespace-pre-wrap font-mono text-xs bg-gray-50 border rounded p-3">{d.metadata}</pre>
            </details>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
            <span className="font-medium">Link sau khi đăng:</span>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://youtu.be/..." className="border rounded px-2 py-1 flex-1 min-w-[240px]" />
            <button onClick={() => saveReview({ uploadedUrl: url.trim() || null })} className="px-3 py-1 rounded bg-blue-600 text-white text-sm">Lưu</button>
            {d.review.uploadedUrl && <a href={d.review.uploadedUrl} target="_blank" rel="noreferrer" className="text-blue-600 inline-flex items-center gap-1"><ExternalLink className="w-4 h-4" />Mở</a>}
          </div>
        </div>
      </Card>

      {/* Slide + nội dung từng cảnh */}
      <Card title={`Kịch bản & slide (${d.script.scenes.length} cảnh)`} right={
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={!!d.review.imagesReviewed} onChange={e => saveReview({ imagesReviewed: e.target.checked })} />
          Đã duyệt ảnh
        </label>
      }>
        <div className="space-y-3">
          {d.script.scenes.map((sc, i) => {
            const sl = d.slides[i];
            const cr = d.credits.find(c => c.scene === i + 1);
            const missing = s.missingScenes.includes(i + 1);
            return (
              <div key={i} className={`flex flex-col md:flex-row gap-3 p-2 rounded border ${missing ? 'border-red-300 bg-red-50' : 'border-gray-100'}`}>
                <div className="md:w-64 shrink-0 aspect-video rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                  {sl?.exists
                    ? <img src={contentAPI.fileUrl(id, sl.file, d.files['slides/contact.jpg'])} alt="" loading="lazy" className="w-full h-full object-cover cursor-zoom-in" onClick={() => setZoom(contentAPI.fileUrl(id, sl.file, d.files['slides/contact.jpg']))} />
                    : <span className="text-xs text-gray-400">chưa dựng slide</span>}
                </div>
                <div className="flex-1 min-w-0 text-sm space-y-1">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="font-semibold text-gray-700">Cảnh {i + 1}</span>
                    <span className="px-1.5 bg-gray-100 rounded">{sc.visual.type}</span>
                    {missing && <span className="text-red-600 font-medium">thiếu ảnh</span>}
                  </div>
                  <div className="font-semibold" dangerouslySetInnerHTML={{ __html: sc.headline.replace(/<(?!\/?em>)[^>]*>/g, '') }} />
                  {sc.sub && <div className="text-gray-500 text-xs">{sc.sub}</div>}
                  <p className="text-gray-800">{sc.narration}</p>
                  {cr && !cr.missing && <div className="text-xs text-gray-400 truncate">Ảnh: {cr.credit}{cr.url && <> · <a href={cr.url} target="_blank" rel="noreferrer" className="underline">nguồn</a></>}</div>}
                  {sc.visual.query && <div className="text-xs text-gray-400">query: {sc.visual.query}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Nguồn tham khảo">
        <ul className="text-sm list-disc pl-5 space-y-1">
          {d.script.sources.map((src, i) => <li key={i}><a href={src.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{src.title}</a></li>)}
        </ul>
      </Card>

      {zoom && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6" onClick={() => setZoom(null)}>
          <button className="absolute top-4 right-4 text-white"><X className="w-6 h-6" /></button>
          <img src={zoom} alt="" className="max-w-full max-h-full rounded" />
        </div>
      )}
    </div>
  );
}
