import { ipcMain, BrowserWindow, dialog, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import type { IpcResult } from '@shared/types/ipc.types'
import type { DateRange, ReportSession, CollectedData, CalendarEvent } from '@shared/types/report.types'
import type { Project } from '@shared/types/settings.types'
import * as settingsStore from '../store/settings.store'
import * as credentialsStore from '../store/credentials.store'
import { fetchGitCommits } from '../services/git.service'
import { fetchSvnCommits } from '../services/svn.service'
import { fetchSlackMessages } from '../services/slack.service'
import { fetchChangedFiles } from '../services/file-watcher.service'
import { fetchCalendarEvents, matchesProject } from '../services/calendar.service'
import { fetchP4Changes } from '../services/perforce.service'
import { fetchRedmineIssues } from '../services/redmine.service'
import { fetchJiraIssues } from '../services/jira.service'
import { fetchConfluencePages } from '../services/confluence.service'
import { buildRawText } from '../services/report.service'
import { computeAllocation } from '../services/allocation.service'
import type { AllocationResult } from '@shared/types/report.types'

const SERVICE_TIMEOUT_MS = 30_000

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`タイムアウト: ${label} (${SERVICE_TIMEOUT_MS / 1000}秒)`)),
        SERVICE_TIMEOUT_MS
      )
    )
  ])
}

function sendProgress(
  win: BrowserWindow,
  projectId: string,
  projectName: string,
  step: 'git' | 'svn' | 'perforce' | 'redmine' | 'jira' | 'confluence' | 'slack' | 'files' | 'calendar',
  status: 'running' | 'done' | 'error' | 'skipped',
  message?: string
): void {
  win.webContents.send('report:progress', { projectId, projectName, step, status, message })
}

function sendLog(win: BrowserWindow, line: string): void {
  win.webContents.send('report:log', line)
}

function extractErrorMessage(e: unknown): string {
  if (e && typeof e === 'object') {
    const err = e as Record<string, unknown>
    const parts: string[] = []
    if (err.message) parts.push(String(err.message))
    if (err.stderr) parts.push(`stderr: ${String(err.stderr).trim()}`)
    if (err.stdout) parts.push(`stdout: ${String(err.stdout).trim()}`)
    if (err.code !== undefined) parts.push(`exit code: ${err.code}`)
    if (parts.length > 0) return parts.join('\n  ')
  }
  return String(e)
}

function ts(): string {
  return new Date().toLocaleTimeString('ja-JP', { hour12: false })
}

// ── キャッシュ型 ───────────────────────────────────────────────────

type SlackMessages = NonNullable<CollectedData['slack']>['messages']

/** credentialKey → その token で取得した全チャンネルのメッセージ */
type SlackPrefetchCache = Map<string, {
  messages: SlackMessages
  fetchedAt: string
  error?: string
}>

/** カレンダーイベント一括取得結果（null = Calendar 有効プロジェクトなし） */
type CalendarPrefetchCache = {
  events: CalendarEvent[]
  fetchedAt: string
  error?: string
} | null

// ── 一括事前取得 ──────────────────────────────────────────────────

/**
 * Slack: ワークスペース（credentialKey）ごとに、対象プロジェクト全チャンネルをまとめて1回取得する。
 */
async function prefetchSlackAll(
  win: BrowserWindow,
  projects: Project[],
  dateRange: DateRange
): Promise<SlackPrefetchCache> {
  const cache: SlackPrefetchCache = new Map()

  const slackWorkspaces = settingsStore.getSettings().slackWorkspaces ?? []

  // credentialKey → 使用している全 channelId を集約
  const credToChannels = new Map<string, { channelIds: string[]; baseConfig: NonNullable<Project['slack']> }>()
  for (const project of projects) {
    if (!project.slack?.enabled) continue
    const workspace = slackWorkspaces.find((w) => w.workspaceId === project.slack!.workspaceId)
    if (!workspace) continue
    const key = workspace.credentialKey
    if (!credToChannels.has(key)) {
      credToChannels.set(key, { channelIds: [], baseConfig: project.slack })
    }
    const entry = credToChannels.get(key)!
    for (const ch of project.slack.channelIds) {
      if (!entry.channelIds.includes(ch)) entry.channelIds.push(ch)
    }
  }

  if (credToChannels.size === 0) return cache

  for (const [credKey, { channelIds, baseConfig }] of credToChannels) {
    sendLog(win, `[${ts()}] Slack: 一括取得開始 channels=${channelIds.join(',')} ${dateRange.start}〜${dateRange.end}`)
    try {
      const token = await credentialsStore.getCredential(credKey)
      if (!token) {
        sendLog(win, `[${ts()}] Slack: トークン未設定のためスキップ (key=${credKey})`)
        cache.set(credKey, { messages: [], fetchedAt: new Date().toISOString(), error: 'トークン未設定' })
        continue
      }
      const aggregatedConfig = { ...baseConfig, channelIds }
      const result = await withTimeout(
        fetchSlackMessages(aggregatedConfig, dateRange, token, (line) => sendLog(win, line)),
        'Slack'
      )
      const replyCount = result.messages.filter((m) => m.text.startsWith('スレッド返信:')).length
      sendLog(win, `[${ts()}] Slack: 一括取得完了 ${result.messages.length}件（うちスレッド返信=${replyCount}件）`)
      cache.set(credKey, { messages: result.messages, fetchedAt: result.fetchedAt })
    } catch (e) {
      const error = extractErrorMessage(e)
      sendLog(win, `[${ts()}] Slack: 一括取得エラー ${error}`)
      cache.set(credKey, { messages: [], fetchedAt: new Date().toISOString(), error })
    }
  }

  return cache
}

