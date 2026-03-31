import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/app.store'
import { api } from '../lib/api'
import { LANGUAGES, setLanguage } from '../i18n'
import type { SlackWorkspace, AppLanguage } from '@shared/types/settings.types'

type StatusMsg = { ok: boolean; msg: string }

export function Settings(): JSX.Element {
  const { t } = useTranslation()
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

  // Slack
  const [slackAuthing, setSlackAuthing] = useState(false)
  const [slackStatus, setSlackStatus] = useState<StatusMsg | null>(null)
  const [slackTestResults, setSlackTestResults] = useState<Record<string, StatusMsg>>({})
  const slackWorkspaces: SlackWorkspace[] = settings?.slackWorkspaces ?? []

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
        setClaudeStatus({ ok: true, msg: t('settings.saved') })
      } else {
        setClaudeStatus({ ok: false, msg: r.error })
      }
    } finally {
      setClaudeSaving(false)
    }
  }

  const handleTestClaude = async (): Promise<void> => {
    setClaudeStatus(null)
    const r = await api.claudeTest()
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
        setGcStatus({ ok: true, msg: t('settings.saved') })
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

  const handleSlackAddWorkspace = async (): Promise<void> => {
    setSlackAuthing(true)
    setSlackStatus(null)
    try {
      const r = await api.slackStartAuth()
      if (r.success) {
        setSlackStatus({ ok: true, msg: t('settings.slackLinked', { name: r.data.workspaceName }) })
        const updated = await api.settingsGet()
        if (updated.success) setSettings(updated.data)
      } else {
        setSlackStatus({ ok: false, msg: r.error })
      }
    } finally {
      setSlackAuthing(false)
    }
  }

  const handleSlackDeleteWorkspace = async (workspaceId: string): Promise<void> => {
    const r = await api.slackDeleteWorkspace(workspaceId)
    if (r.success) {
      const updated = await api.settingsGet()
      if (updated.success) setSettings(updated.data)
    } else {
      setSlackStatus({ ok: false, msg: r.error })
    }
  }

  const handleSlackTest = async (workspace: SlackWorkspace): Promise<void> => {
    setSlackTestResults((prev) => ({ ...prev, [workspace.workspaceId]: { ok: true, msg: '...' } }))
    const r = await api.slackTest(workspace.credentialKey)
    setSlackTestResults((prev) => ({
      ...prev,
      [workspace.workspaceId]: { ok: r.success, msg: r.success ? r.data : r.error }
    }))
  }

  const handleLanguageChange = async (lang: AppLanguage): Promise<void> => {
    if (!settings) return
    setLanguage(lang)
    const newSettings = { ...settings, general: { ...settings.general, language: lang } }
    await api.settingsSave(newSettings)
    setSettings(newSettings)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h2 className="text-xl font-bold">{t('settings.title')}</h2>

      {/* Language */}
      <section className="card space-y-3">
        <h3 className="section-title">{t('settings.sectionLanguage')}</h3>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`px-4 py-2 rounded-md text-sm border transition-colors ${
                (settings?.general.language ?? 'ja') === lang.code
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-accent'
              }`}
            >
              {lang.nativeLabel}
            </button>
          ))}
        </div>
      </section>

      {/* Claude */}
      <section className="card space-y-4">
        <h3 className="section-title">{t('settings.sectionClaude')}</h3>
        <p className="text-xs text-muted-foreground">
          {t('settings.claudeDesc')}
        </p>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={claudeEnabled}
            onChange={(e) => setClaudeEnabled(e.target.checked)}
            className="rounded"
          />
          {t('settings.claudeEnable')}
        </label>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleTestClaude} className="btn-secondary text-xs py-1.5">
            {t('common.test')}
          </button>
          <button onClick={handleSaveClaude} disabled={claudeSaving} className="btn-primary text-xs py-1.5">
            {claudeSaving ? t('common.saving') : t('common.save')}
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
        <h3 className="section-title">{t('settings.sectionCalendar')}</h3>
        <div className="text-xs text-muted-foreground space-y-0.5 p-2 bg-secondary/40 rounded">
          <p>{t('settings.calendarSetupDesc')}</p>
          <ol className="list-decimal list-inside space-y-0.5 mt-1">
            <li>{t('settings.calendarStep1')}</li>
            <li>{t('settings.calendarStep2')}</li>
            <li>{t('settings.calendarStep3')}</li>
            <li>{t('settings.calendarStep4')}</li>
          </ol>
        </div>
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
            {gcSaving ? t('common.saving') : t('common.save')}
          </button>
          <button onClick={handleGoogleCalendarAuth} disabled={gcAuthing} className="btn-secondary text-xs py-1.5">
            {gcAuthing ? t('settings.calendarAuthing') : t('settings.calendarAuth')}
          </button>
          <button onClick={handleTestGoogleCalendar} className="btn-secondary text-xs py-1.5">
            {t('common.test')}
          </button>
          {gcStatus && (
            <span className={`text-xs ${gcStatus.ok ? 'text-green-600' : 'text-destructive'}`}>
              {gcStatus.ok ? '✓' : '✗'} {gcStatus.msg}
            </span>
          )}
        </div>
      </section>

      {/* Slack */}
      <section className="card space-y-4">
        <h3 className="section-title">{t('settings.sectionSlack')}</h3>
        <p className="text-xs text-muted-foreground">{t('settings.slackDesc')}</p>

        {slackWorkspaces.length > 0 && (
          <div className="space-y-2">
            {slackWorkspaces.map((ws) => (
              <div key={ws.workspaceId} className="flex items-center gap-2 p-2 bg-secondary/40 rounded text-sm">
                <span className="flex-1 font-medium">{ws.workspaceName}</span>
                <span className="text-xs text-muted-foreground">{ws.workspaceId}</span>
                <button
                  onClick={() => handleSlackTest(ws)}
                  className="text-xs px-2 py-1 border border-border rounded hover:bg-accent"
                >
                  {t('common.test')}
                </button>
                <button
                  onClick={() => handleSlackDeleteWorkspace(ws.workspaceId)}
                  className="text-xs px-2 py-1 text-destructive border border-destructive/40 rounded hover:bg-destructive/10"
                >
                  {t('common.delete')}
                </button>
                {slackTestResults[ws.workspaceId] && (
                  <span className={`text-xs ${slackTestResults[ws.workspaceId].ok ? 'text-green-600' : 'text-destructive'}`}>
                    {slackTestResults[ws.workspaceId].ok ? '✓' : '✗'} {slackTestResults[ws.workspaceId].msg}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSlackAddWorkspace}
            disabled={slackAuthing}
            className="btn-primary text-xs py-1.5"
          >
            {slackAuthing ? t('settings.slackAuthing') : t('settings.slackAddWorkspace')}
          </button>
          {slackStatus && (
            <span className={`text-xs ${slackStatus.ok ? 'text-green-600' : 'text-destructive'}`}>
              {slackStatus.ok ? '✓' : '✗'} {slackStatus.msg}
            </span>
          )}
        </div>
      </section>

      {/* SVN */}
      <section className="card space-y-2">
        <h3 className="section-title">{t('settings.sectionSvn')}</h3>
        {svnVersion !== null ? (
          <p className="text-xs text-green-600">{t('settings.svnDetected', { version: svnVersion })}</p>
        ) : (
          <div className="text-xs text-amber-700 space-y-1">
            <p>{t('settings.svnNotFound')}</p>
            <p className="text-muted-foreground">{t('settings.svnInstallDesc')}</p>
          </div>
        )}
      </section>

      {/* Data dir */}
      <section className="card space-y-2">
        <h3 className="section-title">{t('settings.sectionDataDir')}</h3>
        <p className="text-xs text-muted-foreground break-all">{dataDir}</p>
        <button onClick={handleOpenDataDir} className="btn-secondary text-xs py-1.5">
          {t('settings.openFolder')}
        </button>
      </section>

      {/* Auto update */}
      <section className="card space-y-3">
        <h3 className="section-title">{t('settings.sectionUpdate')}</h3>
        <div className="text-xs text-muted-foreground">
          {updateStatus.type === 'idle' && t('settings.updateIdle')}
          {updateStatus.type === 'checking' && t('settings.updateChecking')}
          {updateStatus.type === 'not-available' && t('settings.updateLatest')}
          {updateStatus.type === 'available' && t('settings.updateAvailable', { version: updateStatus.version })}
          {updateStatus.type === 'downloading' && t('settings.updateDownloading', { percent: updateStatus.percent })}
          {updateStatus.type === 'downloaded' && t('settings.updateDownloaded')}
          {updateStatus.type === 'error' && t('settings.updateError', { message: updateStatus.message })}
        </div>
        <div className="flex gap-2">
          {(updateStatus.type === 'idle' || updateStatus.type === 'not-available' || updateStatus.type === 'error') && (
            <button
              onClick={() => { setUpdateStatus({ type: 'checking' }); api.updateCheck() }}
              className="btn-secondary text-xs py-1.5"
            >
              {t('settings.checkUpdate')}
            </button>
          )}
          {updateStatus.type === 'available' && (
            <button
              onClick={() => { setUpdateStatus({ type: 'downloading', percent: 0 }); api.updateDownload() }}
              className="btn-primary text-xs py-1.5"
            >
              {t('settings.download')}
            </button>
          )}
          {updateStatus.type === 'downloaded' && (
            <button
              onClick={() => api.updateInstall()}
              className="btn-primary text-xs py-1.5"
            >
              {t('settings.restartApply')}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
