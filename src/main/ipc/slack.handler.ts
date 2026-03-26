import { ipcMain } from 'electron'
import type { IpcResult } from '@shared/types/ipc.types'
import type { DateRange, CollectedData } from '@shared/types/report.types'
import * as settingsStore from '../store/settings.store'
import * as credentialsStore from '../store/credentials.store'
import { testSlackConnection, fetchSlackChannels, fetchSlackMessages } from '../services/slack.service'

export function registerSlackHandlers(): void {
  ipcMain.handle('slack:test', async (_, credentialKey: string): Promise<IpcResult<string>> => {
    try {
      const token = await credentialsStore.getCredential(credentialKey)
      if (!token) return { success: false, error: 'トークンが設定されていません' }
      const result = await testSlackConnection(token)
      return { success: true, data: result }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle(
    'slack:fetchChannels',
    async (_, credentialKey: string): Promise<IpcResult<{ id: string; name: string }[]>> => {
      try {
        const token = await credentialsStore.getCredential(credentialKey)
        if (!token) return { success: false, error: 'トークンが設定されていません' }
        const channels = await fetchSlackChannels(token)
        return { success: true, data: channels }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'slack:fetch',
    async (_, projectId: string, dateRange: DateRange): Promise<IpcResult<CollectedData['slack']>> => {
      try {
        const project = settingsStore.getProjectById(projectId)
        if (!project?.slack?.enabled) {
          return { success: true, data: { messages: [], fetchedAt: new Date().toISOString() } }
        }
        const token = await credentialsStore.getCredential(project.slack.credentialKey)
        if (!token) return { success: false, error: 'Slack トークンが設定されていません' }
        const result = await fetchSlackMessages(project.slack, dateRange, token)
        return { success: true, data: result }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )
}
