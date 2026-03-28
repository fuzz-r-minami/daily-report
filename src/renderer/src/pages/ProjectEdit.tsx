import { useState, useEffect, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppStore } from '../store/app.store'
import { api } from '../lib/api'
import { PROJECT_COLORS } from '@shared/constants'
import type {
  Project,
  GitProjectConfig,
  SvnProjectConfig,
  PerforceProjectConfig,
  SlackProjectConfig,
  FilePathConfig,
  GoogleCalendarProjectConfig
} from '@shared/types/settings.types'

type Tab = 'git' | 'svn' | 'perforce' | 'slack' | 'calendar' | 'files'

const newGitRepo = (): GitProjectConfig => ({
  id: crypto.randomUUID(),
  enabled: true, localPath: '', repoUrl: '', branch: 'main', useSSH: false, credentialKey: ''
})
const newSvnRepo = (): SvnProjectConfig => ({
  id: crypto.randomUUID(),
  enabled: true, localPath: '', repoUrl: '', username: ''
})
const newPerforceRepo = (): PerforceProjectConfig => ({
  id: crypto.randomUUID(),
  enabled: true, port: '', username: '', depotPath: '//', credentialKey: ''
})
const EMPTY_SLACK: SlackProjectConfig = {
  enabled: false, workspaceId: '', channelIds: [], credentialKey: ''
}
const EMPTY_GOOGLE_CALENDAR: GoogleCalendarProjectConfig = {
  enabled: false
}

