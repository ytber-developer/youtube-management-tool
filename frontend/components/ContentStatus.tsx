'use client';

import type { ContentStatus, ContentStepKey, ContentJob } from '@/lib/api';

export const STEPS: { key: ContentStepKey; label: string }[] = [
  { key: 'script', label: 'Kịch bản' },
  { key: 'images', label: 'Ảnh' },
  { key: 'review', label: 'Duyệt ảnh' },
  { key: 'slides', label: 'Slide' },
  { key: 'preview', label: 'Preview' },
  { key: 'voice', label: 'Lồng tiếng' },
  { key: 'final', label: 'Video cuối' },
  { key: 'uploaded', label: 'Đã đăng' },
];

export const CHANNEL_META: Record<string, { name: string; badge: string }> = {
  'cosmic-what-if': { name: 'Cosmic What If', badge: 'bg-indigo-100 text-indigo-700' },
  'inside-your-body': { name: 'Inside Your Body', badge: 'bg-teal-100 text-teal-700' },
};

export const ACTION_LABEL: Record<string, string> = {
  images: 'Lấy ảnh', slides: 'Dựng slide', thumb: 'Thumbnail', package: 'Đóng gói', preview: 'Dựng preview', tts: 'Tạo giọng (Kokoro) + render', render: 'Render video cuối',
};

const DOT: Record<string, string> = {
  done: 'bg-green-500', todo: 'bg-gray-300', stale: 'bg-amber-400', error: 'bg-red-500',
};
const STATE_TEXT: Record<string, string> = { done: 'xong', todo: 'chưa làm', stale: 'cần làm lại (cũ)', error: 'lỗi' };

export function StepDots({ status, size = 'sm' }: { status: ContentStatus; size?: 'sm' | 'lg' }) {
  return (
    <div className={`flex ${size === 'lg' ? 'gap-3' : 'gap-1.5'}`}>
      {STEPS.map(s => {
        const st = status.steps[s.key];
        return size === 'lg' ? (
          <div key={s.key} className="flex flex-col items-center gap-1 min-w-[64px]">
            <span className={`w-3.5 h-3.5 rounded-full ${DOT[st]}`} />
            <span className="text-[11px] text-gray-600 whitespace-nowrap">{s.label}</span>
          </div>
        ) : (
          <span key={s.key} title={`${s.label}: ${STATE_TEXT[st]}`} className={`w-2.5 h-2.5 rounded-full ${DOT[st]}`} />
        );
      })}
    </div>
  );
}

export function StageBadge({ status }: { status: ContentStatus }) {
  const k = status.stageKey;
  const cls = k === 'done' ? 'bg-green-100 text-green-700'
    : k === 'script' ? 'bg-red-100 text-red-700'
    : k === 'voice' || k === 'uploaded' ? 'bg-blue-100 text-blue-700'
    : status.stage.includes('(cũ)') ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700';
  return <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${cls}`}>{status.stage}</span>;
}

export function JobBar({ job }: { job: ContentJob | null }) {
  if (!job) return null;
  return (
    <div className="text-xs text-gray-600">
      <div className="flex justify-between mb-1">
        <span>{ACTION_LABEL[job.action] || job.action}{job.state === 'queued' ? ' — đang chờ' : ''}</span>
        <span>{job.message}</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded overflow-hidden">
        <div className={`h-full ${job.state === 'error' ? 'bg-red-500' : 'bg-blue-600'} transition-all`} style={{ width: `${Math.round(job.progress * 100)}%` }} />
      </div>
    </div>
  );
}

export const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
export const fmtDate = (d: string) => {
  const dt = new Date(`${d}T00:00:00`);
  return dt.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
};
