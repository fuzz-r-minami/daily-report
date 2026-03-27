import { ipcMain } from 'electron'
import type { IpcResult } from '@shared/types/ipc.types'
import type { DateRange, CollectedData } from '@shared/types/report.types'
import * as settingsStore from '../store/settings.store'
import * as credentialsStore from '../store/credentials.store'
import { checkP4Install, testP4Connection, fetchP4Changes } from '../services/perforce.service'

export function registerPerforceHandlers(): void {
  ipcMain.handle('p4:checkInstall', async (): Promise<IpcResult<string>> => {
    try {
      const version = await checkP4Install()
      return { success: true, data: version }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle(
    'p4:test',
    async (_, port: string, username: string, credentialKey: string): Promise<IpcResult<string>> => {
      try {
        const password = credentialKey ? (await credentialsStore.getCredential(credentialKey)) ?? '' : ''
        const result = await testP4Connection(port, username, password, (line) => console.log(line))
        return { success: true, data: result }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'p4:fetch',
    async (_, projectId: string, dateRange: DateRange): Promise<IpcResult<CollectedData['perforce']>> => {
      try {
        const project = settingsStore.getProjectById(projectId)
        const enabledRepos = (project?.perforceRepos || []).filter((r) => r.enabled)
        if (enabledRepos.length === 0) {
          return { success: true, data: { changelists: [], fetchedAt: new Date().toISOString() } }
        }
        const allChangelists: NonNullable<CollectedData['perforce']>['changelists'] = []
        for (const repo of enabledRepos) {
          const password = repo.credentialKey
            ? (await credentialsStore.getCredential(repo.credentialKey)) ?? ''
            : ''
          const result = await fetchP4Changes(repo, dateRange, password)
          allChangelists.push(...result.changelists)
        }
        allChangelists.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        return { success: true, data: { changelists: allChangelists, fetchedAt: new Date().toISOString() } }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )
}
