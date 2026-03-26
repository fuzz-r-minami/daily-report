import { ipcMain } from 'electron'
import type { IpcResult } from '@shared/types/ipc.types'
import type { DateRange, CollectedData } from '@shared/types/report.types'
import * as settingsStore from '../store/settings.store'
import { checkSvnInstall, testSvnConnection, fetchSvnCommits } from '../services/svn.service'

export function registerSvnHandlers(): void {
  ipcMain.handle('svn:checkInstall', async (): Promise<IpcResult<string>> => {
    try {
      const version = await checkSvnInstall()
      return { success: true, data: version }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle(
    'svn:test',
    async (_, repoUrl: string): Promise<IpcResult<string>> => {
      try {
        const result = await testSvnConnection(repoUrl)
        return { success: true, data: result }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )

  ipcMain.handle(
    'svn:fetch',
    async (_, projectId: string, dateRange: DateRange): Promise<IpcResult<CollectedData['svn']>> => {
      try {
        const project = settingsStore.getProjectById(projectId)
        const enabledRepos = (project?.svnRepos || []).filter((r) => r.enabled)
        if (enabledRepos.length === 0) {
          return { success: true, data: { commits: [], fetchedAt: new Date().toISOString() } }
        }
        const allCommits: NonNullable<CollectedData['svn']>['commits'] = []
        for (const repo of enabledRepos) {
          const result = await fetchSvnCommits(repo, dateRange)
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