export function ProjectEdit(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { projects, addProject, updateProject } = useAppStore()

  const isNew = !id
  const existing = projects.find((p) => p.id === id)

  const [name, setName] = useState(existing?.name || '')
  const [color, setColor] = useState(existing?.color || PROJECT_COLORS[0])
  const [activeTab, setActiveTab] = useState<Tab>('git')
  const [gitRepos, setGitRepos] = useState<GitProjectConfig[]>(existing?.gitRepos || [])
  const [svnRepos, setSvnRepos] = useState<SvnProjectConfig[]>(existing?.svnRepos || [])
  const [perforceRepos, setPerforceRepos] = useState<PerforceProjectConfig[]>(existing?.perforceRepos || [])
  const [perforcePasswords, setPerforcePasswords] = useState<Record<string, string>>({})
  const [slack, setSlack] = useState<SlackProjectConfig>(existing?.slack || EMPTY_SLACK)
  const [googleCalendar, setGoogleCalendar] = useState<GoogleCalendarProjectConfig>(
    existing?.googleCalendar || EMPTY_GOOGLE_CALENDAR
  )
  const [filePaths, setFilePaths] = useState<FilePathConfig[]>(existing?.filePaths || [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Credentials keyed by repo id
  const [gitTokens, setGitTokens] = useState<Record<string, string>>({})
  const [slackAuthed, setSlackAuthed] = useState(false)
  const [slackAuthing, setSlackAuthing] = useState(false)
  // Test results keyed by repo id or 'slack'
  const [testResults, setTestResults] = useState<Record<string, { msg: string; ok: boolean }>>({})

  useEffect(() => {
    if (existing?.gitRepos) {
      for (const repo of existing.gitRepos) {
        if (repo.credentialKey) {
          api.credentialGet(repo.credentialKey).then((r) => {
            if (r.success && r.data) setGitTokens((prev) => ({ ...prev, [repo.id]: r.data! }))
          })
        }
      }
    }
    if (existing?.slack?.credentialKey) {
      api.credentialGet(existing.slack.credentialKey).then((r) => {
        if (r.success && r.data) setSlackAuthed(true)
      })
    }
    if (existing?.perforceRepos) {
      for (const repo of existing.perforceRepos) {
        if (repo.credentialKey) {
          api.credentialGet(repo.credentialKey).then((r) => {
            if (r.success && r.data) setPerforcePasswords((prev) => ({ ...prev, [repo.id]: r.data! }))
          })
        }
      }
    }
  }, [])

  const saveCredentials = async (proj: Project): Promise<void> => {
    for (const repo of proj.gitRepos || []) {
      const token = gitTokens[repo.id]
      if (token) {
        const key = `git-token-${repo.id}`
        await api.credentialSet(key, token)
        repo.credentialKey = key
      }
    }
    // slack トークンは OAuth 完了時に既に保存済みなので credentialKey のみ確認
    if (slack.enabled && !proj.slack?.credentialKey) {
      proj.slack = { ...proj.slack!, credentialKey: `slack-token-${proj.id}` }
    }
    for (const repo of proj.perforceRepos || []) {
      const pwd = perforcePasswords[repo.id]
      if (pwd) {
        const key = `p4-password-${repo.id}`
        await api.credentialSet(key, pwd)
        repo.credentialKey = key
      }
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) { setError('プロジェクト名を入力してください'); return }
    setSaving(true); setError(null)
    try {
      const data = {
        name: name.trim(), color, enabled: true,
        gitRepos: gitRepos.length > 0 ? gitRepos : undefined,
        svnRepos: svnRepos.length > 0 ? svnRepos : undefined,
        perforceRepos: perforceRepos.length > 0 ? perforceRepos : undefined,
        slack: slack.enabled ? slack : undefined,
        googleCalendar: googleCalendar.enabled ? googleCalendar : undefined,
        filePaths: filePaths.length > 0 ? filePaths : undefined
      }
      if (isNew) {
        const r = await api.projectCreate(data)
        if (!r.success) { setError(r.error); return }
        await saveCredentials(r.data)
        await api.projectUpdate(r.data)
        addProject(r.data)
      } else {
        const r = await api.projectUpdate({ ...existing!, ...data })
        if (!r.success) { setError(r.error); return }
        await saveCredentials(r.data)
        await api.projectUpdate(r.data)
        updateProject(r.data)
      }
      navigate('/projects')
    } finally {
      setSaving(false)
    }
  }

  const handleTestGit = async (repo: GitProjectConfig): Promise<void> => {
    const r = await api.gitTest(repo.localPath, repo.branch || undefined)
    setTestResults((prev) => ({ ...prev, [repo.id]: { msg: r.success ? r.data : r.error, ok: r.success } }))
  }

  const handleTestSvn = async (repo: SvnProjectConfig): Promise<void> => {
    const r = await api.svnTest(repo.repoUrl)
    setTestResults((prev) => ({ ...prev, [repo.id]: { msg: r.success ? r.data : r.error, ok: r.success } }))
  }

  const handleTestP4 = async (repo: PerforceProjectConfig): Promise<void> => {
    const pwd = perforcePasswords[repo.id] || ''
    if (pwd) await api.credentialSet('p4-test-password', pwd)
    const r = await api.p4Test(repo.port, repo.username, pwd ? 'p4-test-password' : '')
    setTestResults((prev) => ({ ...prev, [repo.id]: { msg: r.success ? r.data : r.error, ok: r.success } }))
  }

  const handleSlackAuth = async (): Promise<void> => {
    if (!id && !isNew) return
    setSlackAuthing(true)
    setTestResults((prev) => ({ ...prev, slack: undefined as never }))
    try {
      // 新規プロジェクトの場合は一時的な ID を使用
      const projectId = id || `new-${Date.now()}`
      const r = await api.slackStartAuth(projectId)
      if (r.success) {
        setSlackAuthed(true)
        setSlack((prev) => ({ ...prev, credentialKey: r.data }))
        setTestResults((prev) => ({ ...prev, slack: { msg: '認証完了', ok: true } }))
      } else {
        setTestResults((prev) => ({ ...prev, slack: { msg: r.error, ok: false } }))
      }
    } finally {
      setSlackAuthing(false)
    }
  }

  const handleTestSlack = async (): Promise<void> => {
    const credKey = slack.credentialKey || `slack-token-${id}`
    const r = await api.slackTest(credKey)
    setTestResults((prev) => ({ ...prev, slack: { msg: r.success ? r.data : r.error, ok: r.success } }))
  }

  const addFilePath = async (): Promise<void> => {
    const r = await api.fileBrowse()
    if (r.success) {
      setFilePaths((prev) => [
        ...prev,
        { path: r.data, recursive: true, excludePatterns: ['node_modules/**', '.git/**'], includePatterns: [] }
      ])
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'git', label: 'Git' },
    { id: 'svn', label: 'SVN' },
    { id: 'perforce', label: 'Perforce' },
    { id: 'slack', label: 'Slack' },
    { id: 'calendar', label: 'Google Calendar' },
    { id: 'files', label: 'ファイル監視' }
  ]

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <h2 className="text-xl font-bold">{isNew ? 'プロジェクト追加' : 'プロジェクト編集'}</h2>

      {/* Name + Color */}
      <div className="space-y-2">
        <label className="text-sm font-medium">プロジェクト名</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 社内業務システム"
          className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">カラー</label>
        <div className="flex gap-2">
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-1 ring-primary' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border border-border rounded-md overflow-hidden">
        <div className="flex border-b border-border bg-secondary/30">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === t.id ? 'bg-background border-b-2 border-primary' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-3">
          {/* Git repos */}
          {activeTab === 'git' && (
            <>
              {gitRepos.map((repo) => (
                <div key={repo.id} className="border border-border rounded-md p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={repo.enabled}
                        onChange={(e) => setGitRepos((prev) => prev.map((r) => r.id === repo.id ? { ...r, enabled: e.target.checked } : r))}
                      />
                      有効
                    </label>
                    <button
                      onClick={() => setGitRepos((prev) => prev.filter((r) => r.id !== repo.id))}
                      className="text-xs text-destructive hover:underline"
                    >
                      削除
                    </button>
                  </div>
                  <Field label="ローカル作業フォルダ">
                    <input type="text" value={repo.localPath}
                      onChange={(e) => setGitRepos((prev) => prev.map((r) => r.id === repo.id ? { ...r, localPath: e.target.value } : r))}
                      placeholder="C:\projects\myapp"
                      className="input-field" />
                  </Field>
                  <Field label="リモートURL（HTTPS認証が必要な場合のみ）">
                    <input type="text" value={repo.repoUrl}
                      onChange={(e) => setGitRepos((prev) => prev.map((r) => r.id === repo.id ? { ...r, repoUrl: e.target.value } : r))}
                      placeholder="https://github.com/user/repo"
                      className="input-field" />
                  </Field>
                  <Field label="ブランチ">
                    <input type="text" value={repo.branch}
                      onChange={(e) => setGitRepos((prev) => prev.map((r) => r.id === repo.id ? { ...r, branch: e.target.value } : r))}
                      placeholder="main" className="input-field" />
                  </Field>
                  <Field label="アクセストークン（HTTPS認証、任意）">
                    <input type="password" value={gitTokens[repo.id] || ''}
                      onChange={(e) => setGitTokens((prev) => ({ ...prev, [repo.id]: e.target.value }))}
                      placeholder="ghp_xxxx..." className="input-field" />
                  </Field>
                  <div className="flex items-center gap-3 pt-1 border-t border-border">
                    <button onClick={() => handleTestGit(repo)}
                      className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-accent">
                      接続テスト
                    </button>
                    {testResults[repo.id] && (
                      <span className={`text-xs ${testResults[repo.id].ok ? 'text-green-600' : 'text-destructive'}`}>
                        {testResults[repo.id].msg}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <button onClick={() => setGitRepos((prev) => [...prev, newGitRepo()])}
                className="px-3 py-2 text-sm border border-border rounded-md hover:bg-accent">
                + Gitリポジトリを追加
              </button>
            </>
          )}

          {/* SVN repos */}
          {activeTab === 'svn' && (
            <>
              {svnRepos.map((repo) => (
                <div key={repo.id} className="border border-border rounded-md p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={repo.enabled}
                        onChange={(e) => setSvnRepos((prev) => prev.map((r) => r.id === repo.id ? { ...r, enabled: e.target.checked } : r))}
                      />
                      有効
                    </label>
                    <button
                      onClick={() => setSvnRepos((prev) => prev.filter((r) => r.id !== repo.id))}
                      className="text-xs text-destructive hover:underline"
                    >
                      削除
                    </button>
                  </div>
                  <Field label="ローカル作業コピー">
                    <input type="text" value={repo.localPath}
                      onChange={(e) => setSvnRepos((prev) => prev.map((r) => r.id === repo.id ? { ...r, localPath: e.target.value } : r))}
                      placeholder="C:\projects\myapp-svn"
                      className="input-field" />
                  </Field>
                  <Field label="リポジトリURL">
                    <input type="text" value={repo.repoUrl}
                      onChange={(e) => setSvnRepos((prev) => prev.map((r) => r.id === repo.id ? { ...r, repoUrl: e.target.value } : r))}
                      placeholder="https://svn.example.com/repos/myproject" className="input-field" />
                  </Field>
                  <Field label="ユーザー名">
                    <input type="text" value={repo.username ?? ''}
                      onChange={(e) => setSvnRepos((prev) => prev.map((r) => r.id === repo.id ? { ...r, username: e.target.value } : r))}
                      placeholder="SVNユーザー名" className="input-field" />
                  </Field>
                  <div className="flex items-center gap-3 pt-1 border-t border-border">
                    <button onClick={() => handleTestSvn(repo)}
                      className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-accent">
                      接続テスト
                    </button>
                    {testResults[repo.id] && (
                      <span className={`text-xs ${testResults[repo.id].ok ? 'text-green-600' : 'text-destructive'}`}>
                        {testResults[repo.id].msg}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">※ SVNクライアント（TortoiseSVN等）のインストールが必要です</p>
              <button onClick={() => setSvnRepos((prev) => [...prev, newSvnRepo()])}
                className="px-3 py-2 text-sm border border-border rounded-md hover:bg-accent">
                + SVNリポジトリを追加
              </button>
            </>
          )}

          {/* Perforce repos */}
          {activeTab === 'perforce' && (
            <>
              {perforceRepos.map((repo) => (
                <div key={repo.id} className="border border-border rounded-md p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={repo.enabled}
                        onChange={(e) => setPerforceRepos((prev) => prev.map((r) => r.id === repo.id ? { ...r, enabled: e.target.checked } : r))}
                      />
                      有効
                    </label>
                    <button
                      onClick={() => setPerforceRepos((prev) => prev.filter((r) => r.id !== repo.id))}
                      className="text-xs text-destructive hover:underline"
                    >
                      削除
                    </button>
                  </div>
                  <Field label="P4PORT（例: perforce:1666）">
                    <input type="text" value={repo.port}
                      onChange={(e) => setPerforceRepos((prev) => prev.map((r) => r.id === repo.id ? { ...r, port: e.target.value } : r))}
                      placeholder="perforce:1666"
                      className="input-field" />
                  </Field>
                  <Field label="ユーザー名（P4USER）">
                    <input type="text" value={repo.username}
                      onChange={(e) => setPerforceRepos((prev) => prev.map((r) => r.id === repo.id ? { ...r, username: e.target.value } : r))}
                      placeholder="username"
                      className="input-field" />
                  </Field>
                  <Field label="デポパス（例: //depot/myproject/...）">
                    <input type="text" value={repo.depotPath}
                      onChange={(e) => setPerforceRepos((prev) => prev.map((r) => r.id === repo.id ? { ...r, depotPath: e.target.value } : r))}
                      placeholder="//depot/myproject/..."
                      className="input-field" />
                  </Field>
                  <Field label="パスワード / チケット（任意）">
                    <input type="password" value={perforcePasswords[repo.id] || ''}
                      onChange={(e) => setPerforcePasswords((prev) => ({ ...prev, [repo.id]: e.target.value }))}
                      placeholder="P4PASSWD またはログインチケット"
                      className="input-field" />
                  </Field>
                  <div className="flex items-center gap-3 pt-1 border-t border-border">
                    <button onClick={() => handleTestP4(repo)}
                      className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-accent">
                      接続テスト
                    </button>
                    {testResults[repo.id] && (
                      <span className={`text-xs ${testResults[repo.id].ok ? 'text-green-600' : 'text-destructive'}`}>
                        {testResults[repo.id].msg}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">※ p4 コマンドラインクライアントのインストールが必要です</p>
              <button onClick={() => setPerforceRepos((prev) => [...prev, newPerforceRepo()])}
                className="px-3 py-2 text-sm border border-border rounded-md hover:bg-accent">
                + Perforceリポジトリを追加
              </button>
            </>
          )}

          {activeTab === 'slack' && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={slack.enabled} onChange={(e) => setSlack({ ...slack, enabled: e.target.checked })} />
                Slack連携を有効にする
              </label>
              {slack.enabled && (
                <>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSlackAuth}
                      disabled={slackAuthing}
                      className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                    >
                      {slackAuthing ? '認証中...' : slackAuthed ? 'Slackと再連携' : 'Slackと連携'}
                    </button>
                    {slackAuthed && !slackAuthing && (
                      <span className="text-xs text-green-600">✓ 連携済み</span>
                    )}
                  </div>
                  <Field label="チャンネルID（カンマ区切り）">
                    <input type="text" value={slack.channelIds.join(',')}
                      onChange={(e) => setSlack({ ...slack, channelIds: e.target.value.split(',').map(s => s.trim()) })}
                      onBlur={(e) => setSlack({ ...slack, channelIds: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                      placeholder="C01234567,C89012345" className="input-field" />
                  </Field>
                  <div className="pt-2 border-t border-border flex items-center gap-3">
                    <button onClick={handleTestSlack}
                      disabled={!slackAuthed}
                      className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-accent disabled:opacity-40">
                      接続テスト
                    </button>
                    {testResults['slack'] && (
                      <span className={`text-xs ${testResults['slack'].ok ? 'text-green-600' : 'text-destructive'}`}>
                        {testResults['slack'].ok ? '✓' : '✗'} {testResults['slack'].msg}
                      </span>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {activeTab === 'calendar' && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={googleCalendar.enabled}
                  onChange={(e) => setGoogleCalendar({ ...googleCalendar, enabled: e.target.checked })}
                />
                Google Calendar 連携を有効にする
              </label>
              {googleCalendar.enabled && (
                <div className="text-xs text-muted-foreground p-2 bg-secondary/40 rounded space-y-0.5">
                  <p className="font-medium text-foreground">プロジェクトの判定方法</p>
                  <p>予定のタイトルにプロジェクト名が含まれていれば検出されます（大文字小文字区別なし）</p>
                  <p className="font-medium text-foreground">予定の収集について</p>
                  <p>参加可否未回答または拒否した予定は収集から除外されます</p>
                </div>
              )}
            </>
          )}

          {activeTab === 'files' && (
            <>
              <p className="text-sm text-muted-foreground">指定したパス以下で日付範囲内に変更されたファイルを収集します</p>
              {filePaths.map((fp, i) => (
                <div key={i} className="p-3 bg-secondary/30 rounded space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate font-mono text-xs">{fp.path}</span>
                    <button onClick={() => setFilePaths(prev => prev.filter((_, j) => j !== i))}
                      className="text-destructive text-xs shrink-0">削除</button>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      除外パターン（1行1パターン、gitignore形式）
                    </label>
                    <textarea
                      value={fp.excludePatterns.join('\n')}
                      onChange={(e) => setFilePaths(prev => prev.map((item, j) =>
                        j === i
                          ? { ...item, excludePatterns: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) }
                          : item
                      ))}
                      rows={4}
                      className="w-full border border-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring bg-background resize-none"
                      placeholder={'*.dll\n**/obj/\n**/bin/\nnode_modules/**'}
                      spellCheck={false}
                    />
                  </div>
                </div>
              ))}
              <button onClick={addFilePath}
                className="px-3 py-2 text-sm border border-border rounded-md hover:bg-accent">
                + フォルダを追加
              </button>
            </>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <button onClick={() => navigate('/projects')}
          className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">
          キャンセル
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
