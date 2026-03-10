'use client';

import { useState, useRef } from 'react';
import { Loader2, CheckCircle, XCircle, FileText } from 'lucide-react';
import { adsenseAPI, AdsenseCheckResult } from '@/lib/api';

export default function CheckAdsensePage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AdsenseCheckResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResults(null);
    setError(null);
    const f = e.target.files?.[0] || null;
    if (f && !f.name.toLowerCase().endsWith('.csv')) {
      setError('Chỉ chấp nhận file CSV');
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError('Vui lòng chọn file CSV chứa email,password,code_authenticators');
      return;
    }

    const form = new FormData();
    form.append('file', file);

    setLoading(true);
    try {
      const resp = await adsenseAPI.checkCsv(form);
      if (resp && resp.isCsv) {
        // Create download link for CSV
        const url = URL.createObjectURL(resp.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = resp.filename || 'adsense-results.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setResults(null);
      } else if (resp && resp.data) {
        setResults(resp.data);
      } else {
        setError('Không nhận được kết quả từ server');
      }
    } catch (err: any) {
      setError(err?.message || 'Lỗi khi gửi yêu cầu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">🔎 Check AdSense Accounts</h1>
        <p className="text-sm text-gray-600 mt-2">Upload CSV with headers including <span className="font-semibold">email,password,code_authenticators</span>. Returns success/fail and message. No DB writes.</p>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">CSV File</label>
            <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="block" />
            <p className="text-xs text-gray-500 mt-2">CSV must include columns: email, password, code_authenticators (2FA secret) - code_authenticators optional but recommended.</p>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div>
            <button
              type="submit"
              disabled={!file || loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Submit
            </button>
            <button
              type="button"
              onClick={() => {
                setFile(null); setResults(null); setError(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
              className="ml-3 px-3 py-2 border rounded text-sm"
            >
              Clear
            </button>
          </div>
        </form>

        {results && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-3">Results ({results.length})</h3>
            <div className="space-y-2">
              {results.map((r, idx) => (
                <div key={r.email + idx} className={`p-3 rounded border ${r.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {r.success ? <CheckCircle className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{r.email}</div>
                      <div className="text-xs text-gray-700 mt-1 font-mono">{r.message}</div>
                      {r.screenshotBase64 && (
                        <div className="mt-2">
                          <img src={`data:image/png;base64,${r.screenshotBase64}`} alt={`screenshot-${idx}`} className="max-w-full max-h-48 border" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