/**
 * Google Calendar: 全有効プロジェクトのカレンダーIDを集約して1回取得する。
 */
async function prefetchCalendarAll(
  win: BrowserWindow,
  projects: Project[],
  dateRange: DateRange
): Promise<CalendarPrefetchCache> {
  const enabledProjects = projects.filter((p) => p.googleCalendar?.enabled)
  if (enabledProjects.length === 0) return null

  const settings = settingsStore.getSettings()
  const gc = settings.googleCalendar
  if (!gc?.clientId || !gc?.clientSecret) {
    sendLog(win, `[${ts()}] Calendar: Client ID/Secret 未設定のためスキップ`)
    return { events: [], fetchedAt: new Date().toISOString(), error: 'Client ID/Secret 未設定' }
  }

  const refreshToken = await credentialsStore.getCredential(gc.credentialKey || 'google-calendar-refresh-token')
  if (!refreshToken) {
    sendLog(win, `[${ts()}] Calendar: リフレッシュトークン未設定のためスキップ`)
    return { events: [], fetchedAt: new Date().toISOString(), error: 'リフレッシュトークン未設定' }
  }

  sendLog(win, `[${ts()}] Calendar: 一括取得開始 calendar=primary ${dateRange.start}〜${dateRange.end}`)
  try {
    const events = await withTimeout(
      fetchCalendarEvents(gc.clientId, gc.clientSecret, refreshToken, ['primary'], dateRange),
      'Calendar'
    )
    sendLog(win, `[${ts()}] Calendar: 一括取得完了 ${events.length}件`)
    return { events, fetchedAt: new Date().toISOString() }
  } catch (e) {
    const error = extractErrorMessage(e)
    sendLog(win, `[${ts()}] Calendar: 一括取得エラー ${error}`)
    return { events: [], fetchedAt: new Date().toISOString(), error }
  }
}

// ── プロジェクト別データ収集 ──────────────────────────────────────

async function collectGitData(
  win: BrowserWindow,
  project: Project,
  dateRange: DateRange
): Promise<CollectedData['git']> {
  const enabledRepos = (project.gitRepos || []).filter((r) => r.enabled)
  if (enabledRepos.length === 0) {
    sendProgress(win, project.id, project.name, 'git', 'skipped')
    return undefined
  }

  sendProgress(win, project.id, project.name, 'git', 'running')
  const allCommits: NonNullable<CollectedData['git']>['commits'] = []
  const allUncommitted: string[] = []
  const allUntracked: string[] = []
  let error: string | undefined

  for (const repo of enabledRepos) {
    sendLog(win, `[${ts()}] Git: git log ${repo.localPath} branch=${repo.branch} ${dateRange.start}〜${dateRange.end}`)
    try {
      const token = repo.credentialKey ? await credentialsStore.getCredential(repo.credentialKey) : null
      const result = await withTimeout(fetchGitCommits(repo, dateRange, token, (line) => sendLog(win, line)), 'Git')
      allCommits.push(...result.commits)
      if (result.uncommittedFiles) allUncommitted.push(...result.uncommittedFiles)
      if (result.untrackedFiles) allUntracked.push(...result.untrackedFiles)
      sendLog(win, `[${ts()}] Git: ${repo.localPath} → ${result.commits.length}件取得`)
    } catch (e) {
      error = extractErrorMessage(e)
      sendLog(win, `[${ts()}] Git エラー: ${repo.localPath}`)
      sendLog(win, `  ${error}`)
    }
  }
  allCommits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  sendProgress(win, project.id, project.name, 'git', error ? 'error' : 'done', `${allCommits.length}件取得`)
  return { commits: allCommits, fetchedAt: new Date().toISOString(), error, uncommittedFiles: allUncommitted, untrackedFiles: allUntracked }
}

