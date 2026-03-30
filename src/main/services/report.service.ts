import type { DateRange, CollectedData, AllocationResult } from '@shared/types/report.types'

/** 最初の非空行を返す */
function firstLine(s: string): string {
  return (s.split(/\r?\n/).find((l) => l.trim()) ?? '').trim()
}

/** yyyy/mm/dd hh:mm 形式（0埋め）でローカル時刻を返す */
function formatDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Git リポジトリURLからコミット URL を生成する (GitHub / GitLab / Gitea 等) */
function gitCommitUrl(repoUrl: string, hash: string): string {
  const base = repoUrl.replace(/\.git$/, '').replace(/\/$/, '')
  return `${base}/commit/${hash}`
}

/** SVN リビジョンの差分リンクを TortoiseSVN 形式で生成する */
function svnRevisionUrl(repoUrl: string, revision: number): string {
  const url = repoUrl.replace(/\/$/, '')
  return `tsvncmd:command:showcompare?url1:${url}?revision1:${revision - 1}?url2:${url}?revision2:${revision}`
}

/** VCS（Git / SVN）セクションを lines に追記する */
function appendVcsSection(
  lines: string[],
  vcsName: string,
  error: string | undefined,
  commits: { label: string; url?: string }[],
  workingFiles: string[]
): void {
  if (error) {
    lines.push(`#### ${vcsName}コミット (取得エラー: ${error})`)
    lines.push('')
    return
  }
  if (commits.length === 0 && workingFiles.length === 0) return

  if (commits.length > 0) {
    lines.push(`#### ${vcsName}コミット (${commits.length}件)`)
    for (const { label, url } of commits) {
      lines.push(`- ${url ? `[${label}](${url})` : label}`)
    }
  }
  if (workingFiles.length > 0) {
    lines.push('')
    lines.push(`#### ${vcsName}作業中のファイル (${workingFiles.length}件)`)
    for (const f of workingFiles) lines.push(`- ${f}`)
  }
  lines.push('')
}

function resolvePlaceholders(text: string, dateRange: DateRange): string {
  const date = dateRange.start.substring(0, 10)
  const weekRange = `${dateRange.start.substring(0, 10)} 〜 ${dateRange.end.substring(0, 10)}`
  const [y, m] = dateRange.start.substring(0, 7).split('-')
  const month = `${y}年${m}月`
  return text
    .replace(/\{\{date\}\}/g, date)
    .replace(/\{\{week_range\}\}/g, weekRange)
    .replace(/\{\{month\}\}/g, month)
}

/** いずれかのサービスから1件以上の情報が取得できたか判定する */
function hasAnyData(data: CollectedData): boolean {
  if (data.git && !data.git.error &&
    (data.git.commits.length > 0 ||
     (data.git.uncommittedFiles?.length ?? 0) > 0 ||
     (data.git.untrackedFiles?.length ?? 0) > 0)) return true
  if (data.svn && !data.svn.error &&
    (data.svn.commits.length > 0 ||
     (data.svn.uncommittedFiles?.length ?? 0) > 0 ||
     (data.svn.untrackedFiles?.length ?? 0) > 0)) return true
  if (data.perforce && !data.perforce.error && data.perforce.changelists.length > 0) return true
  if (data.slack && !data.slack.error && data.slack.messages.length > 0) return true
  if (data.files && !data.files.error && data.files.changedFiles.length > 0) return true
  if (data.calendar && !data.calendar.error && data.calendar.events.length > 0) return true
  if (data.redmine && !data.redmine.error && data.redmine.issues.length > 0) return true
  return false
}

