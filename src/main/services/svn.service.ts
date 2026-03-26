import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { parseStringPromise } from 'xml2js'
import type { SvnProjectConfig } from '@shared/types/settings.types'
import type { DateRange, CollectedData } from '@shared/types/report.types'
import { SVN_MAX_COMMITS } from '@shared/constants'
import { parseDateAsLocalMidnight, toLocalISOString } from '@shared/utils/date-utils'

const execFileAsync = promisify(execFile)

export async function checkSvnInstall(): Promise<string> {
  const { stdout } = await execFileAsync('svn', ['--version', '--quiet'])
  return stdout.trim()
}

export async function testSvnConnection(repoUrl: string): Promise<string> {
  const { stdout } = await execFileAsync('svn', ['info', '--xml', '--non-interactive', repoUrl])
  const result = await parseStringPromise(stdout)
  const url = result?.info?.entry?.[0]?.url?.[0] || repoUrl
  return `接続成功: ${url}`
}

export async function fetchSvnCommits(
  config: SvnProjectConfig,
  dateRange: DateRange,
  log: (line: string) => void = () => {}
): Promise<NonNullable<CollectedData['svn']>> {
  const startDate = parseDateAsLocalMidnight(dateRange.start)
  const endDate = parseDateAsLocalMidnight(dateRange.end)
  endDate.setHours(23, 59, 59, 999)

  const actualArgs = [
    'log', '--xml',
    '--limit', String(SVN_MAX_COMMITS),
    '-r', `{${toLocalISOString(startDate)}}:{${toLocalISOString(endDate)}}`,
    '--verbose',
    '--non-interactive'
  ]
  actualArgs.push(config.repoUrl)

  log(`svn ${actualArgs.join(' ')}`)

  let stdout: string
  try {
    const result = await execFileAsync('svn', actualArgs)
    stdout = result.stdout
    if (result.stderr) log(result.stderr)
    log(stdout)
  } catch (e) {
    const err = e as Record<string, unknown>
    if (err.stderr) log(String(err.stderr))
    if (err.stdout) log(String(err.stdout))
    throw e
  }

  const result = await parseStringPromise(stdout)
  const entries = result?.log?.logentry || []

  const allCommits = entries.map((entry: Record<string, unknown>) => {
    const paths = ((entry.paths as { path?: { _: string }[] }[])?.[0]?.path || []).map(
      (p: { _: string }) => p._ || p
    )
    return {
      revision: parseInt(String((entry as { $?: { revision?: string } }).$?.revision) || '0', 10),
      date: String(((entry as { date?: string[] }).date)?.[0] || ''),
      author: String(((entry as { author?: string[] }).author)?.[0] || ''),
      message: String(((entry as { msg?: string[] }).msg)?.[0] || '').trim(),
      paths,
      repoUrl: config.repoUrl || undefined
    }
  })

  const commits = config.username
    ? allCommits.filter((c: { author: string }) => c.author === config.username)
    : allCommits
  log(`→ ${entries.length}件中 author="${config.username ?? '全員'}" ${commits.length}件`)

  // Collect uncommitted and untracked files from working copy (期間内に変更されたもののみ)
  const uncommittedFiles: string[] = []
  const untrackedFiles: string[] = []
  if (config.localPath) {
    try {
      const { stdout: statusOut } = await execFileAsync(
        'svn', ['status', '--non-interactive'],
        { cwd: config.localPath }
      )
      for (const line of statusOut.split('\n').filter(Boolean)) {
        const statusChar = line[0]
        const filePath = line.substring(8).trim()
        if (!filePath) continue
        try {
          const mtime = fs.statSync(path.join(config.localPath, filePath)).mtime
          if (mtime < startDate || mtime > endDate) continue
        } catch {
          continue
        }
        if (statusChar === '?') {
          untrackedFiles.push(filePath)
        } else if (statusChar !== 'I') {
          uncommittedFiles.push(filePath)
        }
      }
      log(`  未コミット: ${uncommittedFiles.length}件, 未追跡: ${untrackedFiles.length}件`)
    } catch (e) {
      log(`  svn status 失敗: ${e}`)
    }
  }

  return { commits, fetchedAt: new Date().toISOString(), uncommittedFiles, untrackedFiles }
}
