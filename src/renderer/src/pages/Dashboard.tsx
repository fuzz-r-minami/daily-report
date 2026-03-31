import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/app.store'
import { api } from '../lib/api'
import { todayIso, addDays } from '../lib/utils'
import { PROJECT_COLORS } from '@shared/constants'
import type { AllocationResult } from '@shared/types/report.types'

type Mode = 'daily' | 'weekly' | 'monthly' | 'allocation'

export function Dashboard(): JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    projects, templates, currentSession, setCurrentSession,
    clearProgress, clearLogs, progressLog, logs, settings,
    isGenerating, isAllocating, setIsGenerating, setIsAllocating
  } = useAppStore()

  const stepLabels: Record<string, string> = {
    git: 'Git', svn: 'SVN', perforce: 'Perforce', redmine: 'Redmine',
    jira: 'JIRA', confluence: 'Confluence',
    slack: 'Slack', files: t('dashboard.stepFile'), calendar: 'Calendar'
  }

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    if (currentSession) {
      navigate('/report-preview', { replace: true })
    }
    return () => { mounted.current = false }
  }, [])

  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [mode, setMode] = useState<Mode>(
    settings?.general.defaultReportType || 'daily'
  )
  const [selectedDate, setSelectedDate] = useState(todayIso())
  const [selectedMonth, setSelectedMonth] = useState(todayIso().substring(0, 7))
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [allocationResults, setAllocationResults] = useState<AllocationResult[] | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getDateRange = useCallback(() => {
    if (mode === 'daily') {
      return { start: selectedDate, end: selectedDate }
    }
    if (mode === 'monthly') {
      const [y, m] = selectedMonth.split('-').map(Number)
      const start = `${selectedMonth}-01`
      const lastDay = new Date(y, m, 0).getDate()
      const end = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`
      return { start, end }
    }
    return { start: addDays(selectedDate, -6), end: selectedDate }
  }, [mode, selectedDate, selectedMonth])

  const reportType = mode === 'allocation' ? 'daily' : mode
  const filteredTemplates = templates.filter((tmpl) => tmpl.type === reportType)
  const defaultTemplateId = filteredTemplates.find((tmpl) => tmpl.isDefault)?.id
  const effectiveTemplateId = selectedTemplateId || defaultTemplateId || filteredTemplates[0]?.id || ''

  const toggleProject = (id: string): void => {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const selectAll = (): void => {
    setSelectedProjectIds(projects.map((p) => p.id))
  }

  const handleGenerate = async (): Promise<void> => {
    if (selectedProjectIds.length === 0) {
      setError(t('dashboard.errorSelectProject'))
      return
    }
    if (!effectiveTemplateId) {
      setError(t('dashboard.errorNoTemplate'))
      return
    }

    setError(null)
    setIsGenerating(true)
    clearProgress()
    clearLogs()

    try {
      const dateRange = getDateRange()
      const result = await api.reportGenerate(
        selectedProjectIds,
        dateRange,
        reportType,
        effectiveTemplateId
      )
      if (!mounted.current) return
      if (result.success) {
        setCurrentSession(result.data)
        navigate('/report-preview')
      } else {
        setError(result.error)
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAllocation = async (): Promise<void> => {
    if (selectedProjectIds.length === 0) {
      setError(t('dashboard.errorSelectProject'))
      return
    }

    setError(null)
    setAllocationResults(null)
    setIsAllocating(true)
    clearProgress()
    clearLogs()

    try {
      const result = await api.reportAllocation(selectedProjectIds, selectedMonth)
      if (!mounted.current) return
      if (result.success) {
        setAllocationResults(result.data)
        setCopied(false)
      } else {
        setError(result.error)
      }
    } finally {
      setIsAllocating(false)
    }
  }

  if (projects.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-5xl">📋</div>
          <div>
            <p className="font-semibold">{t('dashboard.noProjects')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('dashboard.noProjectsDesc')}</p>
          </div>
          <button
            onClick={() => navigate('/projects/new')}
            className="btn-primary"
          >
            {t('dashboard.addProject')}
          </button>
        </div>
      </div>
    )
  }

  const periodStart = addDays(selectedDate, -6)
  const periodEnd = selectedDate

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <h2 className="text-xl font-bold">{t('dashboard.title')}</h2>

      {/* Mode */}
      <section className="card space-y-3">
        <h3 className="section-title">{t('dashboard.sectionPeriod')}</h3>
        <div className="flex gap-2">
          {(['daily', 'weekly', 'monthly', 'allocation'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m)
                setSelectedTemplateId('')
                setAllocationResults(null)
                setError(null)
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                mode === m
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-accent'
              }`}
            >
              {t('dashboard.' + m)}
            </button>
          ))}
        </div>

        {mode === 'allocation' || mode === 'monthly' ? (
          <div className="space-y-1">
            <label className="field-label">{t('dashboard.labelMonth')}</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value)
                setAllocationResults(null)
              }}
              className="input-field w-auto"
            />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <label className="field-label">{t('dashboard.labelDate')}</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input-field w-auto"
              />
            </div>
            {mode === 'weekly' && (
              <div className="text-xs text-muted-foreground mt-4">
                {t('dashboard.weekPeriod', { start: periodStart, end: periodEnd })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Template */}
      {mode !== 'allocation' && (
        <section className="card space-y-2">
          <h3 className="section-title">{t('dashboard.sectionTemplate')}</h3>
          {filteredTemplates.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t('dashboard.noTemplate')}
              <button onClick={() => navigate('/templates')} className="text-primary hover:underline ml-1">
                {t('dashboard.addTemplate')}
              </button>
            </p>
          ) : (
            <select
              value={selectedTemplateId || effectiveTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="input-field"
            >
              {filteredTemplates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.name}
                </option>
              ))}
            </select>
          )}
        </section>
      )}

      {/* Projects */}
      <section className="card space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="section-title">{t('dashboard.sectionProjects')}</h3>
          <button onClick={selectAll} className="text-xs text-primary hover:underline">
            {t('dashboard.selectAll')}
          </button>
        </div>
        <div className="space-y-1.5">
          {projects.map((p) => {
            const integrations = [
              (p.gitRepos?.some((r) => r.enabled)) && 'Git',
              (p.svnRepos?.some((r) => r.enabled)) && 'SVN',
              (p.perforceRepos?.some((r) => r.enabled)) && 'Perforce',
              (p.redmineConfigs?.some((c) => c.enabled)) && 'Redmine',
              (p.jiraConfigs?.some((c) => c.enabled)) && 'JIRA',
              (p.confluenceConfigs?.some((c) => c.enabled)) && 'Confluence',
              p.slack?.enabled && 'Slack',
              p.googleCalendar?.enabled && 'Calendar',
              (p.filePaths?.length ?? 0) > 0 && 'Files'
            ].filter(Boolean) as string[]

            return (
              <label
                key={p.id}
                className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                  selectedProjectIds.includes(p.id)
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border hover:bg-accent'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedProjectIds.includes(p.id)}
                  onChange={() => toggleProject(p.id)}
                  className="rounded"
                />
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: p.color || PROJECT_COLORS[0] }}
                />
                <span className="text-sm font-medium flex-1">{p.name}</span>
                {integrations.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {integrations.join(' · ')}
                  </span>
                )}
              </label>
            )
          })}
        </div>
      </section>

      {/* Progress */}
      {progressLog.length > 0 && (
        <section className="card space-y-2">
          <h3 className="section-title">{t('dashboard.sectionProgress')}</h3>
          <div className="bg-secondary/50 rounded-md p-3 space-y-1 text-xs font-mono max-h-48 overflow-y-auto">
            {progressLog.map((p, i) => {
              const icon =
                p.status === 'done' ? '✓' :
                p.status === 'error' ? '✗' :
                p.status === 'running' ? '⋯' : '−'
              const color =
                p.status === 'done' ? 'text-green-600' :
                p.status === 'error' ? 'text-destructive' :
                p.status === 'running' ? 'text-yellow-600' :
                'text-muted-foreground'
              return (
                <div key={i} className={`flex items-center gap-2 ${color}`}>
                  <span className="w-3">{icon}</span>
                  <span>[{p.projectName}] {stepLabels[p.step] || p.step}</span>
                  {p.message && <span className="text-muted-foreground">— {p.message}</span>}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Detail log */}
      {logs.length > 0 && (
        <section className="card space-y-2">
          <h3 className="section-title">{t('dashboard.sectionLog')}</h3>
          <textarea
            readOnly
            value={logs.join('\n')}
            className="w-full bg-secondary/50 rounded-md p-3 text-xs font-mono max-h-96 overflow-y-auto resize-y focus:outline-none text-muted-foreground"
            style={{ userSelect: 'text', minHeight: '12rem' }}
          />
        </section>
      )}

      {/* Allocation result */}
      {allocationResults && (
        <section className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="section-title">
              {t('dashboard.allocationResult', { month: `${selectedMonth.replace('-', '年')}月` })}
            </h3>
            {!allocationResults.every((r) => r.days === 0) && (
              <button
                onClick={() => {
                  const [y, m] = selectedMonth.split('-')
                  const total = allocationResults.reduce((s, r) => s + r.days, 0).toFixed(1)
                  const lines = [
                    `${t('dashboard.allocationCopyTitle')} ${y}年${m}月`,
                    '',
                    ...allocationResults.map((r) => `・${r.projectName}: ${r.days.toFixed(1)} ${t('dashboard.allocationUnit')}`),
                    '',
                    t('dashboard.allocationTotal', { total })
                  ]
                  navigator.clipboard.writeText(lines.join('\n'))
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="text-xs text-primary hover:underline"
              >
                {copied ? t('common.copied') : t('common.copy')}
              </button>
            )}
          </div>
          {allocationResults.every((r) => r.days === 0) ? (
            <p className="text-xs text-muted-foreground">{t('dashboard.allocationEmpty')}</p>
          ) : (
            <>
              <div className="space-y-1">
                {allocationResults.map((r) => (
                  <div key={r.projectId} className="flex items-center gap-3 text-sm">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: projects.find((p) => p.id === r.projectId)?.color || PROJECT_COLORS[0] }}
                    />
                    <span className="flex-1">{r.projectName}</span>
                    <span className="font-mono font-medium tabular-nums">
                      {r.days.toFixed(1)} {t('dashboard.allocationUnit')}
                    </span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-border text-xs text-muted-foreground font-mono">
                {t('dashboard.allocationTotal', { total: allocationResults.reduce((s, r) => s + r.days, 0).toFixed(1) })}
              </div>
            </>
          )}
        </section>
      )}

      {currentSession && !isGenerating && (
        <div className="flex items-center justify-between px-4 py-3 rounded-md border border-green-500/50 bg-green-50 dark:bg-green-950/30">
          <span className="text-sm text-green-700 dark:text-green-400">{t('dashboard.sessionReady')}</span>
          <button
            onClick={() => navigate('/report-preview')}
            className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            {t('dashboard.showReport')}
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
      )}

      <div className="space-y-2">
        <div className="flex gap-3">
          {mode === 'allocation' ? (
            <button
              onClick={handleAllocation}
              disabled={isAllocating || selectedProjectIds.length === 0}
              className="flex-1 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {isAllocating
                ? t('dashboard.btnCalculating')
                : t('dashboard.btnAllocation', { count: selectedProjectIds.length })}
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={isGenerating || selectedProjectIds.length === 0}
              className="flex-1 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {isGenerating
                ? t('dashboard.btnGenerating')
                : t('dashboard.btnGenerate', {
                    icon: mode === 'daily' ? '📅' : mode === 'weekly' ? '📆' : '🗓',
                    type: t('dashboard.' + mode).split(' ').slice(1).join(' '),
                    count: selectedProjectIds.length
                  })}
            </button>
          )}
          {(isGenerating || isAllocating) && (
            <button
              onClick={() => { setIsGenerating(false); setIsAllocating(false) }}
              className="px-4 py-3 border border-border rounded-md text-sm hover:bg-accent transition-colors"
            >
              {t('dashboard.btnCancelLabel')}
            </button>
          )}
        </div>
        {mode === 'allocation' && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t('dashboard.allocationDesc')}
          </p>
        )}
      </div>
    </div>
  )
}
