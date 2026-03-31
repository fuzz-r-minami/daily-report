import type { JiraProjectConfig } from '@shared/types/settings.types'
import type { DateRange, CollectedData, JiraIssue } from '@shared/types/report.types'
import { JIRA_MAX_ISSUES } from '@shared/constants'

interface JiraApiUser {
  accountId?: string  // Cloud
  name?: string       // Server/DC
  displayName: string
  emailAddress?: string
}

interface JiraApiIssue {
  id: string
  key: string
  fields: {
    summary: string
    status: { name: string }
    issuetype: { name: string }
    project: { name: string; key: string }
    updated: string
    created: string
    assignee?: JiraApiUser | null
    reporter?: JiraApiUser | null
  }
}

function buildHeaders(email: string, apiToken: string): Record<string, string> {
  const encoded = Buffer.from(`${email}:${apiToken}`).toString('base64')
  return {
    Authorization: `Basic ${encoded}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
}

function apiBase(config: JiraProjectConfig): string {
  const base = config.baseUrl.replace(/\/$/, '')
  const version = config.isServer ? '2' : '3'
  return `${base}/rest/api/${version}`
}

async function jiraGet<T>(url: string, email: string, apiToken: string): Promise<T> {
  const response = await fetch(url, { headers: buildHeaders(email, apiToken) })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`JIRA API error: ${response.status} ${response.statusText} (${url})\n${body}`)
  }
  return response.json() as T
}

export async function testJiraConnection(
  baseUrl: string,
  email: string,
  apiToken: string,
  isServer?: boolean
): Promise<string> {
  const base = baseUrl.replace(/\/$/, '')
  const version = isServer ? '2' : '3'
  const url = `${base}/rest/api/${version}/myself`
  const data = await jiraGet<JiraApiUser>(url, email, apiToken)
  return `Connection successful: ${data.displayName} (${data.emailAddress ?? data.name ?? ''})`
}

export async function fetchJiraIssues(
  config: JiraProjectConfig,
  dateRange: DateRange,
  apiToken: string,
  log: (line: string) => void
): Promise<NonNullable<CollectedData['jira']>> {
  const base = apiBase(config)

  // Get current user info
  log(`[JIRA] GET ${base}/myself`)
  const me = await jiraGet<JiraApiUser>(`${base}/myself`, config.email, apiToken)
  const userId = me.accountId ?? me.name ?? config.email
  log(`[JIRA] User: ${me.displayName} (${userId})`)

  const start = dateRange.start.substring(0, 10)
  // Use next day for end so that "updated < endExclusive" covers the full end date.
  // Parse as local date components to avoid UTC-offset shifting (YYYY-MM-DD strings
  // are parsed as UTC midnight by the Date constructor, which can shift the date in
  // negative-offset timezones).
  const [ey, em, ed] = dateRange.end.substring(0, 10).split('-').map(Number)
  const endDate = new Date(ey, em - 1, ed + 1) // local time; month overflow handled automatically
  const endExclusive = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

  // Build JQL
  let jql = `(assignee = currentUser() OR reporter = currentUser()) AND updated >= "${start}" AND updated < "${endExclusive}" ORDER BY updated DESC`
  if (config.projectKey) {
    jql = `project = "${config.projectKey}" AND (assignee = currentUser() OR reporter = currentUser()) AND updated >= "${start}" AND updated < "${endExclusive}" ORDER BY updated DESC`
  }

  const params = new URLSearchParams({
    jql,
    maxResults: String(JIRA_MAX_ISSUES),
    fields: 'summary,status,issuetype,project,updated,created,assignee,reporter'
  })

  const searchEndpoint = config.isServer ? 'search' : 'search/jql'
  const searchUrl = `${base}/${searchEndpoint}?${params.toString()}`
  log(`[JIRA] GET ${searchUrl}`)

  const resp = await jiraGet<{ issues: JiraApiIssue[] }>(searchUrl, config.email, apiToken)
  log(`[JIRA] ${resp.issues.length} issues fetched`)

  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const issues: JiraIssue[] = resp.issues.map((issue) => ({
    id: issue.id,
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status.name,
    issueType: issue.fields.issuetype.name,
    projectName: issue.fields.project.name,
    projectKey: issue.fields.project.key,
    updatedAt: issue.fields.updated,
    createdAt: issue.fields.created,
    url: `${baseUrl}/browse/${issue.key}`
  }))

  log(`[stdout]\n${issues.map((i) => `  ${i.key} [${i.status}] ${i.summary}`).join('\n')}`)
  return { issues, fetchedAt: new Date().toISOString() }
}
