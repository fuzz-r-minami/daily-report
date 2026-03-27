import { spawn, execFile } from 'child_process'
import { promisify } from 'util'
import type { PerforceProjectConfig } from '@shared/types/settings.types'
import type { DateRange, CollectedData, PerforceChangelist } from '@shared/types/report.types'
import { PERFORCE_MAX_CHANGES } from '@shared/constants'

const execFileAsync = promisify(execFile)

/**
 * p4 コマンドを実行し、終了コードに関わらず stdout/stderr を常にキャプチャして返す。
 * exit code != 0 の場合は Error を throw するが、stdout/stderr は必ずログに渡す。
 */
function runP4(
  args: string[],
  env: Record<string, string>,
  log: (line: string) => void
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('p4', args, {
      env: { ...process.env, ...env },
      windowsHide: true
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

    proc.on('error', (err) => {
      // p4 が見つからない等のOS レベルエラー
      log(`[error] ${err.message}`)
      reject(err)
    })

    proc.on('close', (code) => {
      if (stdout) log(`[stdout]\n${stdout.trimEnd()}`)
      if (stderr) log(`[stderr]\n${stderr.trimEnd()}`)
      log(`[exit code] ${code}`)
      if (code !== 0) {
        reject(Object.assign(new Error(`p4 exited with code ${code}\n${stderr || stdout}`), { stdout, stderr, code }))
      } else {
        resolve({ stdout, stderr })
      }
    })
  })
}

export async function checkP4Install(): Promise<string> {
  const { stdout } = await execFileAsync('p4', ['-V'])
  const match = stdout.match(/Rev\.\s+P4\/.*\/(\S+)/)
  return match ? match[0] : stdout.split('\n')[0].trim()
}

export async function testP4Connection(
  port: string,
  username: string,
  password: string,
  log: (line: string) => void = () => {}
): Promise<string> {
  const env: Record<string, string> = { P4PORT: port, P4USER: username }
  if (password) env['P4PASSWD'] = password
  const globalArgs = ['-p', port, '-u', username]
  log(`[exec] p4 ${globalArgs.join(' ')} info  (P4PORT=${port} P4USER=${username})`)
  const { stdout } = await runP4([...globalArgs, 'info'], env, log)
  const server = stdout.match(/Server address:\s*(.+)/)?.[1]?.trim() || port
  const user = stdout.match(/User name:\s*(.+)/)?.[1]?.trim() || username
  return `接続成功: ${server} (ユーザー: ${user})`
}

/**
 * Perforce の submitted チェンジリストを取得する。
 *
 * p4 changes -u <user> -s submitted -l -t -m <max> //<depotPath>@<start>,@<end>
 */
export async function fetchP4Changes(
  config: PerforceProjectConfig,
  dateRange: DateRange,
  password: string,
  log: (line: string) => void = () => {}
): Promise<NonNullable<CollectedData['perforce']>> {
  const env: Record<string, string> = {
    P4PORT: config.port,
    P4USER: config.username
  }
  if (password) env['P4PASSWD'] = password

  // Perforce の日付指定は YYYY/MM/DD 形式、範囲は @date1,@date2 の両方に @ が必要
  // 終端は exclusive なので +1日する（例: 3/27 の作業を取るには @3/27,@3/28 が必要）
  const startDate = dateRange.start.substring(0, 10).replace(/-/g, '/')
  const endDateExclusive = new Date(dateRange.end.substring(0, 10))
  endDateExclusive.setDate(endDateExclusive.getDate() + 1)
  const endDate = endDateExclusive.toISOString().substring(0, 10).replace(/-/g, '/')

  const depotBase = config.depotPath.endsWith('...') ? config.depotPath : `${config.depotPath.replace(/\/$/, '')}/...`
  const depotSpec = `${depotBase}@${startDate},@${endDate}`

  const globalArgs = ['-p', config.port, '-u', config.username]
  const args = [
    ...globalArgs,
    'changes',
    '-u', config.username,
    '-s', 'submitted',
    '-l', '-t',
    '-m', String(PERFORCE_MAX_CHANGES),
    depotSpec
  ]

  log(`[exec] p4 ${args.join(' ')}`)

  const { stdout } = await runP4(args, env, log)

  const changelists = parseP4Changes(stdout)
  log(`→ ${changelists.length}件取得`)

  return { changelists, fetchedAt: new Date().toISOString() }
}

/**
 * `p4 changes -l -t` の出力を PerforceChangelist[] にパースする。
 *
 * 出力フォーマット:
 * Change 12345 on 2024/01/15 15:30:00 by user@client *submitted*
 *
 *   Description line 1
 *   Description line 2
 *
 * Change 12346 on ...
 */
function parseP4Changes(output: string): PerforceChangelist[] {
  const results: PerforceChangelist[] = []
  const blocks = output.split(/(?=^Change \d+ on )/m)

  for (const block of blocks) {
    const headerMatch = block.match(
      /^Change (\d+) on (\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) by (\S+)@(\S+)/
    )
    if (!headerMatch) continue

    const change = parseInt(headerMatch[1], 10)
    // 2024/01/15 15:30:00 → ISO
    const dateRaw = headerMatch[2].replace(/\//g, '-').replace(' ', 'T')
    const date = new Date(dateRaw).toISOString()
    const user = headerMatch[3]
    const client = headerMatch[4].replace(/\s.*/, '') // strip *submitted* etc

    // ヘッダー行以降の説明文（タブ/スペースインデントされた行）
    const descLines = block
      .split('\n')
      .slice(1)
      .map((l) => l.replace(/^\t/, '').trimEnd())
      .filter(Boolean)
    const description = descLines.join('\n').trim()

    results.push({ change, date, user, client, description })
  }

  return results
}
