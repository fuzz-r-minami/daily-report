import { ipcMain, BrowserWindow, dialog, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import type { IpcResult } from '@shared/types/ipc.types'
import type { DateRange, ReportSession, CollectedData } from '@shared/types/report.types'
import type { Project } from '@shared/types/settings.types'
import * as settingsStore from '../store/settings.store'
import * as credentialsStore from '../store/credentials.store'
import { fetchGitCommits } from '../services/git.service'
import { fetchSvnCommits } from '../services/svn.service'
import { fetchSlackMessages } from '../services/slack.service'
import { fetchChangedFiles } from '../services/file-watcher.service'
import { buildRawText } from '../services/report.service'

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
  step: 'git' | 'svn' | 'slack' | 'files',
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

async function collectSlackData(
  win: BrowserWindow,
  project: Project,
  dateRange: DateRange
): Promise<CollectedData['slack']> {
  if (!project.slack?.enabled) {
    sendProgress(win, project.id, project.name, 'slack', 'skipped')
    return undefined
  }

  sendProgress(win, project.id, project.name, 'slack', 'running')
  try {
    const token = await credentialsStore.getCredential(project.slack.credentialKey)
    if (!token) {
      sendLog(win, `[${ts()}] Slack: トークン未設定のためスキップ`)
      sendProgress(win, project.id, project.name, 'slack', 'error', 'トークン未設定')
      return undefined
    }
    sendLog(win, `[${ts()}] Slack: channels=${project.slack.channelIds.join(',')} ${dateRange.start}〜${dateRange.end}`)
    const result = await withTimeout(fetchSlackMessages(project.slack, dateRange, token, (line) => sendLog(win, line)), 'Slack')
    sendLog(win, `[${ts()}] Slack: ${result.messages.length}件取得（うちスレッド返信=${result.messages.filter(m => m.text.startsWith('[スレッド返信]')).length}件）`)
    sendProgress(win, project.id, project.name, 'slack', 'done', `${result.messages.length}件取得`)
    return result
  } catch (e) {
    sendLog(win, `[${ts()}] Slack エラー: ${String(e)}`)
    sendProgress(win, project.id, project.name, 'slack', 'error', String(e))
    return { messages: [], fetchedAt: new Date().toISOString(), error: String(e) }
  }
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

export function registerReportHandlers(win: BrowserWindow): void {
  ipcMain.handle(
    'report:generate',
    async (
      _,
      projectIds: string[],
      dateRange: DateRange,
      type: 'daily' | 'weekly',
      templateId: string
    ): Promise<IpcResult<ReportSession>> => {
      try {
        const collectedData: CollectedData[] = []

        for (const projectId of projectIds) {
          const project = settingsStore.getProjectById(projectId)
          if (!project) continue

          const data: CollectedData = {
            projectId,
            projectName: project.name,
            dateRange,
            git: await collectGitData(win, project, dateRange),
            svn: await collectSvnData(win, project, dateRange),
            slack: await collectSlackData(win, project, dateRange),
            files: await collectFileData(win, project, dateRange)
          }

          collectedData.push(data)
        }

        const rawText = buildRawText(collectedData, dateRange, type)
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
