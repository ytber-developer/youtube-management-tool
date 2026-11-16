'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Film, Loader2, Search, ImageOff } from 'lucide-react';
import { contentAPI, ContentVideo } from '@/lib/api';
import { STEPS, CHANNEL_META, StepDots, StageBadge, JobBar, fmtDuration, fmtDate } from '@/components/ContentStatus';

export default function ContentListPage() {
  const [videos, setVideos] = useState<ContentVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [channel, setChannel] = useState('all');
  const [stage, setStage] = useState('all');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await contentAPI.list();
      setVideos(r.data);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Không tải được danh sách');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  // Có tác vụ đang chạy → cập nhật mỗi 3 giây
  const anyJob = videos.some(v => v.job);
  useEffect(() => {
    if (!anyJob) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [anyJob, load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return videos.filter(v =>
      (channel === 'all' || v.channel === channel) &&
      (stage === 'all' || v.status.stageKey === stage) &&
      (!s || v.title.toLowerCase().includes(s) || v.slug.includes(s)));
  }, [videos, channel, stage, q]);

  const byDate = useMemo(() => {
    const m = new Map<string, ContentVideo[]>();
    filtered.forEach(v => { if (!m.has(v.date)) m.set(v.date, []); m.get(v.date)!.push(v); });
    return Array.from(m.entries());
  }, [filtered]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    videos.forEach(v => { c[v.status.stageKey] = (c[v.status.stageKey] || 0) + 1; });
    return c;
  }, [videos]);

  if (loading) return <div className="p-6 flex items-center gap-2 text-gray-600"><Loader2 className="w-5 h-5 animate-spin" />Đang tải...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Film className="w-6 h-6 text-blue-600" />Nội dung</h1>
          <p className="text-sm text-gray-600 mt-1">
            {videos.length} video · lịch {videos[0] && fmtDate(videos[0].date)} → {videos.length > 0 && fmtDate(videos[videos.length - 1].date)} ·{' '}
            {counts.voice || 0} chờ lồng tiếng · {counts.uploaded || 0} chờ đăng · {counts.done || 0} đã đăng
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm tiêu đề..." className="border rounded pl-8 pr-3 py-1.5 text-sm w-56" />
          </div>
          <select value={channel} onChange={e => setChannel(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
            <option value="all">Tất cả kênh</option>
            {Object.entries(CHANNEL_META).map(([k, m]) => <option key={k} value={k}>{m.name}</option>)}
          </select>
          <select value={stage} onChange={e => setStage(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
            <option value="all">Mọi trạng thái</option>
            {STEPS.map(s => <option key={s.key} value={s.key}>Đang ở: {s.label}{counts[s.key] ? ` (${counts[s.key]})` : ''}</option>)}
            <option value="done">Đã đăng{counts.done ? ` (${counts.done})` : ''}</option>
          </select>
        </div>
      </div>

      {error && <div className="p-3 rounded border border-red-200 bg-red-50 text-red-800 text-sm">{error}</div>}

      {byDate.map(([date, list]) => (
        <section key={date}>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">{fmtDate(date)} <span className="text-gray-400 font-normal">· {date}</span></h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {list.map(v => (
              <Link key={v.id} href={`/content/${v.id}`} className="flex gap-4 bg-white border rounded-lg p-3 hover:shadow-md hover:border-blue-300 transition">
                <div className="w-48 shrink-0 aspect-video rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                  {v.status.hasThumbnail
                    ? <img src={contentAPI.fileUrl(v.id, 'thumbnail.png', Date.now() / 60000 | 0)} alt="" className="w-full h-full object-cover" />
                    : <ImageOff className="w-6 h-6 text-gray-300" />}
                </div>
                <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded font-medium ${CHANNEL_META[v.channel].badge}`}>{CHANNEL_META[v.channel].name}</span>
                    <span className="text-gray-500">#{v.number} · {fmtDuration(v.status.durationEst)}</span>
                  </div>
                  <div className="font-semibold text-gray-900 leading-snug line-clamp-2">{v.title}</div>
                  <div className="flex items-center gap-3 mt-auto">
                    <StageBadge status={v.status} />
                    <StepDots status={v.status} />
                    {v.status.missingScenes.length > 0 && <span className="text-xs text-red-600">thiếu {v.status.missingScenes.length} ảnh</span>}
                  </div>
                  <JobBar job={v.job} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
      {byDate.length === 0 && <div className="text-sm text-gray-500 p-8 text-center">Không có video nào khớp bộ lọc.</div>}
    </div>
  );
}
