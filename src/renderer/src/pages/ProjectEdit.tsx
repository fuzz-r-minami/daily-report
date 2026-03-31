import { useState, useEffect, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/app.store'
import { api } from '../lib/api'
import { PROJECT_COLORS } from '@shared/constants'
import type {
  Project,
  GitProjectConfig,
  SvnProjectConfig,
  PerforceProjectConfig,
  RedmineProjectConfig,
  JiraProjectConfig,
  ConfluenceProjectConfig,
  SlackProjectConfig,
  FilePathConfig,
  GoogleCalendarProjectConfig
} from '@shared/types/settings.types'

type Tab = 'git' | 'svn' | 'perforce' | 'redmine' | 'jira' | 'confluence' | 'slack' | 'calendar' | 'files'

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
const newRedmineConfig = (): RedmineProjectConfig => ({
  id: crypto.randomUUID(),
  enabled: true, baseUrl: '', projectId: '', username: '', credentialKey: ''
})
const newJiraConfig = (): JiraProjectConfig => ({
  id: crypto.randomUUID(),
  enabled: true, baseUrl: '', email: '', credentialKey: '', projectKey: '', isServer: false
})
const newConfluenceConfig = (): ConfluenceProjectConfig => ({
  id: crypto.randomUUID(),
  enabled: true, baseUrl: '', email: '', credentialKey: '', spaceKey: '', isServer: false
})
const EMPTY_SLACK: SlackProjectConfig = {
  enabled: false, workspaceId: '', channelIds: []
}
const EMPTY_GOOGLE_CALENDAR: GoogleCalendarProjectConfig = {
  enabled: false
}

export function ProjectEdit(): JSX.Element {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { projects, addProject, updateProject, settings } = useAppStore()
  const slackWorkspaces = settings?.slackWorkspaces ?? []

  const isNew = !id
  const existing = projects.find((p) => p.id === id)

  const [name, setName] = useState(existing?.name || '')
  const [color, setColor] = useState(existing?.color || PROJECT_COLORS[0])
  const [activeTab, setActiveTab] = useState<Tab>('git')
  const [gitRepos, setGitRepos] = useState<GitProjectConfig[]>(existing?.gitRepos || [])
  const [svnRepos, setSvnRepos] = useState<SvnProjectConfig[]>(existing?.svnRepos || [])
  const [perforceRepos, setPerforceRepos] = useState<PerforceProjectConfig[]>(existing?.perforceRepos || [])
  const [perforcePasswords, setPerforcePasswords] = useState<Record<string, string>>({})
  const [redmineConfigs, setRedmineConfigs] = useState<RedmineProjectConfig[]>(existing?.redmineConfigs || [])
  const [redmineApiKeys, setRedmineApiKeys] = useState<Record<string, string>>({})
  const [redminePasswords, setRedminePasswords] = useState<Record<string, string>>({})
  const [jiraConfigs, setJiraConfigs] = useState<JiraProjectConfig[]>(existing?.jiraConfigs || [])
  const [jiraApiTokens, setJiraApiTokens] = useState<Record<string, string>>({})
  const [confluenceConfigs, setConfluenceConfigs] = useState<ConfluenceProjectConfig[]>(existing?.confluenceConfigs || [])
  const [confluenceApiTokens, setConfluenceApiTokens] = useState<Record<string, string>>({})
  const [slack, setSlack] = useState<SlackProjectConfig>(existing?.slack || EMPTY_SLACK)
  const [googleCalendar, setGoogleCalendar] = useState<GoogleCalendarProjectConfig>(
    existing?.googleCalendar || EMPTY_GOOGLE_CALENDAR
  )
  const [filePaths, setFilePaths] = useState<FilePathConfig[]>(existing?.filePaths || [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gitTokens, setGitTokens] = useState<Record<string, string>>({})
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
    if (existing?.perforceRepos) {
      for (const repo of existing.perforceRepos) {
        if (repo.credentialKey) {
          api.credentialGet(repo.credentialKey).then((r) => {
            if (r.success && r.data) setPerforcePasswords((prev) => ({ ...prev, [repo.id]: r.data! }))
          })
        }
      }
    }
    if (existing?.redmineConfigs) {
      for (const cfg of existing.redmineConfigs) {
        if (cfg.credentialKey) {
          api.credentialGet(cfg.credentialKey).then((r) => {
            if (r.success && r.data) setRedmineApiKeys((prev) => ({ ...prev, [cfg.id]: r.data! }))
          })
        }
        if (cfg.basicAuthPasswordKey) {
          api.credentialGet(cfg.basicAuthPasswordKey).then((r) => {
            if (r.success && r.data) setRedminePasswords((prev) => ({ ...prev, [cfg.id]: r.data! }))
          })
        }
      }
    }
    if (existing?.jiraConfigs) {
      for (const cfg of existing.jiraConfigs) {
        if (cfg.credentialKey) {
          api.credentialGet(cfg.credentialKey).then((r) => {
            if (r.success && r.data) setJiraApiTokens((prev) => ({ ...prev, [cfg.id]: r.data! }))
          })
        }
      }
    }
    if (existing?.confluenceConfigs) {
      for (const cfg of existing.confluenceConfigs) {
        if (cfg.credentialKey) {
          api.credentialGet(cfg.credentialKey).then((r) => {
            if (r.success && r.data) setConfluenceApiTokens((prev) => ({ ...prev, [cfg.id]: r.data! }))
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
    for (const repo of proj.perforceRepos || []) {
      const pwd = perforcePasswords[repo.id]
      if (pwd) {
        const key = `p4-password-${repo.id}`
        await api.credentialSet(key, pwd)
        repo.credentialKey = key
      }
    }
    for (const cfg of proj.redmineConfigs || []) {
      const apiKey = redmineApiKeys[cfg.id]
      if (apiKey) {
        const key = `redmine-apikey-${cfg.id}`
        await api.credentialSet(key, apiKey)
        cfg.credentialKey = key
      }
      const pwd = redminePasswords[cfg.id]
      if (pwd) {
        const key = `redmine-password-${cfg.id}`
        await api.credentialSet(key, pwd)
        cfg.basicAuthPasswordKey = key
      }
    }
    for (const cfg of proj.jiraConfigs || []) {
      const token = jiraApiTokens[cfg.id]
      if (token) {
        const key = `jira-token-${cfg.id}`
        await api.credentialSet(key, token)
        cfg.credentialKey = key
      }
    }
    for (const cfg of proj.confluenceConfigs || []) {
      const token = confluenceApiTokens[cfg.id]
      if (token) {
        const key = `confluence-token-${cfg.id}`
        await api.credentialSet(key, token)
        cfg.credentialKey = key
      }
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) { setError(t('projectEdit.errorName')); return }
    setSaving(true); setError(null)
    try {
      const data = {
        name: name.trim(), color, enabled: true,
        gitRepos: gitRepos.length > 0 ? gitRepos : undefined,
        svnRepos: svnRepos.length > 0 ? svnRepos : undefined,
        perforceRepos: perforceRepos.length > 0 ? perforceRepos : undefined,
        redmineConfigs: redmineConfigs.length > 0 ? redmineConfigs : undefined,
        jiraConfigs: jiraConfigs.length > 0 ? jiraConfigs : undefined,
        confluenceConfigs: confluenceConfigs.length > 0 ? confluenceConfigs : undefined,
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

  const handleTestRedmine = async (cfg: RedmineProjectConfig): Promise<void> => {
    const apiKey = redmineApiKeys[cfg.id] || ''
    if (!apiKey) {
      setTestResults((prev) => ({ ...prev, [cfg.id]: { msg: t('projectEdit.apiKeyRequired'), ok: false } }))
      return
    }
    const tempApiKeyKey = `redmine-test-apikey-${cfg.id}`
    await api.credentialSet(tempApiKeyKey, apiKey)
    const pwd = redminePasswords[cfg.id]
    let tempPwdKey: string | undefined
    if (cfg.username && pwd) {
      tempPwdKey = `redmine-test-password-${cfg.id}`
      await api.credentialSet(tempPwdKey, pwd)
    }
    const r = await api.redmineTest(cfg.baseUrl, tempApiKeyKey, cfg.username, tempPwdKey)
    setTestResults((prev) => ({ ...prev, [cfg.id]: { msg: r.success ? r.data : r.error, ok: r.success } }))
  }

  const handleTestJira = async (cfg: JiraProjectConfig): Promise<void> => {
    const token = jiraApiTokens[cfg.id] || ''
    if (!token) {
      setTestResults((prev) => ({ ...prev, [cfg.id]: { msg: t('projectEdit.apiKeyRequired'), ok: false } }))
      return
    }
    const tempKey = `jira-test-token-${cfg.id}`
    await api.credentialSet(tempKey, token)
    const r = await api.jiraTest(cfg.baseUrl, cfg.email, tempKey, cfg.isServer)
    setTestResults((prev) => ({ ...prev, [cfg.id]: { msg: r.success ? r.data : r.error, ok: r.success } }))
  }

  const handleTestConfluence = async (cfg: ConfluenceProjectConfig): Promise<void> => {
    const token = confluenceApiTokens[cfg.id] || ''
    if (!token) {
      setTestResults((prev) => ({ ...prev, [cfg.id]: { msg: t('projectEdit.apiKeyRequired'), ok: false } }))
      return
    }
    const tempKey = `confluence-test-token-${cfg.id}`
    await api.credentialSet(tempKey, token)
    const r = await api.confluenceTest(cfg.baseUrl, cfg.email, tempKey, cfg.isServer)
    setTestResults((prev) => ({ ...prev, [cfg.id]: { msg: r.success ? r.data : r.error, ok: r.success } }))
  }

  const handleTestP4 = async (repo: PerforceProjectConfig): Promise<void> => {
    const pwd = perforcePasswords[repo.id] || ''
    if (pwd) await api.credentialSet('p4-test-password', pwd)
    const r = await api.p4Test(repo.port, repo.username, pwd ? 'p4-test-password' : '')
    setTestResults((prev) => ({ ...prev, [repo.id]: { msg: r.success ? r.data : r.error, ok: r.success } }))
  }

  const handleTestSlack = async (): Promise<void> => {
    const workspace = slackWorkspaces.find((w) => w.workspaceId === slack.workspaceId)
    if (!workspace) return
    const r = await api.slackTest(workspace.credentialKey)
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
    { id: 'git', label: t('projectEdit.tabGit') },
    { id: 'svn', label: t('projectEdit.tabSvn') },
    { id: 'perforce', label: t('projectEdit.tabPerforce') },
    { id: 'redmine', label: t('projectEdit.tabRedmine') },
    { id: 'jira', label: t('projectEdit.tabJira') },
    { id: 'confluence', label: t('projectEdit.tabConfluence') },
    { id: 'slack', label: t('projectEdit.tabSlack') },
    { id: 'calendar', label: t('projectEdit.tabCalendar') },
    { id: 'files', label: t('projectEdit.tabFiles') }
  ]

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <h2 className="text-xl font-bold">{isNew ? t('projectEdit.titleNew') : t('projectEdit.titleEdit')}</h2>

      {/* Name + Color */}
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('projectEdit.labelName')}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('projectEdit.placeholderName')}
          className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('projectEdit.labelColor')}</label>
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
        <div className="flex flex-wrap border-b border-border bg-secondary/30">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.id ? 'bg-background border-b-2 border-primary' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {tab.label}
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
                      {t('common.enabled')}
                    </label>
                    <button
                      onClick={() => setGitRepos((prev) => prev.filter((r) => r.id !== repo.id))}
                      className="text-xs text-destructive hover:underline"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                  <Field label={t('projectEdit.gitLocalPath')}>
                    <input type="text" value={repo.localPath}
                      onChange={(e) => setGitRepos((prev) => prev.map((r) => r.id === repo.id ? { ...r, localPath: e.target.value } : r))}
                      placeholder="C:\projects\myapp"
                      className="input-field" />
                  </Field>
                  <Field label={t('projectEdit.gitRepoUrl')}>
                    <input type="text" value={repo.repoUrl}
                      onChange={(e) => setGitRepos((prev) => prev.map((r) => r.id === repo.id ? { ...r, repoUrl: e.target.value } : r))}
                      placeholder="https://github.com/user/repo"
                      className="input-field" />
                  </Field>
                  <Field label={t('projectEdit.gitBranch')}>
                    <input type="text" value={repo.branch}
                      onChange={(e) => setGitRepos((prev) => prev.map((r) => r.id === repo.id ? { ...r, branch: e.target.value } : r))}
                      placeholder="main" className="input-field" />
                  </Field>
                  <Field label={t('projectEdit.gitToken')}>
                    <input type="password" value={gitTokens[repo.id] || ''}
                      onChange={(e) => setGitTokens((prev) => ({ ...prev, [repo.id]: e.target.value }))}
                      placeholder="ghp_xxxx..." className="input-field" />
                  </Field>
                  <div className="flex items-center gap-3 pt-1 border-t border-border">
                    <button onClick={() => handleTestGit(repo)}
                      className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-accent">
                      {t('common.test')}
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
                {t('projectEdit.addGit')}
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
                      {t('common.enabled')}
                    </label>
                    <button
                      onClick={() => setSvnRepos((prev) => prev.filter((r) => r.id !== repo.id))}
                      className="text-xs text-destructive hover:underline"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                  <Field label={t('projectEdit.svnLocalPath')}>
                    <input type="text" value={repo.localPath}
                      onChange={(e) => setSvnRepos((prev) => prev.map((r) => r.id === repo.id ? { ...r, localPath: e.target.value } : r))}
                      placeholder="C:\projects\myapp-svn"
                      className="input-field" />
                  </Field>
                  <Field label={t('projectEdit.svnRepoUrl')}>
                    <input type="text" value={repo.repoUrl}
                      onChange={(e) => setSvnRepos((prev) => prev.map((r) => r.id === repo.id ? { ...r, repoUrl: e.target.value } : r))}
                      placeholder="https://svn.example.com/repos/myproject" className="input-field" />
                  </Field>
                  <Field label={t('projectEdit.svnUsername')}>
                    <input type="text" value={repo.username ?? ''}
                      onChange={(e) => setSvnRepos((prev) => prev.map((r) => r.id === repo.id ? { ...r, username: e.target.value } : r))}
                      placeholder="username" className="input-field" />
                  </Field>
                  <div className="flex items-center gap-3 pt-1 border-t border-border">
                    <button onClick={() => handleTestSvn(repo)}
                      className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-accent">
                      {t('common.test')}
                    </button>
                    {testResults[repo.id] && (
                      <span className={`text-xs ${testResults[repo.id].ok ? 'text-green-600' : 'text-destructive'}`}>
                        {testResults[repo.id].msg}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{t('projectEdit.svnNote')}</p>
              <button onClick={() => setSvnRepos((prev) => [...prev, newSvnRepo()])}
                className="px-3 py-2 text-sm border border-border rounded-md hover:bg-accent">
                {t('projectEdit.addSvn')}
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
                      {t('common.enabled')}
                    </label>
                    <button
                      onClick={() => setPerforceRepos((prev) => prev.filter((r) => r.id !== repo.id))}
                      className="text-xs text-destructive hover:underline"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                  <Field label={t('projectEdit.p4Port')}>
                    <input type="text" value={repo.port}
                      onChange={(e) => setPerforceRepos((prev) => prev.map((r) => r.id === repo.id ? { ...r, port: e.target.value } : r))}
                      placeholder="perforce:1666"
                      className="input-field" />
                  </Field>
                  <Field label={t('projectEdit.p4User')}>
                    <input type="text" value={repo.username}
                      onChange={(e) => setPerforceRepos((prev) => prev.map((r) => r.id === repo.id ? { ...r, username: e.target.value } : r))}
                      placeholder="username"
                      className="input-field" />
                  </Field>
                  <Field label={t('projectEdit.p4DepotPath')}>
                    <input type="text" value={repo.depotPath}
                      onChange={(e) => setPerforceRepos((prev) => prev.map((r) => r.id === repo.id ? { ...r, depotPath: e.target.value } : r))}
                      placeholder="//depot/myproject/..."
                      className="input-field" />
                  </Field>
                  <Field label={t('projectEdit.p4Password')}>
                    <input type="password" value={perforcePasswords[repo.id] || ''}
                      onChange={(e) => setPerforcePasswords((prev) => ({ ...prev, [repo.id]: e.target.value }))}
                      placeholder="P4PASSWD"
                      className="input-field" />
                  </Field>
                  <div className="flex items-center gap-3 pt-1 border-t border-border">
                    <button onClick={() => handleTestP4(repo)}
                      className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-accent">
                      {t('common.test')}
                    </button>
                    {testResults[repo.id] && (
                      <span className={`text-xs ${testResults[repo.id].ok ? 'text-green-600' : 'text-destructive'}`}>
                        {testResults[repo.id].msg}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{t('projectEdit.p4Note')}</p>
              <button onClick={() => setPerforceRepos((prev) => [...prev, newPerforceRepo()])}
                className="px-3 py-2 text-sm border border-border rounded-md hover:bg-accent">
                {t('projectEdit.addPerforce')}
              </button>
            </>
          )}

          {/* Redmine */}
          {activeTab === 'redmine' && (
            <>
              {redmineConfigs.map((cfg) => (
                <div key={cfg.id} className="border border-border rounded-md p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={cfg.enabled}
                        onChange={(e) => setRedmineConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, enabled: e.target.checked } : c))}
                      />
                      {t('common.enabled')}
                    </label>
                    <button
                      onClick={() => setRedmineConfigs((prev) => prev.filter((c) => c.id !== cfg.id))}
                      className="text-xs text-destructive hover:underline"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                  <Field label={t('projectEdit.redmineUrl')}>
                    <input type="text" value={cfg.baseUrl}
                      onChange={(e) => setRedmineConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, baseUrl: e.target.value } : c))}
                      placeholder="https://redmine.example.com"
                      className="input-field" />
                  </Field>
                  <Field label={t('projectEdit.redmineProjectId')}>
                    <input type="text" value={cfg.projectId ?? ''}
                      onChange={(e) => setRedmineConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, projectId: e.target.value } : c))}
                      placeholder="my-project"
                      className="input-field" />
                  </Field>
                  <Field label={t('projectEdit.redmineApiKey')}>
                    <input type="password" value={redmineApiKeys[cfg.id] || ''}
                      onChange={(e) => setRedmineApiKeys((prev) => ({ ...prev, [cfg.id]: e.target.value }))}
                      placeholder="Redmine API key"
                      className="input-field" />
                  </Field>
                  <div className="pt-1 border-t border-border">
                    <Field label={t('projectEdit.redmineBasicTitle')}>
                      <input type="text" value={cfg.username ?? ''}
                        onChange={(e) => setRedmineConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, username: e.target.value } : c))}
                        placeholder={t('projectEdit.redmineBasicTitle')}
                        className="input-field" />
                    </Field>
                    <Field label={t('projectEdit.redmineBasicPassword')}>
                      <input type="password" value={redminePasswords[cfg.id] || ''}
                        onChange={(e) => setRedminePasswords((prev) => ({ ...prev, [cfg.id]: e.target.value }))}
                        placeholder={t('projectEdit.redmineBasicPassword')}
                        className="input-field" />
                    </Field>
                  </div>
                  <div className="flex items-center gap-3 pt-1 border-t border-border">
                    <button onClick={() => handleTestRedmine(cfg)}
                      className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-accent">
                      {t('common.test')}
                    </button>
                    {testResults[cfg.id] && (
                      <span className={`text-xs ${testResults[cfg.id].ok ? 'text-green-600' : 'text-destructive'}`}>
                        {testResults[cfg.id].ok ? '✓' : '✗'} {testResults[cfg.id].msg}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{t('projectEdit.redmineNote')}</p>
              <button onClick={() => setRedmineConfigs((prev) => [...prev, newRedmineConfig()])}
                className="px-3 py-2 text-sm border border-border rounded-md hover:bg-accent">
                {t('projectEdit.addRedmine')}
              </button>
            </>
          )}

          {/* JIRA */}
          {activeTab === 'jira' && (
            <>
              {jiraConfigs.map((cfg) => (
                <div key={cfg.id} className="border border-border rounded-md p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={cfg.enabled}
                        onChange={(e) => setJiraConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, enabled: e.target.checked } : c))}
                      />
                      {t('common.enabled')}
                    </label>
                    <button
                      onClick={() => setJiraConfigs((prev) => prev.filter((c) => c.id !== cfg.id))}
                      className="text-xs text-destructive hover:underline"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                  <Field label={t('projectEdit.jiraUrl')}>
                    <input type="text" value={cfg.baseUrl}
                      onChange={(e) => setJiraConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, baseUrl: e.target.value } : c))}
                      placeholder="https://company.atlassian.net"
                      className="input-field" />
                  </Field>
                  <Field label={t('projectEdit.jiraEmail')}>
                    <input type="text" value={cfg.email}
                      onChange={(e) => setJiraConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, email: e.target.value } : c))}
                      placeholder="user@example.com"
                      className="input-field" />
                  </Field>
                  <Field label={t('projectEdit.jiraApiToken')}>
                    <input type="password" value={jiraApiTokens[cfg.id] || ''}
                      onChange={(e) => setJiraApiTokens((prev) => ({ ...prev, [cfg.id]: e.target.value }))}
                      placeholder="ATATT3xFfGF0..."
                      className="input-field" />
                  </Field>
                  <Field label={t('projectEdit.jiraProjectKey')}>
                    <input type="text" value={cfg.projectKey ?? ''}
                      onChange={(e) => setJiraConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, projectKey: e.target.value } : c))}
                      placeholder="PROJ"
                      className="input-field" />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={cfg.isServer ?? false}
                      onChange={(e) => setJiraConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, isServer: e.target.checked } : c))}
                    />
                    {t('projectEdit.jiraServerMode')}
                  </label>
                  <div className="flex items-center gap-3 pt-1 border-t border-border">
                    <button onClick={() => handleTestJira(cfg)}
                      className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-accent">
                      {t('common.test')}
                    </button>
                    {testResults[cfg.id] && (
                      <span className={`text-xs ${testResults[cfg.id].ok ? 'text-green-600' : 'text-destructive'}`}>
                        {testResults[cfg.id].ok ? '✓' : '✗'} {testResults[cfg.id].msg}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{t('projectEdit.jiraNote')}</p>
              <button onClick={() => setJiraConfigs((prev) => [...prev, newJiraConfig()])}
                className="px-3 py-2 text-sm border border-border rounded-md hover:bg-accent">
                {t('projectEdit.addJira')}
              </button>
            </>
          )}

          {/* Confluence */}
          {activeTab === 'confluence' && (
            <>
              {confluenceConfigs.map((cfg) => (
                <div key={cfg.id} className="border border-border rounded-md p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={cfg.enabled}
                        onChange={(e) => setConfluenceConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, enabled: e.target.checked } : c))}
                      />
                      {t('common.enabled')}
                    </label>
                    <button
                      onClick={() => setConfluenceConfigs((prev) => prev.filter((c) => c.id !== cfg.id))}
                      className="text-xs text-destructive hover:underline"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                  <Field label={t('projectEdit.confluenceUrl')}>
                    <input type="text" value={cfg.baseUrl}
                      onChange={(e) => setConfluenceConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, baseUrl: e.target.value } : c))}
                      placeholder="https://company.atlassian.net"
                      className="input-field" />
                  </Field>
                  <Field label={t('projectEdit.confluenceEmail')}>
                    <input type="text" value={cfg.email}
                      onChange={(e) => setConfluenceConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, email: e.target.value } : c))}
                      placeholder="user@example.com"
                      className="input-field" />
                  </Field>
                  <Field label={t('projectEdit.confluenceApiToken')}>
                    <input type="password" value={confluenceApiTokens[cfg.id] || ''}
                      onChange={(e) => setConfluenceApiTokens((prev) => ({ ...prev, [cfg.id]: e.target.value }))}
                      placeholder="ATATT3xFfGF0..."
                      className="input-field" />
                  </Field>
                  <Field label={t('projectEdit.confluenceSpaceKey')}>
                    <input type="text" value={cfg.spaceKey ?? ''}
                      onChange={(e) => setConfluenceConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, spaceKey: e.target.value } : c))}
                      placeholder="TEAM"
                      className="input-field" />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={cfg.isServer ?? false}
                      onChange={(e) => setConfluenceConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, isServer: e.target.checked } : c))}
                    />
                    {t('projectEdit.confluenceServerMode')}
                  </label>
                  <div className="flex items-center gap-3 pt-1 border-t border-border">
                    <button onClick={() => handleTestConfluence(cfg)}
                      className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-accent">
                      {t('common.test')}
                    </button>
                    {testResults[cfg.id] && (
                      <span className={`text-xs ${testResults[cfg.id].ok ? 'text-green-600' : 'text-destructive'}`}>
                        {testResults[cfg.id].ok ? '✓' : '✗'} {testResults[cfg.id].msg}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{t('projectEdit.confluenceNote')}</p>
              <button onClick={() => setConfluenceConfigs((prev) => [...prev, newConfluenceConfig()])}
                className="px-3 py-2 text-sm border border-border rounded-md hover:bg-accent">
                {t('projectEdit.addConfluence')}
              </button>
            </>
          )}

          {activeTab === 'slack' && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={slack.enabled} onChange={(e) => setSlack({ ...slack, enabled: e.target.checked })} />
                {t('projectEdit.slackEnable')}
              </label>
              {slack.enabled && (
                <>
                  {slackWorkspaces.length === 0 ? (
                    <p className="text-xs text-amber-600">{t('projectEdit.slackNoWorkspace')}</p>
                  ) : (
                    <Field label={t('projectEdit.slackWorkspace')}>
                      <select
                        value={slack.workspaceId}
                        onChange={(e) => setSlack({ ...slack, workspaceId: e.target.value })}
                        className="input-field"
                      >
                        <option value="">{t('projectEdit.slackSelectPlaceholder')}</option>
                        {slackWorkspaces.map((ws) => (
                          <option key={ws.workspaceId} value={ws.workspaceId}>{ws.workspaceName}</option>
                        ))}
                      </select>
                    </Field>
                  )}
                  <Field label={t('projectEdit.slackChannels')}>
                    <input type="text" value={slack.channelIds.join(',')}
                      onChange={(e) => setSlack({ ...slack, channelIds: e.target.value.split(',').map(s => s.trim()) })}
                      onBlur={(e) => setSlack({ ...slack, channelIds: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                      placeholder="C01234567,C89012345" className="input-field" />
                  </Field>
                  <div className="pt-2 border-t border-border flex items-center gap-3">
                    <button onClick={handleTestSlack}
                      disabled={!slack.workspaceId}
                      className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-accent disabled:opacity-40">
                      {t('common.test')}
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
              <p className="text-xs text-muted-foreground">{t('projectEdit.calendarNote')}</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={googleCalendar.enabled}
                  onChange={(e) => setGoogleCalendar({ ...googleCalendar, enabled: e.target.checked })}
                />
                {t('projectEdit.calendarEnable')}
              </label>
              {googleCalendar.enabled && (
                <div className="text-xs text-muted-foreground p-2 bg-secondary/40 rounded space-y-0.5">
                  <p className="font-medium text-foreground">{t('projectEdit.calendarHowTitle')}</p>
                  <p>{t('projectEdit.calendarHowDesc')}</p>
                  <p className="font-medium text-foreground">{t('projectEdit.calendarCollectTitle')}</p>
                  <p>{t('projectEdit.calendarCollectDesc')}</p>
                </div>
              )}
            </>
          )}

          {activeTab === 'files' && (
            <>
              <p className="text-sm text-muted-foreground">{t('projectEdit.filesDesc')}</p>
              {filePaths.map((fp, i) => (
                <div key={i} className="p-3 bg-secondary/30 rounded space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate font-mono text-xs">{fp.path}</span>
                    <button onClick={() => setFilePaths(prev => prev.filter((_, j) => j !== i))}
                      className="text-destructive text-xs shrink-0">{t('common.delete')}</button>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t('projectEdit.filesExclude')}
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
                {t('projectEdit.filesAdd')}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <button onClick={() => navigate('/projects')}
          className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">
          {t('common.cancel')}
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
          {saving ? t('common.saving') : t('common.save')}
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