async function collectSvnData(
  win: BrowserWindow,
  project: Project,
  dateRange: DateRange
): Promise<CollectedData['svn']> {
  const enabledRepos = (project.svnRepos || []).filter((r) => r.enabled)
  if (enabledRepos.length === 0) {
    sendProgress(win, project.id, project.name, 'svn', 'skipped')
    return undefined
  }

  sendProgress(win, project.id, project.name, 'svn', 'running')
  const allCommits: NonNullable<CollectedData['svn']>['commits'] = []
  const allUncommitted: string[] = []
  const allUntracked: string[] = []
  let error: string | undefined

  for (const repo of enabledRepos) {
    sendLog(win, `[${ts()}] SVN:`)
    try {
      const result = await withTimeout(fetchSvnCommits(repo, dateRange, (line) => sendLog(win, line)), 'SVN')
      allCommits.push(...result.commits)
      if (result.uncommittedFiles) allUncommitted.push(...result.uncommittedFiles)
      if (result.untrackedFiles) allUntracked.push(...result.untrackedFiles)
      sendLog(win, `[${ts()}] SVN: ${repo.repoUrl} → ${result.commits.length}件取得`)
    } catch (e) {
      error = extractErrorMessage(e)
      sendLog(win, `[${ts()}] SVN エラー: ${repo.repoUrl}`)
      sendLog(win, `  ${error}`)
    }
  }
  allCommits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  sendProgress(win, project.id, project.name, 'svn', error ? 'error' : 'done', `${allCommits.length}件取得`)
  return { commits: allCommits, fetchedAt: new Date().toISOString(), error, uncommittedFiles: allUncommitted, untrackedFiles: allUntracked }
}

/** キャッシュからこのプロジェクトの Slack データを組み立てる（API 呼び出しなし） */
function collectSlackData(
  win: BrowserWindow,
  project: Project,
  cache: SlackPrefetchCache
): CollectedData['slack'] {
  if (!project.slack?.enabled) {
    sendProgress(win, project.id, project.name, 'slack', 'skipped')
    return undefined
  }

  sendProgress(win, project.id, project.name, 'slack', 'running')

  const slackWorkspaces = settingsStore.getSettings().slackWorkspaces ?? []
  const workspace = slackWorkspaces.find((w) => w.workspaceId === project.slack!.workspaceId)
  const cached = workspace ? cache.get(workspace.credentialKey) : undefined
  if (!cached) {
    sendProgress(win, project.id, project.name, 'slack', 'skipped')
    return undefined
  }
  if (cached.error) {
    sendProgress(win, project.id, project.name, 'slack', 'error', cached.error)
    return { messages: [], fetchedAt: cached.fetchedAt, error: cached.error }
  }

  // このプロジェクトのチャンネルに絞り込む
  const channelIds = new Set(project.slack.channelIds)
  const messages = cached.messages.filter((m) => channelIds.has(m.channelId))
  sendLog(win, `[${ts()}] Slack [${project.name}]: キャッシュから ${messages.length}件抽出`)
  sendProgress(win, project.id, project.name, 'slack', 'done', `${messages.length}件取得`)
  return { messages, fetchedAt: cached.fetchedAt }
}

async function collectFileData(
  win: BrowserWindow,
  project: Project,
  dateRange: DateRange
): Promise<CollectedData['files']> {
  if (!project.filePaths || project.filePaths.length === 0) {
    sendProgress(win, project.id, project.name, 'files', 'skipped')
    return undefined
  }

  sendProgress(win, project.id, project.name, 'files', 'running')
  sendLog(win, `[${ts()}] Files: ${project.filePaths.map(f => f.path).join(', ')} ${dateRange.start}〜${dateRange.end}`)
  try {
    const result = await fetchChangedFiles(project.filePaths, dateRange)
    sendLog(win, `[${ts()}] Files: ${result.changedFiles.length}件取得`)
    sendProgress(win, project.id, project.name, 'files', 'done', `${result.changedFiles.length}件取得`)
    return result
  } catch (e) {
    sendLog(win, `[${ts()}] Files エラー: ${String(e)}`)
    sendProgress(win, project.id, project.name, 'files', 'error', String(e))
    return { changedFiles: [], fetchedAt: new Date().toISOString(), error: String(e) }
  }
}

