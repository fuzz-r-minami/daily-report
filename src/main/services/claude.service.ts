import { spawn } from 'child_process'
import type { Template } from '@shared/types/settings.types'

/** claude CLI に stdin でプロンプトを渡し、stdout を返す */
function runClaude(prompt: string, timeoutMs = 120_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', ['-p'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    })

    let output = ''
    let errorOutput = ''

    const timer = setTimeout(() => {
      proc.kill()
      reject(new Error(`タイムアウト (${timeoutMs / 1000}秒)`))
    }, timeoutMs)

    proc.stdout.on('data', (data: Buffer) => { output += data.toString() })
    proc.stderr.on('data', (data: Buffer) => { errorOutput += data.toString() })
    proc.on('error', (err) => { clearTimeout(timer); reject(err) })
    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(output.trim())
      else reject(new Error(errorOutput.trim() || `claude が終了コード ${code} で終了しました`))
    })

    proc.stdin.write(prompt, 'utf8')
    proc.stdin.end()
  })
}

export async function testClaudeConnection(_apiKey: string): Promise<string> {
  const result = await runClaude('「接続テスト成功」とだけ返してください。', 30_000)
  return `接続成功: ${result.substring(0, 80)}`
}

export async function formatWithClaude(
  rawText: string,
  template: Template,
  _apiKey: string,
  _model: string,
  _maxTokens: number
): Promise<string> {
  const prompt =
    `${template.systemPrompt}\n\n` +
    `以下の収集データを元に日報を整形してください。\n\n` +
    `# 収集データ\n${rawText}`
  return runClaude(prompt)
}
