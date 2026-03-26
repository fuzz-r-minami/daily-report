/** "YYYY-MM-DD" をローカル時刻の深夜0時として Date に変換する */
export function parseDateAsLocalMidnight(dateStr: string): Date {
  const parts = dateStr.substring(0, 10).split('-').map(Number)
  return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0)
}

/** Date をローカルタイムゾーン付きの ISO 8601 文字列に変換する (例: 2026-03-26T00:00:00+09:00) */
export function toLocalISOString(date: Date): string {
  const off = -date.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const absOff = Math.abs(off)
  const pad2 = (n: number) => String(n).padStart(2, '0')
  const tz = `${sign}${pad2(Math.floor(absOff / 60))}:${pad2(absOff % 60)}`
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}` +
    tz
  )
}