async function collectPerforceData(
  win: BrowserWindow,
  project: Project,
  dateRange: DateRange
): Promise<CollectedData['perforce']> {
  const enabledRepos = (project.perforceRepos || []).filter((r) => r.enabled)
  if (enabledRepos.length === 0) {
    sendProgress(win, project.id, project.name, 'perforce', 'skipped')
    return undefined
  }

  sendProgress(win, project.id, project.name, 'perforce', 'running')
  const allChangelists: NonNullable<CollectedData['perforce']>['changelists'] = []
  let error: string | undefined

  for (const repo of enabledRepos) {
    sendLog(win, `[${ts()}] Perforce: p4 changes ${repo.port} user=${repo.username} ${repo.depotPath} ${dateRange.start}〜${dateRange.end}`)
    try {
      const password = repo.credentialKey
        ? (await credentialsStore.getCredential(repo.credentialKey)) ?? ''
        : ''
      const result = await withTimeout(
        fetchP4Changes(repo, dateRange, password, (line) => sendLog(win, line)),
        'Perforce'
      )
      allChangelists.push(...result.changelists)
      sendLog(win, `[${ts()}] Perforce: ${repo.depotPath} → ${result.changelists.length}件取得`)
    } catch (e) {
      error = extractErrorMessage(e)
      sendLog(win, `[${ts()}] Perforce エラー: ${repo.depotPath}`)
      sendLog(win, `  ${error}`)
    }
  }
  allChangelists.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  sendProgress(win, project.id, project.name, 'perforce', error ? 'error' : 'done', `${allChangelists.length}件取得`)
  return { changelists: allChangelists, fetchedAt: new Date().toISOString(), error }
}

async function collectRedmineData(
  win: BrowserWindow,
  project: Project,
  dateRange: DateRange
): Promise<CollectedData['redmine']> {
  const enabledConfigs = (project.redmineConfigs || []).filter((c) => c.enabled)
  if (enabledConfigs.length === 0) {
    sendProgress(win, project.id, project.name, 'redmine', 'skipped')
    return undefined
  }

  sendProgress(win, project.id, project.name, 'redmine', 'running')
  const allIssues: NonNullable<CollectedData['redmine']>['issues'] = []
  let error: string | undefined

  for (const config of enabledConfigs) {
    sendLog(win, `[${ts()}] Redmine: ${config.baseUrl} project=${config.projectId || '(全体)'} ${dateRange.start}〜${dateRange.end}`)
    try {
      const apiKey = config.credentialKey
        ? await credentialsStore.getCredential(config.credentialKey)
        : null
      if (!apiKey) {
        sendLog(win, `[${ts()}] Redmine: APIキー未設定のためスキップ`)
        continue
      }
      const basicPassword = config.basicAuthPasswordKey
        ? (await credentialsStore.getCredential(config.basicAuthPasswordKey)) ?? undefined
        : undefined
      const result = await withTimeout(
        fetchRedmineIssues(config, dateRange, apiKey, (line) => sendLog(win, line), basicPassword),
        'Redmine'
      )
      allIssues.push(...result.issues)
      sendLog(win, `[${ts()}] Redmine: ${config.baseUrl} → ${result.issues.length}件取得`)
    } catch (e) {
      error = extractErrorMessage(e)
      sendLog(win, `[${ts()}] Redmine エラー: ${config.baseUrl}`)
      sendLog(win, `  ${error}`)
    }
  }
  allIssues.sort((a, b) => new Date(b.updatedOn).getTime() - new Date(a.updatedOn).getTime())
  sendProgress(win, project.id, project.name, 'redmine', error ? 'error' : 'done', `${allIssues.length}件取得`)
  return { issues: allIssues, fetchedAt: new Date().toISOString(), error }
}

