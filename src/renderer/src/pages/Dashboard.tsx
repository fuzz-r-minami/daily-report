import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/app.store'
import { api } from '../lib/api'
import { todayIso, addDays } from '../lib/utils'
import { PROJECT_COLORS } from '@shared/constants'

const STEP_LABELS: Record<string, string> = {
  git: 'Git',
  svn: 'SVN',
  slack: 'Slack',
  files: 'ファイル'
}

export function Dashboard(): JSX.Element {
  const navigate = useNavigate()
  const { projects, templates, currentSession, setCurrentSession, clearProgress, clearLogs, progressLog, logs, settings } = useAppStore()

  useEffect(() => {
    if (currentSession) {
      navigate('/report-preview', { replace: true })
    }
  }, [])

  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [reportType, setReportType] = useState<'daily' | 'weekly'>(
    settings?.general.defaultReportType || 'daily'
  )
  const [selectedDate, setSelectedDate] = useState(todayIso())
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getDateRange = useCallback(() => {
    if (reportType === 'daily') {
      return { start: selectedDate, end: selectedDate }
    }
    return { start: addDays(selectedDate, -6), end: selectedDate }
  }, [reportType, selectedDate])

  const filteredTemplates = templates.filter(
    (t) => t.type === reportType
  )
  const defaultTemplateId = filteredTemplates.find((t) => t.isDefault)?.id
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
      setError('プロジェクトを1つ以上選択してください')
      return
    }
    if (!effectiveTemplateId) {
      setError('テンプレートが設定されていません。テンプレートページで追加してください。')
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

  if (projects.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-5xl">📋</div>
          <div>
            <p className="font-semibold">まずプロジェクトを設定しましょう</p>
            <p className="text-sm text-muted-foreground mt-1">
              日報・週報を生成するには、プロジェクトと連携ツールの設定が必要です。
            </p>
          </div>
          <button
            onClick={() => navigate('/projects/new')}
            className="btn-primary"
          >
            プロジェクトを追加
          </button>
        </div>
      </div>
    )
  }

  const periodStart = addDays(selectedDate, -6)
  const periodEnd = selectedDate

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <h2 className="text-xl font-bold">レポート生成</h2>

      {/* Report Type */}
      <section className="card space-y-3">
        <h3 className="section-title">種別と期間</h3>
        <div className="flex gap-2">
          {(['daily', 'weekly'] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setReportType(t)
                setSelectedTemplateId('')
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                reportType === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-accent'
              }`}
            >
              {t === 'daily' ? '📅 日報' : '📆 週報'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="space-y-1">
            <label className="field-label">
              日付
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input-field w-auto"
            />
          </div>
          {reportType === 'weekly' && (
            <div className="text-xs text-muted-foreground mt-4">
              期間: {periodStart} 〜 {periodEnd}
            </div>
          )}
        </div>
      </section>

      {/* Template */}
      <section className="card space-y-2">
        <h3 className="section-title">テンプレート</h3>
        {filteredTemplates.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            対象のテンプレートがありません。
            <button onClick={() => navigate('/templates')} className="text-primary hover:underline ml-1">
              テンプレートを追加
            </button>
          </p>
        ) : (
          <select
            value={selectedTemplateId || effectiveTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="input-field"
          >
            {filteredTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </section>

      {/* Projects */}
      <section className="card space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="section-title">プロジェクト選択</h3>
          <button
            onClick={selectAll}
            className="text-xs text-primary hover:underline"
          >
            すべて選択
          </button>
        </div>
        <div className="space-y-1.5">
          {projects.map((p) => {
            const integrations = [
              (p.gitRepos?.some((r) => r.enabled)) && 'Git',
              (p.svnRepos?.some((r) => r.enabled)) && 'SVN',
              p.slack?.enabled && 'Slack',
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
          <h3 className="section-title">収集状況</h3>
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
                  <span>[{p.projectName}] {STEP_LABELS[p.step] || p.step}</span>
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
          <h3 className="section-title">実行ログ</h3>
          <textarea
            readOnly
            value={logs.join('\n')}
            className="w-full bg-secondary/50 rounded-md p-3 text-xs font-mono max-h-96 overflow-y-auto resize-y focus:outline-none text-muted-foreground"
            style={{ userSelect: 'text', minHeight: '12rem' }}
          />
        </section>
      )}

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || selectedProjectIds.length === 0}
          className="flex-1 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
        >
          {isGenerating
            ? '収集中...'
            : reportType === 'daily'
              ? `📅 日報を生成（${selectedProjectIds.length}件）`
              : `📆 週報を生成（${selectedProjectIds.length}件）`}
        </button>
        {isGenerating && (
          <button
            onClick={() => setIsGenerating(false)}
            className="px-4 py-3 border border-border rounded-md text-sm hover:bg-accent transition-colors"
          >
            キャンセル
          </button>
        )}
      </div>
    </div>
  )
}
