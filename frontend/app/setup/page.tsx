'use client'

import { useState, useEffect } from 'react'
import { setupAPI, SetupStatus } from '@/lib/api'
import { Database, CheckCircle, AlertCircle, RefreshCw, Play, GitPullRequest } from 'lucide-react'

export default function SetupPage() {
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [migrating, setMigrating] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; migrated?: string[] } | null>(null)
  const [pulling, setPulling] = useState(false)
  const [pullResult, setPullResult] = useState<{ success: boolean; message: string; output?: string } | null>(null)

  const fetchStatus = async () => {
    setLoadingStatus(true)
    try {
      const res = await setupAPI.getStatus()
      setStatus(res.data)
    } catch {
      setStatus(null)
    } finally {
      setLoadingStatus(false)
    }
  }

  useEffect(() => { fetchStatus() }, [])

  const handlePull = async () => {
    setPulling(true)
    setPullResult(null)
    try {
      const res = await setupAPI.pull()
      setPullResult({ success: res.success, message: res.data.message, output: res.data.output })
    } catch (err: any) {
      setPullResult({ success: false, message: err.message || 'Pull failed' })
    } finally {
      setPulling(false)
    }
  }

  const handleMigrate = async () => {
    setMigrating(true)
    setResult(null)
    try {
      const res = await setupAPI.migrate()
      setResult({ success: res.success, message: res.data.message, migrated: res.data.migrated })
      await fetchStatus()
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Migration failed' })
    } finally {
      setMigrating(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Setup & Database</h1>
        <p className="text-gray-600 mt-2">Khởi tạo cơ sở dữ liệu SQLite cho ứng dụng</p>
      </div>

      {/* DB Status Card */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            Trạng thái Database
          </h2>
          <button
            onClick={fetchStatus}
            disabled={loadingStatus}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loadingStatus ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loadingStatus ? (
          <div className="flex items-center gap-2 text-gray-500">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">Đang kiểm tra...</span>
          </div>
        ) : status ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {status.connected ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
              <span className={`font-medium ${status.connected ? 'text-green-700' : 'text-red-700'}`}>
                {status.connected ? 'Kết nối thành công' : 'Không thể kết nối'}
              </span>
            </div>

            {status.connected && (
              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{status.totalMigrations}</p>
                  <p className="text-xs text-gray-500 mt-1">Tổng migrations</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-700">{status.executedMigrations}</p>
                  <p className="text-xs text-gray-500 mt-1">Đã chạy</p>
                </div>
                <div className={`text-center p-3 rounded-lg ${status.pendingMigrations > 0 ? 'bg-yellow-50' : 'bg-gray-50'}`}>
                  <p className={`text-2xl font-bold ${status.pendingMigrations > 0 ? 'text-yellow-700' : 'text-gray-900'}`}>
                    {status.pendingMigrations}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Chờ chạy</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-red-500">Không lấy được trạng thái</p>
        )}
      </div>

      {/* Pull Source */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Cập nhật Source Code</h2>
        <p className="text-sm text-gray-600 mb-4">
          Kéo code mới nhất từ remote repository về server.
        </p>

        <button
          onClick={handlePull}
          disabled={pulling}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {pulling ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <GitPullRequest className="w-5 h-5" />
          )}
          {pulling ? 'Đang pull...' : 'Pull Source'}
        </button>

        {pullResult && (
          <div className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${pullResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {pullResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <p className={`font-medium text-sm ${pullResult.success ? 'text-green-800' : 'text-red-800'}`}>
                {pullResult.message}
              </p>
              {pullResult.output && (
                <pre className="mt-2 text-xs text-gray-600 font-mono whitespace-pre-wrap">{pullResult.output}</pre>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Migrate Button */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Khởi tạo / Cập nhật Database</h2>
        <p className="text-sm text-gray-600 mb-4">
          Chạy tất cả migrations còn chờ. An toàn khi chạy nhiều lần — chỉ áp dụng những gì chưa có.
        </p>

        <button
          onClick={handleMigrate}
          disabled={migrating}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {migrating ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Play className="w-5 h-5" />
          )}
          {migrating ? 'Đang chạy migrations...' : 'Chạy Migrations'}
        </button>

        {result && (
          <div className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {result.success ? (
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <p className={`font-medium text-sm ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                {result.message}
              </p>
              {result.migrated && result.migrated.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {result.migrated.map(m => (
                    <li key={m} className="text-xs text-green-700 font-mono">{m}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