async function collectJiraData(
  win: BrowserWindow,
  project: Project,
  dateRange: DateRange
): Promise<CollectedData['jira']> {
  const enabledConfigs = (project.jiraConfigs || []).filter((c) => c.enabled)
  if (enabledConfigs.length === 0) {
    sendProgress(win, project.id, project.name, 'jira', 'skipped')
    return undefined
  }

  sendProgress(win, project.id, project.name, 'jira', 'running')
  const allIssues: NonNullable<CollectedData['jira']>['issues'] = []
  let error: string | undefined

  for (const config of enabledConfigs) {
    sendLog(win, `[${ts()}] JIRA: ${config.baseUrl} project=${config.projectKey || '(all)'} ${dateRange.start}〜${dateRange.end}`)
    try {
      const apiToken = config.credentialKey
        ? await credentialsStore.getCredential(config.credentialKey)
        : null
      if (!apiToken) {
        sendLog(win, `[${ts()}] JIRA: API token not set, skipping`)
        continue
      }
      const result = await withTimeout(
        fetchJiraIssues(config, dateRange, apiToken, (line) => sendLog(win, line)),
        'JIRA'
      )
      allIssues.push(...result.issues)
      sendLog(win, `[${ts()}] JIRA: ${config.baseUrl} → ${result.issues.length} issues`)
    } catch (e) {
      error = extractErrorMessage(e)
      sendLog(win, `[${ts()}] JIRA error: ${config.baseUrl}`)
      sendLog(win, `  ${error}`)
    }
  }
  allIssues.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  sendProgress(win, project.id, project.name, 'jira', error ? 'error' : 'done', `${allIssues.length} issues`)
  return { issues: allIssues, fetchedAt: new Date().toISOString(), error }
}

async function collectConfluenceData(
  win: BrowserWindow,
  project: Project,
  dateRange: DateRange
): Promise<CollectedData['confluence']> {
  const enabledConfigs = (project.confluenceConfigs || []).filter((c) => c.enabled)
  if (enabledConfigs.length === 0) {
    sendProgress(win, project.id, project.name, 'confluence', 'skipped')
    return undefined
  }

  sendProgress(win, project.id, project.name, 'confluence', 'running')
  const allPages: NonNullable<CollectedData['confluence']>['pages'] = []
  let error: string | undefined

  for (const config of enabledConfigs) {
    sendLog(win, `[${ts()}] Confluence: ${config.baseUrl} space=${config.spaceKey || '(all)'} ${dateRange.start}〜${dateRange.end}`)
    try {
      const apiToken = config.credentialKey
        ? await credentialsStore.getCredential(config.credentialKey)
        : null
      if (!apiToken) {
        sendLog(win, `[${ts()}] Confluence: API token not set, skipping`)
        continue
      }
      const result = await withTimeout(
        fetchConfluencePages(config, dateRange, apiToken, (line) => sendLog(win, line)),
        'Confluence'
      )
      allPages.push(...result.pages)
      sendLog(win, `[${ts()}] Confluence: ${config.baseUrl} → ${result.pages.length} pages`)
    } catch (e) {
      error = extractErrorMessage(e)
      sendLog(win, `[${ts()}] Confluence error: ${config.baseUrl}`)
      sendLog(win, `  ${error}`)
    }
  }
  allPages.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  sendProgress(win, project.id, project.name, 'confluence', error ? 'error' : 'done', `${allPages.length} pages`)
  return { pages: allPages, fetchedAt: new Date().toISOString(), error }
}

/** キャッシュからこのプロジェクトに一致するカレンダーイベントを抽出する（API 呼び出しなし） */
function collectCalendarData(
  win: BrowserWindow,
  project: Project,
  cache: CalendarPrefetchCache
): CollectedData['calendar'] {
  if (!project.googleCalendar?.enabled) {
    sendProgress(win, project.id, project.name, 'calendar', 'skipped')
    return undefined
  }

  sendProgress(win, project.id, project.name, 'calendar', 'running')

  if (!cache) {
    sendProgress(win, project.id, project.name, 'calendar', 'skipped')
    return undefined
  }
  if (cache.error) {
    sendProgress(win, project.id, project.name, 'calendar', 'error', cache.error)
    return { events: [], fetchedAt: cache.fetchedAt, error: cache.error }
  }

  const matched = cache.events.filter((e) => matchesProject(e.summary, project.name))
  sendLog(win, `[${ts()}] Calendar [${project.name}]: キャッシュから ${matched.length}件抽出`)
  sendProgress(win, project.id, project.name, 'calendar', 'done', `${matched.length}件取得`)
  return { events: matched, fetchedAt: cache.fetchedAt }
}

// ── IPC ハンドラー登録 ────────────────────────────────────────────

