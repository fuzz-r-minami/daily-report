import { ipcMain } from 'electron'
import type { IpcResult } from '@shared/types/ipc.types'
import type { DateRange, CollectedData } from '@shared/types/report.types'
import type { SlackWorkspace } from '@shared/types/settings.types'
import * as settingsStore from '../store/settings.store'
import * as credentialsStore from '../store/credentials.store'
import { testSlackConnection, fetchSlackChannels, fetchSlackMessages, startSlackOAuth, getWorkspaceInfo } from '../services/slack.service'

export function registerSlackHandlers(): void {
  ipcMain.handle('slack:startAuth', async (): Promise<IpcResult<SlackWorkspace>> => {
    try {
      const token = await startSlackOAuth('global')
      const { workspaceId, workspaceName } = await getWorkspaceInfo(token)
      const credKey = `slack-token-${workspaceId}`
      await credentialsStore.setCredential(credKey, token)

      // settings.slackWorkspaces を更新（既存エントリは上書き）
      const settings = settingsStore.getSettings()
      const existing = settings.slackWorkspaces ?? []
      const updated = existing.filter((w) => w.workspaceId !== workspaceId)
      const workspace: SlackWorkspace = { workspaceId, workspaceName, credentialKey: credKey }
      settingsStore.saveSettings({ ...settings, slackWorkspaces: [...updated, workspace] })

      return { success: true, data: workspace }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('slack:deleteWorkspace', async (_, workspaceId: string): Promise<IpcResult<void>> => {
    try {
      const settings = settingsStore.getSettings()
      const workspace = (settings.slackWorkspaces ?? []).find((w) => w.workspaceId === workspaceId)
      if (workspace) {
        await credentialsStore.deleteCredential(workspace.credentialKey)
      }
      const updated = (settings.slackWorkspaces ?? []).filter((w) => w.workspaceId !== workspaceId)
      settingsStore.saveSettings({ ...settings, slackWorkspaces: updated })
      return { success: true, data: undefined }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

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
        const settings = settingsStore.getSettings()
        const workspace = (settings.slackWorkspaces ?? []).find(
          (w) => w.workspaceId === project.slack!.workspaceId
        )
        if (!workspace) return { success: false, error: 'ワークスペースが設定されていません' }
        const token = await credentialsStore.getCredential(workspace.credentialKey)
        if (!token) return { success: false, error: 'Slack トークンが設定されていません' }
        const result = await fetchSlackMessages(project.slack, dateRange, token)
        return { success: true, data: result }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )
}
