import type { CollectedData, AllocationResult } from '@shared/types/report.types'

/** Date オブジェクトをローカル日付文字列 (YYYY-MM-DD) に変換 */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * カレンダーイベントの開始日時文字列をローカル日付文字列に変換。
 * 終日イベントは 'YYYY-MM-DD' 形式なのでそのまま使う。
 */
function eventToDateStr(start: string): string {
  if (start.length === 10) return start   // 終日イベント
  return toLocalDateStr(new Date(start))
}

/**
 * 収集データから月次作業按分を計算する。
 *
 * - Git / SVN / Slack / Google Calendar のアクションがあった日を「稼働日」とみなす
 * - ある日に N プロジェクトが稼働していた場合、各プロジェクトに 1/N を加算
 * - ファイル監視は対象外
 */
export function computeAllocation(collectedData: CollectedData[]): AllocationResult[] {
  // projectId → その月に活動があった日付の集合
  const activeDatesByProject = new Map<string, Set<string>>()

  for (const data of collectedData) {
    const dates = new Set<string>()

    for (const c of data.git?.commits ?? []) {
      dates.add(toLocalDateStr(new Date(c.date)))
    }
    for (const c of data.svn?.commits ?? []) {
      dates.add(toLocalDateStr(new Date(c.date)))
    }
    for (const cl of data.perforce?.changelists ?? []) {
      dates.add(toLocalDateStr(new Date(cl.date)))
    }
    for (const m of data.slack?.messages ?? []) {
      dates.add(toLocalDateStr(new Date(parseFloat(m.timestamp) * 1000)))
    }
    for (const e of data.calendar?.events ?? []) {
      dates.add(eventToDateStr(e.start))
    }

    activeDatesByProject.set(data.projectId, dates)
  }

  // 全プロジェクトにまたがる全稼働日を列挙
  const allDates = new Set<string>()
  for (const dates of activeDatesByProject.values()) {
    for (const d of dates) allDates.add(d)
  }

  // 日ごとに稼働プロジェクトを数え、1/N ずつ加算
  const totalByProject = new Map<string, number>(
    collectedData.map((d) => [d.projectId, 0])
  )

  for (const date of allDates) {
    const activeIds = collectedData
      .map((d) => d.projectId)
      .filter((id) => activeDatesByProject.get(id)?.has(date))
    if (activeIds.length === 0) continue
    const share = 1 / activeIds.length
    for (const id of activeIds) {
      totalByProject.set(id, (totalByProject.get(id) ?? 0) + share)
    }
  }

  return collectedData.map((data) => {
    const raw = totalByProject.get(data.projectId) ?? 0
    // 小数第1位に丸める
    const days = Math.round(raw * 10) / 10
    return { projectId: data.projectId, projectName: data.projectName, days }
  })
}
