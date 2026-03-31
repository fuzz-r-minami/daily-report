import { ipcMain } from 'electron'
import type { IpcResult } from '@shared/types/ipc.types'
import type { DateRange, CollectedData } from '@shared/types/report.types'
import * as settingsStore from '../store/settings.store'
import * as credentialsStore from '../store/credentials.store'
import { testConfluenceConnection, fetchConfluencePages } from '../services/confluence.service'

export function registerConfluenceHandlers(): void {
  ipcMain.handle(
    'confluence:test',
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
        const result = await testConfluenceConnection(baseUrl, email, apiToken, isServer)
        return { success: true, data: result }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'confluence:fetch',
    async (_, projectId: string, dateRange: DateRange): Promise<IpcResult<CollectedData['confluence']>> => {
      try {
        const project = settingsStore.getProjectById(projectId)
        const enabledConfigs = (project?.confluenceConfigs || []).filter((c) => c.enabled)
        if (enabledConfigs.length === 0) {
          return { success: true, data: { pages: [], fetchedAt: new Date().toISOString() } }
        }
        const allPages: NonNullable<CollectedData['confluence']>['pages'] = []
        for (const config of enabledConfigs) {
          const apiToken = config.credentialKey
            ? await credentialsStore.getCredential(config.credentialKey)
            : null
          if (!apiToken) continue
          const result = await fetchConfluencePages(config, dateRange, apiToken, () => {})
          allPages.push(...result.pages)
        }
        allPages.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        return { success: true, data: { pages: allPages, fetchedAt: new Date().toISOString() } }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )
}
