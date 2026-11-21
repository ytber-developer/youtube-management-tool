'use client';

// Tự đăng YouTube cho video content: chọn tài khoản theo kênh (nhớ trong localStorage), nhãn trạng thái hàng đợi.
import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Loader2, Upload, XCircle, ExternalLink } from 'lucide-react';
import { accountsAPI, Account, ContentUpload as Upl } from '@/lib/api';

const KEY = (channel: string) => `content.account.${channel}`;

/** Danh sách tài khoản YouTube (tải một lần) */
export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    accountsAPI.getAccounts({ limit: 200 }).then(r => setAccounts(r.data)).catch(e => setError(e.message || 'Không tải được tài khoản'));
  }, []);
  return { accounts, error };
}

/** Tài khoản đã chọn cho một kênh, nhớ trong trình duyệt */
export function useChannelAccount(channel: string): [number | null, (id: number | null) => void] {
  const [id, setId] = useState<number | null>(null);
  useEffect(() => {
    try { const v = localStorage.getItem(KEY(channel)); if (v) setId(Number(v)); } catch { /* bỏ qua */ }
  }, [channel]);
  const set = (v: number | null) => {
    setId(v);
    try { v ? localStorage.setItem(KEY(channel), String(v)) : localStorage.removeItem(KEY(channel)); } catch { /* bỏ qua */ }
  };
  return [id, set];
}

export function AccountSelect({ accounts, value, onChange, className = '' }: { accounts: Account[]; value: number | null; onChange: (id: number | null) => void; className?: string }) {
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)} className={`border rounded px-2 py-1 text-sm bg-white max-w-full ${className}`}>
      <option value="">— chọn tài khoản YouTube —</option>
      {accounts.map(a => <option key={a.id} value={a.id}>{a.channelName ? `${a.channelName} · ` : ''}{a.email}</option>)}
    </select>
  );
}

/** ISO → giá trị cho <input type="datetime-local"> theo giờ máy ("YYYY-MM-DDTHH:mm") */
export const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
/** giá trị datetime-local (giờ máy) → ISO; rỗng → null */
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

/** Ô chọn ngày giờ công khai trên YouTube (giờ máy). value = chuỗi datetime-local */
export function SchedulePicker({ value, onChange, min }: { value: string; onChange: (v: string) => void; min?: string }) {
  const past = !!value && new Date(value).getTime() < Date.now() + 15 * 60 * 1000;
  return (
    <label className="inline-flex flex-wrap items-center gap-2 text-xs text-gray-600">
      Công khai lúc
      <input type="datetime-local" value={value} min={min} onChange={e => onChange(e.target.value)} className="border rounded px-2 py-1 text-sm bg-white" />
      {past && <span className="text-amber-700">đã qua → công khai ngay sau khi upload</span>}
    </label>
  );
}

export const fmtWhen = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '');

/** Video sẵn sàng để xếp hàng: đã render đủ, chưa đăng, chưa nằm trong hàng đợi */
export const canQueue = (stageKey: string, upload: Upl | null) =>
  stageKey === 'uploaded' && (!upload || upload.status === 'failed' || upload.status === 'skipped');

export function UploadBadge({ upload, detail = false }: { upload: Upl | null; detail?: boolean }) {
  if (!upload) return null;
  const base = 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium whitespace-nowrap';
  switch (upload.status) {
    case 'pending':
      return (
        <span className={`${base} bg-sky-100 text-sky-700`} title={upload.scheduledStartAt ? `Bắt đầu upload lúc ${fmtWhen(upload.scheduledStartAt)}` : 'Chờ tới lượt (hàng đợi upload 1 video/lần)'}>
          <Clock className="w-3 h-3" />{upload.scheduledStartAt ? `upload ${fmtWhen(upload.scheduledStartAt)}` : 'chờ upload'}
        </span>
      );
    case 'downloading': case 'downloaded': case 'uploading':
      return <span className={`${base} bg-blue-100 text-blue-700`}><Loader2 className="w-3 h-3 animate-spin" />đang upload</span>;
    case 'completed':
      return (
        <span className={`${base} bg-green-100 text-green-700`} title={upload.uploadedAt ? `Upload xong ${fmtWhen(upload.uploadedAt)}` : ''}>
          <CheckCircle2 className="w-3 h-3" />đã upload
          {detail && upload.videoUrl && <a href={upload.videoUrl} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-0.5"><ExternalLink className="w-3 h-3" />link</a>}
        </span>
      );
    case 'failed': case 'skipped':
      return <span className={`${base} bg-red-100 text-red-700`} title={upload.error || ''}><XCircle className="w-3 h-3" />upload lỗi</span>;
    default:
      return <span className={`${base} bg-gray-100 text-gray-600`}><Upload className="w-3 h-3" />{upload.status}</span>;
  }
}
