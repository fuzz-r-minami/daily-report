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

  // Data dir
  const [dataDir, setDataDir] = useState('')

  useEffect(() => {
    if (!settings) return
    setClaudeEnabled(settings.claude.enabled)
    setDataDir(settings.general.dataDir)

    api.svnCheckInstall().then((r) => {
      setSvnVersion(r.success ? r.data : null)
    })

    api.settingsGetDataDir().then((r) => {
      if (r.success) setDataDir(r.data)
    })
  }, [settings])

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
    </div>
  )
}
