'use client';

import type { ContentStatus, ContentStepKey } from '@/lib/api';

export const CHANNEL: Record<string, { name: string; badge: string }> = {
  'cosmic-what-if': { name: 'Cosmic What If', badge: 'bg-indigo-100 text-indigo-700' },
  'inside-your-body': { name: 'Inside Your Body', badge: 'bg-teal-100 text-teal-700' },
};

// Các bước gộp lại để hiển thị: "Hình" = ảnh + duyệt + slide + preview (video hoạt hình luôn xong)
export const STEPS: { label: string; keys: ContentStepKey[] }[] = [
  { label: 'Kịch bản', keys: ['script'] },
  { label: 'Hình', keys: ['images', 'review', 'slides', 'preview'] },
  { label: 'Giọng', keys: ['voice'] },
  { label: 'Video', keys: ['final'] },
  { label: 'Đã đăng', keys: ['uploaded'] },
];
export const DOT = { done: 'bg-green-500', todo: 'bg-gray-300', stale: 'bg-amber-400', error: 'bg-red-500' } as const;
export const DOT_TEXT = { done: 'xong', todo: 'chưa', stale: 'cũ', error: 'lỗi' } as const;
const RANK = { error: 3, stale: 2, todo: 1, done: 0 } as const;

const stepState = (s: ContentStatus, keys: ContentStepKey[]) =>
  keys.map(k => s.steps[k]).reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'done' as keyof typeof DOT);

export function StepDots({ status, labels = false }: { status: ContentStatus; labels?: boolean }) {
  return (
    <div className={`flex ${labels ? 'gap-4' : 'gap-1.5'}`}>
      {STEPS.map(s => {
        const st = stepState(status, s.keys);
        return labels ? (
          <div key={s.label} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`w-2.5 h-2.5 rounded-full ${DOT[st]}`} />{s.label}
          </div>
        ) : (
          <span key={s.label} title={`${s.label}: ${DOT_TEXT[st]}`} className={`w-2.5 h-2.5 rounded-full ${DOT[st]}`} />
        );
      })}
    </div>
  );
}

export function StageBadge({ status }: { status: ContentStatus }) {
  const k = status.stageKey;
  const cls = k === 'done' ? 'bg-green-100 text-green-700'
    : k === 'script' ? 'bg-red-100 text-red-700'
    : k === 'uploaded' ? 'bg-blue-100 text-blue-700'
    : status.stage.includes('(cũ)') ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700';
  return <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${cls}`}>{status.stage}</span>;
}

export function ChannelBadge({ channel }: { channel: string }) {
  return <span className={`px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${CHANNEL[channel]?.badge ?? 'bg-gray-100'}`}>{CHANNEL[channel]?.name ?? channel}</span>;
}

export const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
export const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
