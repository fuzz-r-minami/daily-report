import { ipcMain } from 'electron'
import type { IpcResult } from '@shared/types/ipc.types'
import type { DateRange, CollectedData } from '@shared/types/report.types'
import * as settingsStore from '../store/settings.store'
import * as credentialsStore from '../store/credentials.store'
import { testRedmineConnection, fetchRedmineIssues } from '../services/redmine.service'

export function registerRedmineHandlers(): void {
  ipcMain.handle(
    'redmine:test',
    async (
      _,
      baseUrl: string,
      credentialKey: string,
      username?: string,
      basicAuthPasswordKey?: string
    ): Promise<IpcResult<string>> => {
      try {
        const apiKey = await credentialsStore.getCredential(credentialKey)
        if (!apiKey) return { success: false, error: 'APIアクセスキーが設定されていません' }
        const basicPassword = basicAuthPasswordKey
          ? (await credentialsStore.getCredential(basicAuthPasswordKey)) ?? undefined
          : undefined
        const result = await testRedmineConnection(baseUrl, apiKey, username, basicPassword)
        return { success: true, data: result }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'redmine:fetch',
    async (_, projectId: string, dateRange: DateRange): Promise<IpcResult<CollectedData['redmine']>> => {
      try {
        const project = settingsStore.getProjectById(projectId)
        const enabledConfigs = (project?.redmineConfigs || []).filter((c) => c.enabled)
        if (enabledConfigs.length === 0) {
          return { success: true, data: { issues: [], fetchedAt: new Date().toISOString() } }
        }
        const allIssues: NonNullable<CollectedData['redmine']>['issues'] = []
        for (const config of enabledConfigs) {
          const apiKey = config.credentialKey
            ? await credentialsStore.getCredential(config.credentialKey)
            : null
          if (!apiKey) continue
          const basicPassword = config.basicAuthPasswordKey
            ? (await credentialsStore.getCredential(config.basicAuthPasswordKey)) ?? undefined
            : undefined
          const result = await fetchRedmineIssues(config, dateRange, apiKey, () => {}, basicPassword)
          allIssues.push(...result.issues)
        }
        allIssues.sort((a, b) => new Date(b.updatedOn).getTime() - new Date(a.updatedOn).getTime())
        return { success: true, data: { issues: allIssues, fetchedAt: new Date().toISOString() } }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )
}
