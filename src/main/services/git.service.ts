import fs from 'fs'
import path from 'path'
import simpleGit, { type DefaultLogFields } from 'simple-git'
import type { GitProjectConfig } from '@shared/types/settings.types'
import type { DateRange, CollectedData } from '@shared/types/report.types'
import { GIT_MAX_COMMITS } from '@shared/constants'
import { parseDateAsLocalMidnight, toLocalISOString } from '@shared/utils/date-utils'

export async function testGitConnection(localPath: string, branch?: string): Promise<string> {
  const git = simpleGit(localPath)
  const status = await git.status()
  const currentBranch = status.current ?? 'unknown'
  const lines: string[] = [`現在のブランチ: ${currentBranch}`]

  if (branch) {
    // 指定ブランチの存在確認
    try {
      const branches = await git.branch(['-a'])
      const exists = Object.keys(branches.branches).some(
        (b) => b === branch || b === `remotes/origin/${branch}` || b.endsWith(`/${branch}`)
      )
      if (exists) {
        lines.push(`指定ブランチ "${branch}": 存在します ✓`)
      } else {
        lines.push(`指定ブランチ "${branch}": 見つかりません ⚠`)
        lines.push(`利用可能なブランチ: ${Object.keys(branches.branches).join(', ')}`)
      }
    } catch {
      lines.push(`ブランチ一覧の取得に失敗しました`)
    }
  }

  return lines.join('\n')
}

export async function checkGitStatus(
  localPath: string
): Promise<{ uncommitted: string[]; unpushed: number }> {
  const git = simpleGit(localPath)
  const status = await git.status()
  const uncommitted = status.files.map((f) => f.path)
  const unpushed = status.ahead
  return { uncommitted, unpushed }
}

export async function fetchGitCommits(
  config: GitProjectConfig,
  dateRange: DateRange,
  token: string | null,
  log: (line: string) => void = () => {}
): Promise<NonNullable<CollectedData['git']>> {
  const repoPath = buildRepoPath(config.localPath, config.repoUrl, token)
  log(`  localPath="${config.localPath}" repoUrl="${config.repoUrl}"`)
  log(`  → 使用パス: "${repoPath}"`)

  const git = simpleGit(repoPath)

  const startDate = parseDateAsLocalMidnight(dateRange.start)
  const endDate = parseDateAsLocalMidnight(dateRange.end)
  endDate.setHours(23, 59, 59, 999)

  // git config で user.email を取得
  let authorEmail: string | undefined
  try {
    const configResult = await git.listConfig()
    const emailVal = configResult.all['user.email']
    authorEmail = Array.isArray(emailVal) ? emailVal[0] : (emailVal as string | undefined)
    log(`  git config user.email = ${authorEmail ?? '（未設定）'}`)
  } catch (e) {
    log(`  git config 取得失敗（リポジトリが見つからない可能性）: ${e}`)
    throw e
  }

  // git log の引数を文字列配列で構築
  // NOTE: --branches=<pattern> ではなくブランチ名を positional arg として渡す
  //       --branches=main はパターンマッチングでブランチが異なると 0 件になる
  const args: string[] = [
    `--after=${toLocalISOString(startDate)}`,
    `--before=${toLocalISOString(endDate)}`,
    `--max-count=${GIT_MAX_COMMITS}`
  ]
  if (authorEmail) args.push(`--author=${authorEmail}`)

  // ブランチ指定: positional arg として末尾に追加
  // 例: git log --after=... main  →  "main" ブランチのコミットを検索
  // 未指定の場合は HEAD（現在のブランチ）が対象
  if (config.branch) {
    args.push(config.branch)
    log(`  ブランチ指定: "${config.branch}" (positional arg)`)
  } else {
    log(`  ブランチ指定なし → HEAD（現在のブランチ）が対象`)
  }

  log(`  実行: git log ${args.join(' ')}`)

  let gitLog
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gitLog = await git.log<DefaultLogFields>(args as any)
  } catch (e) {
    log(`  git log 失敗: ${e}`)
    throw e
  }

  log(`  → ${gitLog.all.length}件のコミット取得`)
  for (const c of gitLog.all) {
    log(`    ${c.hash.substring(0, 7)} ${c.date} [${c.author_email}] ${c.message.substring(0, 60)}`)
  }

  const commits = await Promise.all(
    gitLog.all.map(async (commit) => {
      let filesChanged: string[] = []
      try {
        const diff = await git.diff([`${commit.hash}^`, commit.hash, '--name-only'])
        filesChanged = diff.split('\n').filter(Boolean)
      } catch {
        // initial commit has no parent
      }
      return {
        hash: commit.hash,
        date: commit.date,
        author: commit.author_name,
        email: commit.author_email,
        message: commit.message,
        filesChanged,
        repoUrl: config.repoUrl || undefined
      }
    })
  )

  // Collect uncommitted and untracked files (期間内に変更されたもののみ)
  const uncommittedFiles: string[] = []
  const untrackedFiles: string[] = []
  if (config.localPath) {
    try {
      const statusOut = await git.raw(['status', '--porcelain'])
      for (const line of statusOut.split('\n').filter(Boolean)) {
        const xy = line.substring(0, 2)
        const filePath = line.substring(3)
        try {
          const mtime = fs.statSync(path.join(config.localPath, filePath)).mtime
          if (mtime < startDate || mtime > endDate) continue
        } catch {
          // 削除済みファイルなどは stat 不可のためスキップ
          continue
        }
        if (xy === '??') {
          untrackedFiles.push(filePath)
        } else {
          uncommittedFiles.push(filePath)
        }
      }
      log(`  未コミット: ${uncommittedFiles.length}件, 未追跡: ${untrackedFiles.length}件`)
    } catch (e) {
      log(`  git status 失敗: ${e}`)
    }
  }

  return { commits, fetchedAt: new Date().toISOString(), uncommittedFiles, untrackedFiles }
}

function buildRepoPath(localPath: string, repoUrl: string, token: string | null): string {
  if (localPath) return localPath
  if (!token || !repoUrl) return repoUrl
  try {
    const url = new URL(repoUrl)
    url.username = 'token'
    url.password = token
    return url.toString()
  } catch {
    return repoUrl
  }
}
