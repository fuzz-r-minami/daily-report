import { ipcMain } from 'electron'
import type { IpcResult } from '@shared/types/ipc.types'
import type { DateRange, CollectedData } from '@shared/types/report.types'
import * as settingsStore from '../store/settings.store'
import * as credentialsStore from '../store/credentials.store'
import { testGitConnection, fetchGitCommits } from '../services/git.service'

export function registerGitHandlers(): void {
  ipcMain.handle(
    'git:test',
    async (_, localPath: string, branch?: string): Promise<IpcResult<string>> => {
      try {
        const result = await testGitConnection(localPath, branch)
        return { success: true, data: result }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'git:fetch',
    async (_, projectId: string, dateRange: DateRange): Promise<IpcResult<CollectedData['git']>> => {
      try {
        const project = settingsStore.getProjectById(projectId)
        const enabledRepos = (project?.gitRepos || []).filter((r) => r.enabled)
        if (enabledRepos.length === 0) {
          return { success: true, data: { commits: [], fetchedAt: new Date().toISOString() } }
        }
        const allCommits: NonNullable<CollectedData['git']>['commits'] = []
        for (const repo of enabledRepos) {
          const token = repo.credentialKey ? await credentialsStore.getCredential(repo.credentialKey) : null
          const result = await fetchGitCommits(repo, dateRange, token)
          allCommits.push(...result.commits)
        }
        allCommits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        return { success: true, data: { commits: allCommits, fetchedAt: new Date().toISOString() } }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )
}
