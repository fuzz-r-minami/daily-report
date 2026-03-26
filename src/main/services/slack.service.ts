import { WebClient } from '@slack/web-api'
import type { SlackProjectConfig } from '@shared/types/settings.types'
import type { DateRange, CollectedData } from '@shared/types/report.types'
import { SLACK_MAX_MESSAGES } from '@shared/constants'
import { parseDateAsLocalMidnight } from '@shared/utils/date-utils'

export async function testSlackConnection(token: string): Promise<string> {
  const client = new WebClient(token)
  const auth = await client.auth.test()
  return `接続成功: ${auth.user} (${auth.team})`
}

export async function fetchSlackChannels(
  token: string
): Promise<{ id: string; name: string }[]> {
  const client = new WebClient(token)
  const result = await client.conversations.list({ limit: 200, types: 'public_channel,private_channel' })
  return (result.channels || []).map((ch) => ({ id: ch.id || '', name: ch.name || '' }))
}

type SlackMessages = NonNullable<CollectedData['slack']>['messages']

async function fetchChannelMap(
  client: WebClient,
  log: (line: string) => void
): Promise<Map<string, string>> {
  const channelMap = new Map<string, string>()
  try {
    const chList = await client.conversations.list({ limit: 200, types: 'public_channel,private_channel' })
    for (const ch of chList.channels || []) {
      if (ch.id && ch.name) channelMap.set(ch.id, ch.name)
    }
    log(`  チャンネルマップ取得: ${channelMap.size}件`)
  } catch (e) {
    log(`  チャンネルマップ取得エラー: ${e}`)
  }
  return channelMap
}

// Phase 1: conversations.history でトップレベルメッセージを収集
async function fetchHistoryMessages(
  client: WebClient,
  channelId: string,
  channelName: string,
  myUserId: string,
  teamUrl: string,
  startTs: string,
  endTs: string,
  log: (line: string) => void
): Promise<SlackMessages> {
  const messages: SlackMessages = []
  log(`  [Phase1] conversations.history oldest=${startTs} latest=${endTs}`)
  let cursor: string | undefined
  let historyTotal = 0

  while (messages.length < SLACK_MAX_MESSAGES) {
    const result = await client.conversations.history({
      channel: channelId,
      oldest: startTs,
      latest: endTs,
      limit: 200,
      cursor
    })

    const msgs = result.messages || []
    historyTotal += msgs.length
    for (const msg of msgs) {
      if (msg.user === myUserId && msg.text && !msg.subtype) {
        const ts = msg.ts || ''
        const tsKey = ts.replace('.', '')
        const permalink = teamUrl
          ? msg.thread_ts && msg.thread_ts !== ts
            ? `${teamUrl}archives/${channelId}/p${tsKey}?thread_ts=${msg.thread_ts}&cid=${channelId}`
            : `${teamUrl}archives/${channelId}/p${tsKey}`
          : undefined
        messages.push({ timestamp: ts, channelId, channelName, text: msg.text, threadTs: msg.thread_ts, permalink })
        log(`    トップレベル追加: ts=${msg.ts} text="${msg.text.substring(0, 40)}..."`)
      }
    }

    if (!result.has_more || !result.response_metadata?.next_cursor) break
    cursor = result.response_metadata.next_cursor
  }
  log(`  [Phase1] 完了: 全${historyTotal}件中 自分=${messages.length}件追加`)
  return messages
}

