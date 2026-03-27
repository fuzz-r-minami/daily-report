import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/app.store'
import { api } from '../lib/api'
import { DEFAULT_EMAIL_SUBJECT_DAILY } from '../../../shared/constants'

type StatusMsg = { ok: boolean; msg: string }

function stripMarkdown(md: string): string {
  return md
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')  // [text](url) → text
    .replace(/\[([^\]]+)\](?!\()/g, '$1')      // [text] (bare) → text
    .replace(/^#{1,6}\s+/gm, '')               // ## headers
    .replace(/\*\*([^*]+)\*\*/g, '$1')         // **bold**
    .replace(/\*([^*]+)\*/g, '$1')             // *italic*
    .replace(/`([^`]+)`/g, '$1')               // `code`
}

function buildSubject(
  template: { emailSubjectTemplate?: string } | undefined,
  session: { type: string; dateRange: { start: string; end: string } } | null
): string {
  const dateStr = session?.dateRange.start.substring(0, 10) || ''
  const weekRange = session
    ? `${session.dateRange.start.substring(0, 10)} - ${session.dateRange.end.substring(0, 10)}`
    : ''
  return (template?.emailSubjectTemplate || DEFAULT_EMAIL_SUBJECT_DAILY)
    .replace('{{date}}', dateStr)
    .replace('{{week_range}}', weekRange)
}

export function ReportPreview(): JSX.Element {
  const navigate = useNavigate()
  const { currentSession, setCurrentSession, settings, templates } = useAppStore()

  const template = templates.find((t) => t.id === currentSession?.templateId)

  const [text, setText] = useState(currentSession?.formattedText || currentSession?.rawText || '')
  const [subject, setSubject] = useState(() => buildSubject(template, currentSession ?? null))
  const [isFormatting, setIsFormatting] = useState(false)
  const [status, setStatus] = useState<StatusMsg | null>(null)
  const [viewMode, setViewMode] = useState<'edit' | 'view'>('view')

  if (!currentSession) {
    return (
      <div className="p-6 text-center text-muted-foreground flex flex-col items-center justify-center h-full gap-3">
        <p className="text-4xl">📄</p>
        <p>レポートが生成されていません</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary text-sm">
          ダッシュボードへ戻る
        </button>
      </div>
    )
  }

  const handleFormat = async (): Promise<void> => {
    if (!settings?.claude.enabled) {
      setStatus({ ok: false, msg: 'Claude連携が無効です。設定ページでAPIキーを入力して有効化してください。' })
      return
    }
    setIsFormatting(true)
    setStatus(null)
    try {
      const r = await api.claudeFormat(currentSession.rawText, currentSession.templateId)
      if (r.success) {
        setText(r.data)
        setCurrentSession({ ...currentSession, formattedText: r.data, status: 'ready' })
        setStatus({ ok: true, msg: 'Claude整形が完了しました' })
      } else {
        setStatus({ ok: false, msg: r.error })
      }
    } finally {
      setIsFormatting(false)
    }
  }

  const handleCopy = async (): Promise<void> => {
    await navigator.clipboard.writeText(text)
    setStatus({ ok: true, msg: 'クリップボードにコピーしました' })
    setTimeout(() => setStatus(null), 3000)
  }

  const handleSave = async (): Promise<void> => {
    const dateStr = currentSession.dateRange.start.substring(0, 10).replace(/-/g, '')
    const filename = `${currentSession.type === 'daily' ? '日報' : '週報'}_${dateStr}.md`
    const r = await api.reportSave(text, filename)
    if (r.success) {
      setStatus({ ok: true, msg: `保存しました: ${r.data}` })
    } else if (r.error !== 'cancelled') {
      setStatus({ ok: false, msg: r.error })
    }
  }

  const handleMail = async (): Promise<void> => {
    const toList = (template?.emailTo || []).filter(Boolean)
    if (toList.length === 0) {
      setStatus({ ok: false, msg: 'テンプレートにメールの宛先を設定してください' })
      return
    }
    const r = await api.mailOpen(toList, subject, stripMarkdown(text))
    if (!r.success) {
      setStatus({ ok: false, msg: r.error })
    }
  }

  // Summary
  type SummaryItem = { label: string; count?: number; error?: string; unconfigured?: boolean; sub?: boolean }
  const summary = currentSession.collectedData.map((d) => {
    const items: SummaryItem[] = [
      d.git
        ? { label: 'Git', count: d.git.commits.length, error: d.git.error }
        : { label: 'Git', unconfigured: true },
      ...(d.git && !d.git.error && ((d.git.uncommittedFiles?.length ?? 0) + (d.git.untrackedFiles?.length ?? 0)) > 0
        ? [{ label: 'Git作業中', count: (d.git.uncommittedFiles?.length ?? 0) + (d.git.untrackedFiles?.length ?? 0), sub: true }] : []),
      d.svn
        ? { label: 'SVN', count: d.svn.commits.length, error: d.svn.error }
        : { label: 'SVN', unconfigured: true },
      ...(d.svn && !d.svn.error && ((d.svn.uncommittedFiles?.length ?? 0) + (d.svn.untrackedFiles?.length ?? 0)) > 0
        ? [{ label: 'SVN作業中', count: (d.svn.uncommittedFiles?.length ?? 0) + (d.svn.untrackedFiles?.length ?? 0), sub: true }] : []),
      d.perforce
        ? { label: 'Perforce', count: d.perforce.changelists.length, error: d.perforce.error }
        : { label: 'Perforce', unconfigured: true },
      d.slack
        ? { label: 'Slack', count: d.slack.messages.length, error: d.slack.error }
        : { label: 'Slack', unconfigured: true },
      d.files
        ? { label: 'Files', count: d.files.changedFiles.length, error: d.files.error }
        : { label: 'Files', unconfigured: true },
    ]
    return { name: d.projectName, items }
  })

  const typeLabel = currentSession.type === 'daily' ? '日報' : '週報'
  const dateLabel = currentSession.type === 'daily'
    ? currentSession.dateRange.start.substring(0, 10)
    : `${currentSession.dateRange.start.substring(0, 10)} 〜 ${currentSession.dateRange.end.substring(0, 10)}`

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-3 flex-wrap shrink-0">
        <button
          onClick={() => { setCurrentSession(null); navigate('/dashboard') }}
          className="btn-secondary text-sm"
        >
          ← 戻る
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold">
            {typeLabel} プレビュー
            <span className="ml-2 text-sm font-normal text-muted-foreground">{dateLabel}</span>
          </h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleFormat}
            disabled={isFormatting}
            className="btn-primary text-xs py-1.5"
            title="収集データをClaudeで整形します"
          >
            {isFormatting ? '整形中...' : '🤖 Claudeで整形'}
          </button>
          <button onClick={handleCopy} className="btn-secondary text-xs py-1.5">
            📋 コピー
          </button>
          <button onClick={handleSave} className="btn-secondary text-xs py-1.5">
            💾 保存
          </button>
          <button
            onClick={() => setViewMode((m) => m === 'edit' ? 'view' : 'edit')}
            className="btn-secondary text-xs py-1.5"
          >
            {viewMode === 'edit' ? '👁 プレビュー' : '✏️ 編集'}
          </button>
          <button
            onClick={handleMail}
            className="text-xs py-1.5 px-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            📧 MailTo:
          </button>
        </div>
      </div>

      {/* Subject bar */}
      <div className="px-4 py-2 border-b border-border bg-card shrink-0 flex items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0">件名</span>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="flex-1 text-sm bg-transparent border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Status bar */}
      {status && (
        <div
          className={`px-4 py-2 text-xs shrink-0 border-b border-border ${
            status.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {status.ok ? '✓' : '✗'} {status.msg}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left: summary pane */}
        <div className="w-44 shrink-0 border-r border-border p-3 overflow-y-auto bg-secondary/20">
          <p className="field-label mb-2">収集データ</p>
          {summary.map((s, i) => (
            <div key={i} className="mb-3">
              <p className="text-xs font-semibold truncate text-foreground" title={s.name}>{s.name}</p>
              {s.items.map((item, j) => (
                <p key={j} className={`text-xs ${item.sub ? 'pl-2 text-amber-600' : item.error ? 'text-destructive' : item.unconfigured ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                  {item.error ? `✗ ${item.label}` : item.unconfigured ? `${item.label} - 未連携` : item.sub ? `⚠ ${item.label}: ${item.count}件` : `${item.label}: ${item.count}件`}
                </p>
              ))}
            </div>
          ))}
          <div className="pt-2 border-t border-border mt-2">
            <p className="field-label">テンプレート</p>
            <p className="text-xs text-muted-foreground mt-0.5">{template?.name || '不明'}</p>
          </div>
        </div>

        {/* Right: editor / preview */}
        {viewMode === 'edit' ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 p-4 font-mono text-sm resize-none focus:outline-none bg-background"
            style={{ userSelect: 'text' }}
            placeholder="ここにレポートが表示されます..."
            spellCheck={false}
          />
        ) : (
          <div className="flex-1 p-4 text-sm overflow-y-auto bg-background [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5 [&_p]:my-1 [&_hr]:border-border [&_hr]:my-3 [&_code]:bg-secondary [&_code]:px-1 [&_code]:rounded">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              urlTransform={(url) => url}
              components={{
                a: ({ href, children }) => (
                  <a
                    href={href}
                    className="text-blue-500 underline hover:text-blue-700"
                    onClick={(e) => { e.preventDefault(); if (href) window.open(href) }}
                  >
                    {children}
                  </a>
                )
              }}
            >
              {text}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
