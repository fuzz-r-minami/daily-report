import { ipcMain } from 'electron'
import type { IpcResult } from '@shared/types/ipc.types'
import * as settingsStore from '../store/settings.store'
import { testClaudeConnection, formatWithClaude } from '../services/claude.service'

export function registerClaudeHandlers(): void {
  ipcMain.handle('claude:test', async (): Promise<IpcResult<string>> => {
    try {
      const result = await testClaudeConnection()
      return { success: true, data: result }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle(
    'claude:format',
    async (_, rawText: string, templateId: string): Promise<IpcResult<string>> => {
      try {
        const settings = settingsStore.getSettings()
        if (!settings.claude.enabled) {
          return { success: false, error: 'Claude連携が有効になっていません' }
        }

        const template = settingsStore.getTemplates().find((t) => t.id === templateId)
        if (!template) return { success: false, error: 'テンプレートが見つかりません' }

        const result = await formatWithClaude(rawText, template)
        return { success: true, data: result }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )
}
