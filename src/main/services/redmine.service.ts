import type { RedmineProjectConfig } from '@shared/types/settings.types'
import type { DateRange, CollectedData, RedmineIssue } from '@shared/types/report.types'
import { REDMINE_MAX_ISSUES } from '@shared/constants'

interface RedmineApiUser {
  id: number
  login: string
  firstname: string
  lastname: string
}

interface RedmineApiIssue {
  id: number
  project: { id: number; name: string }
  tracker: { id: number; name: string }
  status: { id: number; name: string }
  subject: string
  author: { id: number; name: string }
  assigned_to?: { id: number; name: string }
  created_on: string
  updated_on: string
  journals?: {
    id: number
    user: { id: number; name: string }
    notes: string
    created_on: string
    details: { property: string; name: string; old_value?: string; new_value?: string }[]
  }[]
}

interface RedmineAuth {
  apiKey: string
  basicUsername?: string
  basicPassword?: string
}

function buildHeaders(auth: RedmineAuth): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Redmine-API-Key': auth.apiKey,
    'Content-Type': 'application/json'
  }
  if (auth.basicUsername && auth.basicPassword) {
    const encoded = Buffer.from(`${auth.basicUsername}:${auth.basicPassword}`).toString('base64')
    headers['Authorization'] = `Basic ${encoded}`
  }
  return headers
}

async function redmineGet<T>(baseUrl: string, path: string, auth: RedmineAuth): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, '')}${path}`
  const response = await fetch(url, { headers: buildHeaders(auth) })
  if (!response.ok) {
    throw new Error(`Redmine API エラー: ${response.status} ${response.statusText} (${url})`)
  }
  return response.json() as T
}

export async function testRedmineConnection(
  baseUrl: string,
  apiKey: string,
  basicUsername?: string,
  basicPassword?: string
): Promise<string> {
  const auth: RedmineAuth = { apiKey, basicUsername, basicPassword }
  const data = await redmineGet<{ user: RedmineApiUser }>(baseUrl, '/users/current.json', auth)
  const u = data.user
  return `接続成功: ${u.firstname} ${u.lastname} (${u.login})`
}

export async function fetchRedmineIssues(
  config: RedmineProjectConfig,
  dateRange: DateRange,
  apiKey: string,
  log: (line: string) => void,
  basicPassword?: string
): Promise<NonNullable<CollectedData['redmine']>> {
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const auth: RedmineAuth = { apiKey, basicUsername: config.username, basicPassword }

  // 現在のユーザーを取得
  log(`[Redmine] GET ${baseUrl}/users/current.json`)
  const userResp = await redmineGet<{ user: RedmineApiUser }>(baseUrl, '/users/current.json', auth)
  const userId = userResp.user.id
  log(`[Redmine] ユーザー確認: ${userResp.user.login} (id=${userId})`)

  // 日付範囲フィルター（Redmine: ><start|end）
  const start = dateRange.start.substring(0, 10)
  const end = dateRange.end.substring(0, 10)

  const params = new URLSearchParams()
  params.set('updated_on', `><${start}|${end}`)
  params.set('status_id', '*')
  params.set('limit', String(REDMINE_MAX_ISSUES))
  if (config.projectId) params.set('project_id', config.projectId)

  const issuesPath = `/issues.json?${params.toString()}`
  log(`[Redmine] GET ${baseUrl}${issuesPath}`)

  const issuesResp = await redmineGet<{ issues: RedmineApiIssue[] }>(baseUrl, issuesPath, auth)
  log(`[Redmine] ${issuesResp.issues.length}件のチケットを取得、ジャーナル確認中...`)

  const startTs = new Date(start + 'T00:00:00').getTime()
  const endTs = new Date(end + 'T23:59:59').getTime()

  // 各チケットのジャーナルを並列取得して自分の変更を確認
  const results = await Promise.all(
    issuesResp.issues.map(async (issue) => {
      const detail = await redmineGet<{ issue: RedmineApiIssue }>(
        baseUrl,
        `/issues/${issue.id}.json?include=journals`,
        auth
      )
      const d = detail.issue

      // ジャーナルに自分の変更がある
      const userJournaled = d.journals?.some((j) => {
        const jTs = new Date(j.created_on).getTime()
        return j.user.id === userId && jTs >= startTs && jTs <= endTs
      }) ?? false

      // 自分が作成したチケット（期間内に作成）
      const createdTs = new Date(d.created_on).getTime()
      const userCreated = d.author.id === userId && createdTs >= startTs && createdTs <= endTs

      if (!userJournaled && !userCreated) return null

      return {
        id: d.id,
        subject: d.subject,
        status: d.status.name,
        tracker: d.tracker.name,
        projectName: d.project.name,
        assignee: d.assigned_to ? { id: d.assigned_to.id, name: d.assigned_to.name } : undefined,
        updatedOn: d.updated_on,
        createdOn: d.created_on,
        url: `${baseUrl}/issues/${d.id}`
      } satisfies RedmineIssue
    })
  )

  const issues = results.filter((r): r is RedmineIssue => r !== null)
  issues.sort((a, b) => new Date(b.updatedOn).getTime() - new Date(a.updatedOn).getTime())

  log(`[Redmine] 対象チケット: ${issues.length}件`)
  log(`[stdout]\n${issues.map((i) => `  #${i.id} [${i.status}] ${i.subject}`).join('\n')}`)
  return { issues, fetchedAt: new Date().toISOString() }
}
