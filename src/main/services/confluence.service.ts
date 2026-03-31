import type { ConfluenceProjectConfig } from '@shared/types/settings.types'
import type { DateRange, CollectedData, ConfluencePage } from '@shared/types/report.types'
import { CONFLUENCE_MAX_PAGES } from '@shared/constants'

interface ConfluenceUser {
  accountId?: string  // Cloud
  username?: string   // Server/DC
  displayName: string
  email?: string
}

interface ConfluenceContentResult {
  id: string
  title: string
  space: { key: string; name: string }
  version: { when: string }
  _links: { webui: string; base?: string }
}

interface ConfluenceSearchResponse {
  results: ConfluenceContentResult[]
  size: number
  totalSize: number
}

function buildHeaders(email: string, apiToken: string): Record<string, string> {
  const encoded = Buffer.from(`${email}:${apiToken}`).toString('base64')
  return {
    Authorization: `Basic ${encoded}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
}

function apiBase(config: ConfluenceProjectConfig): string {
  const base = config.baseUrl.replace(/\/$/, '')
  // Cloud: https://company.atlassian.net → /wiki/rest/api
  // Server: https://confluence.company.com → /rest/api
  return config.isServer ? `${base}/rest/api` : `${base}/wiki/rest/api`
}

function webBase(config: ConfluenceProjectConfig): string {
  const base = config.baseUrl.replace(/\/$/, '')
  return config.isServer ? base : `${base}/wiki`
}

async function confluenceGet<T>(url: string, email: string, apiToken: string): Promise<T> {
  const response = await fetch(url, { headers: buildHeaders(email, apiToken) })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Confluence API error: ${response.status} ${response.statusText} (${url})\n${body}`)
  }
  return response.json() as T
}

export async function testConfluenceConnection(
  baseUrl: string,
  email: string,
  apiToken: string,
  isServer?: boolean
): Promise<string> {
  const base = baseUrl.replace(/\/$/, '')
  const apiPath = isServer ? `${base}/rest/api` : `${base}/wiki/rest/api`
  const url = `${apiPath}/user/current`
  const data = await confluenceGet<ConfluenceUser>(url, email, apiToken)
  return `Connection successful: ${data.displayName} (${data.email ?? data.username ?? ''})`
}

export async function fetchConfluencePages(
  config: ConfluenceProjectConfig,
  dateRange: DateRange,
  apiToken: string,
  log: (line: string) => void
): Promise<NonNullable<CollectedData['confluence']>> {
  const base = apiBase(config)
  const web = webBase(config)

  // Get current user
  log(`[Confluence] GET ${base}/user/current`)
  const me = await confluenceGet<ConfluenceUser>(`${base}/user/current`, config.email, apiToken)
  log(`[Confluence] User: ${me.displayName}`)

  const start = dateRange.start.substring(0, 10)
  const end = dateRange.end.substring(0, 10)

  // Build CQL
  let cql = `contributor = currentUser() AND lastModified >= "${start}" AND lastModified <= "${end}" AND type = "page" ORDER BY lastModified DESC`
  if (config.spaceKey) {
    cql = `contributor = currentUser() AND space = "${config.spaceKey}" AND lastModified >= "${start}" AND lastModified <= "${end}" AND type = "page" ORDER BY lastModified DESC`
  }

  const params = new URLSearchParams({
    cql,
    limit: String(CONFLUENCE_MAX_PAGES),
    expand: 'space,version'
  })

  const searchUrl = `${base}/content/search?${params.toString()}`
  log(`[Confluence] GET ${searchUrl}`)

  const resp = await confluenceGet<ConfluenceSearchResponse>(searchUrl, config.email, apiToken)
  log(`[Confluence] ${resp.results.length} pages fetched`)

  const pages: ConfluencePage[] = resp.results.map((r) => ({
    id: r.id,
    title: r.title,
    spaceKey: r.space.key,
    spaceName: r.space.name,
    updatedAt: r.version.when,
    url: `${web}${r._links.webui}`
  }))

  log(`[stdout]\n${pages.map((p) => `  [${p.spaceKey}] ${p.title}`).join('\n')}`)
  return { pages, fetchedAt: new Date().toISOString() }
}
