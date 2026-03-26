import { ipcMain, dialog } from 'electron'
import type { IpcResult } from '@shared/types/ipc.types'
import type { DateRange, CollectedData } from '@shared/types/report.types'
import * as settingsStore from '../store/settings.store'
import { fetchChangedFiles } from '../services/file-watcher.service'

export function registerFileHandlers(): void {
  ipcMain.handle('file:browse', async (_, defaultPath?: string): Promise<IpcResult<string>> => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        defaultPath: defaultPath || undefined
      })
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'cancelled' }
      }
      return { success: true, data: result.filePaths[0] }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle(
    'file:fetch',
    async (_, projectId: string, dateRange: DateRange): Promise<IpcResult<CollectedData['files']>> => {
      try {
        const project = settingsStore.getProjectById(projectId)
        if (!project) return { success: false, error: 'Project not found' }
        if (!project.filePaths || project.filePaths.length === 0) {
          return { success: true, data: { changedFiles: [], fetchedAt: new Date().toISOString() } }
        }

        const result = await fetchChangedFiles(project.filePaths, dateRange)
        return { success: true, data: result }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )
}