// Phase 2: search.messages でスレッド返信を収集
async function fetchSearchReplies(
  client: WebClient,
  channelId: string,
  channelName: string,
  myUserId: string,
  startTs: string,
  endTs: string,
  dateRange: DateRange,
  alreadyCount: number,
  log: (line: string) => void
): Promise<SlackMessages> {
  const messages: SlackMessages = []
  const pad2 = (n: number) => String(n).padStart(2, '0')
  const localDateStr = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
  // Slack の after:/before: は exclusive なので、対象日を含めるには前日/翌日を指定する
  const startMinusOne = parseDateAsLocalMidnight(dateRange.start)
  startMinusOne.setDate(startMinusOne.getDate() - 1)
  const endPlusOne = parseDateAsLocalMidnight(dateRange.end)
  endPlusOne.setDate(endPlusOne.getDate() + 1)
  const inFilter = channelName !== channelId ? ` in:#${channelName}` : ''
  const query = `from:<@${myUserId}> after:${localDateStr(startMinusOne)} before:${localDateStr(endPlusOne)} is:thread${inFilter}`
  log(`  [Phase2] search.messages query="${query}"`)

  try {
    let page = 1
    let count = alreadyCount
    while (count < SLACK_MAX_MESSAGES) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const searchResult = await (client as any).search.messages({ query, sort: 'timestamp', sort_dir: 'asc', count: 100, page })
      const paging = searchResult.messages?.paging
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matches: any[] = searchResult.messages?.matches || []
      log(`    page=${page} total=${paging?.total ?? '?'} pages=${paging?.pages ?? '?'} matches=${matches.length}件`)

      for (const match of matches) {
        const matchCh = match.channel?.id
        const matchTs = match.ts
        const permalink = match.permalink as string | undefined
        const permalinkThreadTs = permalink?.split('thread_ts=')[1]?.split('&')[0]
        const isReply = !!permalinkThreadTs && matchTs !== permalinkThreadTs

        log(`    match: ch=${matchCh} ts=${matchTs} isReply=${isReply} permalinkThreadTs=${permalinkThreadTs ?? 'なし'} text="${String(match.text ?? '').substring(0, 30)}..."`)

        if (matchCh !== channelId) { log(`      → スキップ（チャンネル不一致: ${matchCh} != ${channelId}）`); continue }
        if (!match.text) { log(`      → スキップ（テキストなし）`); continue }
        const ts = parseFloat(matchTs || '0')
        if (ts < parseFloat(startTs) || ts > parseFloat(endTs)) { log(`      → スキップ（期間外: ${ts}）`); continue }
        if (!isReply) { log(`      → スキップ（トップレベルメッセージ、Phase1で収集済み）`); continue }

        // search.messages は長文テキストを切り詰めることがあるため conversations.replies で完全テキストを取得する
        let fullText: string = match.text
        try {
          const repliesResult = await client.conversations.replies({ channel: channelId, ts: permalinkThreadTs, limit: 200 })
          const fullMsg = repliesResult.messages?.find((r) => r.ts === matchTs)
          if (fullMsg?.text) {
            fullText = fullMsg.text
            if (fullText !== match.text) log(`      → 完全テキスト取得済み（search=${match.text.length}文字 → full=${fullText.length}文字）`)
          }
        } catch (e) {
          log(`      → 完全テキスト取得失敗、search結果を使用: ${e}`)
        }

        messages.push({
          timestamp: matchTs || '',
          channelId,
          channelName,
          text: `スレッド返信: ${fullText}`,
          threadTs: permalinkThreadTs,
          permalink: (match.permalink as string | undefined) ?? undefined
        })
        count++
        log(`      → 追加: スレッド返信 thread_ts=${permalinkThreadTs}`)
      }

      if (!paging || paging.page >= paging.pages) break
      page++
    }
    log(`  [Phase2] 完了: スレッド返信 ${messages.length}件追加`)
  } catch (e) {
    log(`  [Phase2] エラー（search:readスコープ未付与の可能性）: ${e}`)
  }
  return messages
}

export async function fetchSlackMessages(
  config: SlackProjectConfig,
  dateRange: DateRange,
  token: string,
  log: (line: string) => void = () => {}
): Promise<NonNullable<CollectedData['slack']>> {
  const client = new WebClient(token)

  // auth.test でユーザー確認
  const auth = await client.auth.test()
  const myUserId = auth.user_id ?? ''
  // team URL 例: "https://myworkspace.slack.com/" → メッセージリンク生成に使用
  const teamUrl = (auth.url as string | undefined) ?? ''
  log(`  auth.test: user_id=${myUserId} user=${auth.user} team=${auth.team} url=${teamUrl}`)

  const startDate = parseDateAsLocalMidnight(dateRange.start)
  const startTs = (startDate.getTime() / 1000).toString()
  const endDate = parseDateAsLocalMidnight(dateRange.end)
  endDate.setHours(23, 59, 59, 999)
  const endTs = (endDate.getTime() / 1000).toString()
  log(`  期間: ${dateRange.start} (ts=${startTs}) 〜 ${dateRange.end} (ts=${endTs})`)

  const channelMap = await fetchChannelMap(client, log)
  const allMessages: SlackMessages = []

  for (const channelId of config.channelIds) {
    const channelName = channelMap.get(channelId) || channelId
    log(`\n  ── チャンネル: ${channelName} (${channelId}) ──`)

    const phase1 = await fetchHistoryMessages(client, channelId, channelName, myUserId, teamUrl, startTs, endTs, log)
    allMessages.push(...phase1)

    const phase2 = await fetchSearchReplies(client, channelId, channelName, myUserId, startTs, endTs, dateRange, allMessages.length, log)
    allMessages.push(...phase2)
  }

  // 重複除去
  const seen = new Set<string>()
  const deduped = allMessages.filter((m) => {
    if (seen.has(m.timestamp)) return false
    seen.add(m.timestamp)
    return true
  })
  deduped.sort((a, b) => parseFloat(a.timestamp) - parseFloat(b.timestamp))

  log(`\n  合計: ${deduped.length}件（重複除去後）`)
  return { messages: deduped, fetchedAt: new Date().toISOString() }
}
