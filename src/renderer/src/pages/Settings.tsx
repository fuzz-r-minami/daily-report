import { useState, useEffect } from 'react'
import { useAppStore } from '../store/app.store'
import { api } from '../lib/api'

type StatusMsg = { ok: boolean; msg: string }

export function Settings(): JSX.Element {
  const { settings, setSettings } = useAppStore()

  // Claude
  const [claudeEnabled, setClaudeEnabled] = useState(false)
  const [claudeStatus, setClaudeStatus] = useState<StatusMsg | null>(null)
  const [claudeSaving, setClaudeSaving] = useState(false)

  // SVN
  const [svnVersion, setSvnVersion] = useState<string | null>(null)

  // Auto update
  type UpdateStatus = { type: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'; version?: string; percent?: number; message?: string }
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ type: 'idle' })

  // Data dir
  const [dataDir, setDataDir] = useState('')

  // Google Calendar
  const [gcClientId, setGcClientId] = useState('')
  const [gcClientSecret, setGcClientSecret] = useState('')
  const [gcStatus, setGcStatus] = useState<StatusMsg | null>(null)
  const [gcSaving, setGcSaving] = useState(false)
  const [gcAuthing, setGcAuthing] = useState(false)

  useEffect(() => {
    if (!settings) return
    setClaudeEnabled(settings.claude.enabled)
    setDataDir(settings.general.dataDir)
    if (settings.googleCalendar) {
      setGcClientId(settings.googleCalendar.clientId)
      setGcClientSecret(settings.googleCalendar.clientSecret)
    }

    api.svnCheckInstall().then((r) => {
      setSvnVersion(r.success ? r.data : null)
    })

    api.settingsGetDataDir().then((r) => {
      if (r.success) setDataDir(r.data)
    })
  }, [settings])

  useEffect(() => {
    api.onUpdateStatus((status) => setUpdateStatus(status as typeof updateStatus))
  }, [])

  const handleSaveClaude = async (): Promise<void> => {
    if (!settings) return
    setClaudeSaving(true)
    setClaudeStatus(null)
    try {
      const newSettings = {
        ...settings,
        claude: { ...settings.claude, enabled: claudeEnabled }
      }
      const r = await api.settingsSave(newSettings)
      if (r.success) {
        setSettings(newSettings)
        setClaudeStatus({ ok: true, msg: '保存しました' })
      } else {
        setClaudeStatus({ ok: false, msg: r.error })
      }
    } finally {
      setClaudeSaving(false)
    }
  }

  const handleTestClaude = async (): Promise<void> => {
    setClaudeStatus(null)
    const r = await api.claudeTest('')
    setClaudeStatus({ ok: r.success, msg: r.success ? r.data : r.error })
  }

  const handleOpenDataDir = (): void => {
    api.settingsOpenDataDir()
  }

  const handleSaveGoogleCalendar = async (): Promise<void> => {
    if (!settings) return
    setGcSaving(true)
    setGcStatus(null)
    try {
      const newSettings = {
        ...settings,
        googleCalendar: {
          clientId: gcClientId.trim(),
          clientSecret: gcClientSecret.trim(),
          credentialKey: settings.googleCalendar?.credentialKey || 'google-calendar-refresh-token'
        }
      }
      const r = await api.settingsSave(newSettings)
      if (r.success) {
        setSettings(newSettings)
        setGcStatus({ ok: true, msg: '保存しました' })
      } else {
        setGcStatus({ ok: false, msg: r.error })
      }
    } finally {
      setGcSaving(false)
    }
  }

  const handleGoogleCalendarAuth = async (): Promise<void> => {
    setGcAuthing(true)
    setGcStatus(null)
    try {
      const r = await api.calendarStartAuth()
      setGcStatus({ ok: r.success, msg: r.success ? r.data : r.error })
    } finally {
      setGcAuthing(false)
    }
  }

  const handleTestGoogleCalendar = async (): Promise<void> => {
    setGcStatus(null)
    const r = await api.calendarTest()
    setGcStatus({ ok: r.success, msg: r.success ? r.data : r.error })
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h2 className="text-xl font-bold">設定</h2>

      {/* Claude */}
      <section className="card space-y-4">
        <h3 className="section-title">🤖 Claude 整形設定</h3>
        <p className="text-xs text-muted-foreground">
          インストール済みの <code className="bg-secondary px-1 rounded">claude</code> CLI を使って収集データを自動整形します。APIキー不要です。
        </p>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={claudeEnabled}
            onChange={(e) => setClaudeEnabled(e.target.checked)}
            className="rounded"
          />
          Claude整形を有効にする
        </label>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleTestClaude} className="btn-secondary text-xs py-1.5">
            接続テスト
          </button>
          <button onClick={handleSaveClaude} disabled={claudeSaving} className="btn-primary text-xs py-1.5">
            {claudeSaving ? '保存中...' : '保存'}
          </button>
          {claudeStatus && (
            <span className={`text-xs ${claudeStatus.ok ? 'text-green-600' : 'text-destructive'}`}>
              {claudeStatus.ok ? '✓' : '✗'} {claudeStatus.msg}
            </span>
          )}
        </div>
      </section>

      {/* Google Calendar */}
      <section className="card space-y-4">
        <h3 className="section-title">📅 Google Calendar 連携</h3>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Client ID</label>
          <input
            type="text"
            value={gcClientId}
            onChange={(e) => setGcClientId(e.target.value)}
            placeholder="xxxx.apps.googleusercontent.com"
            className="input-field"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Client Secret</label>
          <input
            type="password"
            value={gcClientSecret}
            onChange={(e) => setGcClientSecret(e.target.value)}
            placeholder="GOCSPX-..."
            className="input-field"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleSaveGoogleCalendar} disabled={gcSaving} className="btn-primary text-xs py-1.5">
            {gcSaving ? '保存中...' : '保存'}
          </button>
          <button onClick={handleGoogleCalendarAuth} disabled={gcAuthing} className="btn-secondary text-xs py-1.5">
            {gcAuthing ? '認証中...' : 'Googleアカウントで認証'}
          </button>
          <button onClick={handleTestGoogleCalendar} className="btn-secondary text-xs py-1.5">
            接続テスト
          </button>
          {gcStatus && (
            <span className={`text-xs ${gcStatus.ok ? 'text-green-600' : 'text-destructive'}`}>
              {gcStatus.ok ? '✓' : '✗'} {gcStatus.msg}
            </span>
          )}
        </div>
      </section>

      {/* SVN */}
      <section className="card space-y-2">
        <h3 className="section-title">🔀 SVN クライアント</h3>
        {svnVersion !== null ? (
          <p className="text-xs text-green-600">✓ SVN {svnVersion} が検出されました</p>
        ) : (
          <div className="text-xs text-amber-700 space-y-1">
            <p>⚠ SVNクライアントが見つかりません</p>
            <p className="text-muted-foreground">
              SVN連携を使う場合は TortoiseSVN または SilkSVN をインストールしてください。
            </p>
          </div>
        )}
      </section>

      {/* Data dir */}
      <section className="card space-y-2">
        <h3 className="section-title">📂 データ保存先</h3>
        <p className="text-xs text-muted-foreground break-all">{dataDir}</p>
        <button onClick={handleOpenDataDir} className="btn-secondary text-xs py-1.5">
          フォルダを開く
        </button>
      </section>

      {/* Auto update */}
      <section className="card space-y-3">
        <h3 className="section-title">🔄 アップデート</h3>
        <div className="text-xs text-muted-foreground">
          {updateStatus.type === 'idle' && 'アップデートを確認できます'}
          {updateStatus.type === 'checking' && '確認中...'}
          {updateStatus.type === 'not-available' && '✓ 最新バージョンです'}
          {updateStatus.type === 'available' && `新しいバージョン ${updateStatus.version} があります`}
          {updateStatus.type === 'downloading' && `ダウンロード中... ${updateStatus.percent}%`}
          {updateStatus.type === 'downloaded' && '✓ ダウンロード完了。再起動して適用できます'}
          {updateStatus.type === 'error' && `エラー: ${updateStatus.message}`}
        </div>
        <div className="flex gap-2">
          {(updateStatus.type === 'idle' || updateStatus.type === 'not-available' || updateStatus.type === 'error') && (
            <button
              onClick={() => { setUpdateStatus({ type: 'checking' }); api.updateCheck() }}
              className="btn-secondary text-xs py-1.5"
            >
              更新を確認
            </button>
          )}
          {updateStatus.type === 'available' && (
            <button
              onClick={() => { setUpdateStatus({ type: 'downloading', percent: 0 }); api.updateDownload() }}
              className="btn-primary text-xs py-1.5"
            >
              ダウンロード
            </button>
          )}
          {updateStatus.type === 'downloaded' && (
            <button
              onClick={() => api.updateInstall()}
              className="btn-primary text-xs py-1.5"
            >
              再起動して適用
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