export function buildRawText(
  collectedData: CollectedData[],
  dateRange: DateRange,
  _type: 'daily' | 'weekly' | 'monthly',
  preamble: string = '',
  postamble: string = '',
  allocation: AllocationResult[] | null = null
): string {
  const lines: string[] = []
  const activeData = collectedData.filter(hasAnyData)

  if (preamble.trim()) {
    lines.push(resolvePlaceholders(preamble, dateRange))
    lines.push('')
  }

  if (allocation && allocation.length > 0) {
    const total = allocation.reduce((s, r) => s + r.days, 0)
    lines.push('### 稼働日数')
    for (const r of allocation) {
      lines.push(`- ${r.projectName}: ${r.days.toFixed(1)} 人日`)
    }
    lines.push(`- 合計: ${total.toFixed(1)} 人日`)
    lines.push('')
  }

  for (const data of activeData) {
    lines.push('---')
    lines.push('')
    lines.push(`## ${data.projectName}`)
    lines.push('')
    lines.push(`### 作業内容`)
    lines.push(`- TBA`)
    lines.push('')
    lines.push(`### 履歴`)
    // Git
    if (data.git) {
      const commits = data.git.commits.map((c) => {
        const date = formatDate(new Date(c.date))
        const label = `${date} | ${c.hash.substring(0, 7)} | ${firstLine(c.message)}`
        return { label, url: c.repoUrl ? gitCommitUrl(c.repoUrl, c.hash) : undefined }
      })
      const workingFiles = [...(data.git.uncommittedFiles ?? []), ...(data.git.untrackedFiles ?? [])]
      appendVcsSection(lines, 'Git', data.git.error, commits, workingFiles)
    }

    // SVN
    if (data.svn) {
      const commits = data.svn.commits.map((c) => {
        const date = formatDate(new Date(c.date))
        const label = `${date} | r${c.revision} | ${firstLine(c.message)}`
        return { label, url: c.repoUrl ? svnRevisionUrl(c.repoUrl, c.revision) : undefined }
      })
      const workingFiles = [...(data.svn.uncommittedFiles ?? []), ...(data.svn.untrackedFiles ?? [])]
      appendVcsSection(lines, 'SVN', data.svn.error, commits, workingFiles)
    }

    // Slack
    if (data.slack) {
      if (data.slack.error) {
        lines.push(`#### Slack投稿 (取得エラー: ${data.slack.error})`)
        lines.push('')
      } else if (data.slack.messages.length > 0) {
        lines.push(`#### Slack投稿 (${data.slack.messages.length}件)`)
        for (const m of data.slack.messages) {
          const date = formatDate(new Date(parseFloat(m.timestamp) * 1000))
          const body = firstLine(m.text)
          const label = `${date} | ${body}`
          const linked = m.permalink ? `[${label}](${m.permalink})` : label
          lines.push(`- ${linked}`)
        }
        lines.push('')
      }
    }

    // Files
    if (data.files) {
      if (data.files.error) {
        lines.push(`#### 変更ファイル (取得エラー: ${data.files.error})`)
        lines.push('')
      } else if (data.files.changedFiles.length > 0) {
        lines.push(`#### 変更ファイル (${data.files.changedFiles.length}件)`)
        for (const f of data.files.changedFiles) {
          const date = formatDate(new Date(f.modifiedAt))
          lines.push(`- ${f.path} (${f.changeType}, ${date})`)
        }
        lines.push('')
      }
    }

    // Perforce
    if (data.perforce) {
      if (data.perforce.error) {
        lines.push(`#### Perforceチェンジリスト (取得エラー: ${data.perforce.error})`)
        lines.push('')
      } else if (data.perforce.changelists.length > 0) {
        lines.push(`#### Perforceチェンジリスト (${data.perforce.changelists.length}件)`)
        for (const cl of data.perforce.changelists) {
          const date = formatDate(new Date(cl.date))
          const firstMsg = cl.description.split('\n')[0].trim()
          lines.push(`- ${date} | CL${cl.change} | ${firstMsg}`)
        }
        lines.push('')
      }
    }

    // Redmine
    if (data.redmine) {
      if (data.redmine.error) {
        lines.push(`#### Redmineチケット (取得エラー: ${data.redmine.error})`)
        lines.push('')
      } else if (data.redmine.issues.length > 0) {
        lines.push(`#### Redmineチケット (${data.redmine.issues.length}件)`)
        for (const issue of data.redmine.issues) {
          const date = formatDate(new Date(issue.updatedOn))
          const label = `${date} | #${issue.id} [${issue.status}] ${issue.subject}`
          lines.push(`- [${label}](${issue.url})`)
        }
        lines.push('')
      }
    }

    // Calendar
    if (data.calendar) {
      if (data.calendar.error) {
        lines.push(`#### 会議 (取得エラー: ${data.calendar.error})`)
        lines.push('')
      } else if (data.calendar.events.length > 0) {
        lines.push(`#### 会議（${data.calendar.events.length}件）`)
        for (const e of data.calendar.events) {
          const date = formatDate(new Date(e.start))
          const label = `${date} | ${e.summary}`
          const linked = e.htmlLink ? `[${label}](${e.htmlLink})` : label
          lines.push(`- ${linked}`)
        }
        lines.push('')
      }
    }    
  }

  if (postamble.trim()) {    
    lines.push('')
    lines.push('---')
    lines.push(resolvePlaceholders(postamble, dateRange))
  }

  return lines.join('\n')
}
