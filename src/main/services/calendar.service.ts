import http from 'http'
import https from 'https'
import { shell } from 'electron'
import type { DateRange, CalendarEvent } from '@shared/types/report.types'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
const OAUTH_TIMEOUT_MS = 120_000

// ── HTTPS ユーティリティ ─────────────────────────────────────────

function httpsPost(url: string, body: string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body), ...headers }
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          if ((res.statusCode ?? 0) >= 400) reject(new Error(`HTTP ${res.statusCode}: ${data}`))
          else resolve(data)
        })
      }
    )
    req.on('error', reject)
    req.end(body)
  })
}

function httpsGet(url: string, accessToken: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` }
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          if ((res.statusCode ?? 0) >= 400) reject(new Error(`HTTP ${res.statusCode}: ${data}`))
          else resolve(data)
        })
      }
    )
    req.on('error', reject)
    req.end()
  })
}

// ── トークン交換 ──────────────────────────────────────────────────

async function exchangeCodeForTokens(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  code: string
): Promise<{ access_token: string; refresh_token?: string }> {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  }).toString()
  const raw = await httpsPost(GOOGLE_TOKEN_URL, body, {})
  return JSON.parse(raw)
}

async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token'
  }).toString()
  const raw = await httpsPost(GOOGLE_TOKEN_URL, body, {})
  const json = JSON.parse(raw)
  if (!json.access_token) throw new Error('アクセストークンの更新に失敗しました')
  return json.access_token as string
}

// ── OAuth2 フロー ─────────────────────────────────────────────────

/**
 * ブラウザを開いて OAuth2 フローを実行し、リフレッシュトークンを返す。
 * ローカル HTTP サーバーでリダイレクトを受け取る。
 */
export function startOAuthFlow(clientId: string, clientSecret: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer()

    const timer = setTimeout(() => {
      server.close()
      reject(new Error('認証がタイムアウトしました（2分）'))
    }, OAUTH_TIMEOUT_MS)

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number }
      const redirectUri = `http://127.0.0.1:${addr.port}`

      const authUrl =
        `${GOOGLE_AUTH_URL}?` +
        `client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(SCOPES.join(' '))}` +
        `&access_type=offline` +
        `&prompt=consent`

      shell.openExternal(authUrl)

      server.once('request', async (req, res) => {
        clearTimeout(timer)
        try {
          const urlObj = new URL(req.url!, `http://127.0.0.1:${addr.port}`)
          const code = urlObj.searchParams.get('code')
          const error = urlObj.searchParams.get('error')

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end('<html><body style="font-family:sans-serif;padding:2rem"><h2>✓ 認証完了</h2><p>このタブを閉じてアプリに戻ってください。</p></body></html>')
          server.close()

          if (error || !code) {
            reject(new Error(error ? `Google 認証エラー: ${error}` : '認証コードが取得できませんでした'))
            return
          }

          const tokens = await exchangeCodeForTokens(clientId, clientSecret, redirectUri, code)
          if (!tokens.refresh_token) {
            reject(new Error('リフレッシュトークンが取得できませんでした。Google アカウント設定からアプリのアクセスを解除して再認証してください。'))
            return
          }
          resolve(tokens.refresh_token)
        } catch (e) {
          reject(e)
        }
      })

      server.on('error', (e) => {
        clearTimeout(timer)
        reject(e)
      })
    })
  })
}

// ── Calendar API ──────────────────────────────────────────────────

/** テスト接続: カレンダー一覧を取得して接続確認 */
export async function testCalendarConnection(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken)
  const raw = await httpsGet('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1', accessToken)
  const json = JSON.parse(raw)
  const primary = (json.items ?? []).find((c: { primary?: boolean; summary?: string }) => c.primary)
  return `接続成功: ${primary?.summary ?? 'カレンダー取得成功'}`
}

/** 指定期間のカレンダーイベントを取得 */
export async function fetchCalendarEvents(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  calendarIds: string[],
  dateRange: DateRange
): Promise<CalendarEvent[]> {
  const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken)

  // 期間: start の 00:00:00 〜 end の 23:59:59 (ローカル時刻)
  const startDate = new Date(dateRange.start)
  startDate.setHours(0, 0, 0, 0)
  const endDate = new Date(dateRange.end)
  endDate.setHours(23, 59, 59, 999)

  const allEvents: CalendarEvent[] = []

  for (const calendarId of calendarIds) {
    const params = new URLSearchParams({
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '2500'
    })
    const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`
    const raw = await httpsGet(url, accessToken)
    const json = JSON.parse(raw)
    const items: {
      id?: string
      summary?: string
      start?: { dateTime?: string; date?: string }
      end?: { dateTime?: string; date?: string }
      htmlLink?: string
      status?: string
      attendees?: { email?: string; self?: boolean; responseStatus?: string }[]
    }[] = json.items ?? []

    for (const item of items) {
      if (item.status === 'cancelled') continue
      if (!item.summary) continue
      // 参加者がいる場合、自分の responseStatus が 'accepted' のもののみ対象
      if (item.attendees && item.attendees.length > 0) {
        const self = item.attendees.find((a) => a.self)
        if (self && self.responseStatus !== 'accepted') continue
      }
      const start = item.start?.dateTime ?? item.start?.date ?? ''
      const end = item.end?.dateTime ?? item.end?.date ?? ''
      allEvents.push({
        id: item.id ?? '',
        summary: item.summary,
        start,
        end,
        htmlLink: item.htmlLink ?? '',
        calendarId
      })
    }
  }

  // 開始時刻昇順にソート
  allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  return allEvents
}

// ── プロジェクト名マッチング ──────────────────────────────────────

/**
 * イベントタイトルにプロジェクト名が含まれるか判定する（大文字小文字区別なし）。
 */
export function matchesProject(eventSummary: string, projectName: string): boolean {
  return eventSummary.toLowerCase().includes(projectName.toLowerCase())
}
