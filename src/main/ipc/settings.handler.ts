import { ipcMain, app, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import * as settingsStore from '../store/settings.store'
import * as credentialsStore from '../store/credentials.store'
import type { IpcResult } from '@shared/types/ipc.types'
import type { AppSettings } from '@shared/types/settings.types'

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', async (): Promise<IpcResult<AppSettings>> => {
    try {
      const settings = settingsStore.getSettings()
      // Ensure dataDir has a default
      if (!settings.general.dataDir) {
        settings.general.dataDir = path.join(app.getPath('documents'), 'daily-report')
      }
      return { success: true, data: settings }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('settings:save', async (_, settings: AppSettings): Promise<IpcResult<void>> => {
    try {
      settingsStore.saveSettings(settings)
      return { success: true, data: undefined }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('settings:getDataDir', async (): Promise<IpcResult<string>> => {
    try {
      let dir = settingsStore.getDataDir()
      if (!dir) {
        dir = path.join(app.getPath('documents'), 'daily-report')
      }
      return { success: true, data: dir }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('settings:openDataDir', async (): Promise<IpcResult<void>> => {
    try {
      let dir = settingsStore.getDataDir()
      if (!dir) {
        dir = path.join(app.getPath('documents'), 'daily-report')
      }
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      await shell.openPath(dir)
      return { success: true, data: undefined }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // Projects
  ipcMain.handle('project:list', async (): Promise<IpcResult<ReturnType<typeof settingsStore.getProjects>>> => {
    try {
      return { success: true, data: settingsStore.getProjects() }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('project:create', async (_, data): Promise<IpcResult<ReturnType<typeof settingsStore.createProject>>> => {
    try {
      return { success: true, data: settingsStore.createProject(data) }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('project:update', async (_, project): Promise<IpcResult<ReturnType<typeof settingsStore.updateProject>>> => {
    try {
      return { success: true, data: settingsStore.updateProject(project) }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('project:delete', async (_, id: string): Promise<IpcResult<void>> => {
    try {
      settingsStore.deleteProject(id)
      return { success: true, data: undefined }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // Templates
  ipcMain.handle('template:list', async (): Promise<IpcResult<ReturnType<typeof settingsStore.getTemplates>>> => {
    try {
      return { success: true, data: settingsStore.getTemplates() }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('template:create', async (_, data): Promise<IpcResult<ReturnType<typeof settingsStore.createTemplate>>> => {
    try {
      return { success: true, data: settingsStore.createTemplate(data) }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('template:update', async (_, template): Promise<IpcResult<ReturnType<typeof settingsStore.updateTemplate>>> => {
    try {
      return { success: true, data: settingsStore.updateTemplate(template) }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('template:delete', async (_, id: string): Promise<IpcResult<void>> => {
    try {
      settingsStore.deleteTemplate(id)
      return { success: true, data: undefined }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // Credentials
  ipcMain.handle('credential:set', async (_, key: string, value: string): Promise<IpcResult<void>> => {
    try {
      await credentialsStore.setCredential(key, value)
      return { success: true, data: undefined }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('credential:get', async (_, key: string): Promise<IpcResult<string | null>> => {
    try {
      const value = await credentialsStore.getCredential(key)
      return { success: true, data: value }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('credential:delete', async (_, key: string): Promise<IpcResult<void>> => {
    try {
      await credentialsStore.deleteCredential(key)
      return { success: true, data: undefined }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })
}
