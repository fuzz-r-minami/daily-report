import { ipcMain } from 'electron'
import type { IpcResult } from '@shared/types/ipc.types'
import type { DateRange, CollectedData } from '@shared/types/report.types'
import * as settingsStore from '../store/settings.store'
import * as credentialsStore from '../store/credentials.store'
import { testJiraConnection, fetchJiraIssues } from '../services/jira.service'

export function registerJiraHandlers(): void {
  ipcMain.handle(
    'jira:test',
    async (
      _,
      baseUrl: string,
      email: string,
      credentialKey: string,
      isServer?: boolean
    ): Promise<IpcResult<string>> => {
      try {
        const apiToken = await credentialsStore.getCredential(credentialKey)
        if (!apiToken) return { success: false, error: 'API token is not set' }
        const result = await testJiraConnection(baseUrl, email, apiToken, isServer)
        return { success: true, data: result }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'jira:fetch',
    async (_, projectId: string, dateRange: DateRange): Promise<IpcResult<CollectedData['jira']>> => {
      try {
        const project = settingsStore.getProjectById(projectId)
        const enabledConfigs = (project?.jiraConfigs || []).filter((c) => c.enabled)
        if (enabledConfigs.length === 0) {
          return { success: true, data: { issues: [], fetchedAt: new Date().toISOString() } }
        }
        const allIssues: NonNullable<CollectedData['jira']>['issues'] = []
        for (const config of enabledConfigs) {
          const apiToken = config.credentialKey
            ? await credentialsStore.getCredential(config.credentialKey)
            : null
          if (!apiToken) continue
          const result = await fetchJiraIssues(config, dateRange, apiToken, () => {})
          allIssues.push(...result.issues)
        }
        allIssues.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        return { success: true, data: { issues: allIssues, fetchedAt: new Date().toISOString() } }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )
}