export function registerReportHandlers(win: BrowserWindow): void {
  ipcMain.handle(
    'report:generate',
    async (
      _,
      projectIds: string[],
      dateRange: DateRange,
      type: 'daily' | 'weekly' | 'monthly',
      templateId: string
    ): Promise<IpcResult<ReportSession>> => {
      try {
        const allProjects = projectIds
          .map((id) => settingsStore.getProjectById(id))
          .filter((p): p is Project => p !== undefined)

        // Slack・Calendar を並列で一括取得してからプロジェクトループへ
        sendLog(win, `[${ts()}] === 一括データ取得フェーズ ===`)
        const [slackCache, calendarCache] = await Promise.all([
          prefetchSlackAll(win, allProjects, dateRange),
          prefetchCalendarAll(win, allProjects, dateRange)
        ])
        sendLog(win, `[${ts()}] === プロジェクト別収集フェーズ ===`)

        const collectedData: CollectedData[] = []

        for (const project of allProjects) {
          const data: CollectedData = {
            projectId: project.id,
            projectName: project.name,
            dateRange,
            git: await collectGitData(win, project, dateRange),
            svn: await collectSvnData(win, project, dateRange),
            perforce: await collectPerforceData(win, project, dateRange),
            redmine: await collectRedmineData(win, project, dateRange),
            jira: await collectJiraData(win, project, dateRange),
            confluence: await collectConfluenceData(win, project, dateRange),
            slack: collectSlackData(win, project, slackCache),
            files: await collectFileData(win, project, dateRange),
            calendar: collectCalendarData(win, project, calendarCache)
          }
          collectedData.push(data)
        }

        const template = settingsStore.getSettings().templates.find((t) => t.id === templateId)
        const allocation = type === 'monthly' ? computeAllocation(collectedData) : null
        const rawText = buildRawText(
          collectedData, dateRange, type,
          template?.preamble ?? '',
          template?.postamble ?? '',
          allocation
        )
        const session: ReportSession = {
          id: uuidv4(),
          type,
          dateRange,
          projectIds,
          templateId,
          collectedData,
          rawText,
          formattedText: '',
          status: 'ready',
          createdAt: new Date().toISOString()
        }

        return { success: true, data: session }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'report:allocation',
    async (
      _,
      projectIds: string[],
      yearMonth: string   // 'YYYY-MM' 形式
    ): Promise<IpcResult<AllocationResult[]>> => {
      try {
        const [year, month] = yearMonth.split('-').map(Number)
        const lastDay = new Date(year, month, 0).getDate()
        const dateRange: DateRange = {
          start: `${yearMonth}-01`,
          end: `${yearMonth}-${String(lastDay).padStart(2, '0')}`
        }

        const allProjects = projectIds
          .map((id) => settingsStore.getProjectById(id))
          .filter((p): p is Project => p !== undefined)

        sendLog(win, `[${ts()}] === 按分計算 一括データ取得 ${dateRange.start}〜${dateRange.end} ===`)
        const [slackCache, calendarCache] = await Promise.all([
          prefetchSlackAll(win, allProjects, dateRange),
          prefetchCalendarAll(win, allProjects, dateRange)
        ])
        sendLog(win, `[${ts()}] === 按分計算 プロジェクト別収集 ===`)

        const collectedData: CollectedData[] = []
        for (const project of allProjects) {
          const data: CollectedData = {
            projectId: project.id,
            projectName: project.name,
            dateRange,
            git: await collectGitData(win, project, dateRange),
            svn: await collectSvnData(win, project, dateRange),
            perforce: await collectPerforceData(win, project, dateRange),
            redmine: await collectRedmineData(win, project, dateRange),
            jira: await collectJiraData(win, project, dateRange),
            confluence: await collectConfluenceData(win, project, dateRange),
            slack: collectSlackData(win, project, slackCache),
            calendar: collectCalendarData(win, project, calendarCache)
            // files は按分計算に含めない
          }
          collectedData.push(data)
        }

        const results = computeAllocation(collectedData)
        sendLog(win, `[${ts()}] === 按分計算 完了 ===`)
        return { success: true, data: results }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'report:save',
    async (_, text: string, filename: string): Promise<IpcResult<string>> => {
      try {
        let dataDir = settingsStore.getDataDir()
        if (!dataDir) dataDir = path.join(app.getPath('documents'), 'daily-report')
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

        const result = await dialog.showSaveDialog({
          defaultPath: path.join(dataDir, filename),
          filters: [{ name: 'テキストファイル', extensions: ['txt', 'md'] }]
        })
        if (result.canceled || !result.filePath) {
          return { success: false, error: 'cancelled' }
        }
        fs.writeFileSync(result.filePath, text, 'utf-8')
        return { success: true, data: result.filePath }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )
}
