import { contextBridge, ipcRenderer } from 'electron'
import type { CollectionProgress } from '@shared/types/report.types'

const api = {
  // Settings
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsSave: (settings: unknown) => ipcRenderer.invoke('settings:save', settings),
  settingsGetDataDir: () => ipcRenderer.invoke('settings:getDataDir'),
  settingsOpenDataDir: () => ipcRenderer.invoke('settings:openDataDir'),

  // Projects
  projectList: () => ipcRenderer.invoke('project:list'),
  projectCreate: (data: unknown) => ipcRenderer.invoke('project:create', data),
  projectUpdate: (project: unknown) => ipcRenderer.invoke('project:update', project),
  projectDelete: (id: string) => ipcRenderer.invoke('project:delete', id),

  // Templates
  templateList: () => ipcRenderer.invoke('template:list'),
  templateCreate: (data: unknown) => ipcRenderer.invoke('template:create', data),
  templateUpdate: (template: unknown) => ipcRenderer.invoke('template:update', template),
  templateDelete: (id: string) => ipcRenderer.invoke('template:delete', id),

  // Credentials
  credentialSet: (key: string, value: string) => ipcRenderer.invoke('credential:set', key, value),
  credentialGet: (key: string) => ipcRenderer.invoke('credential:get', key),
  credentialDelete: (key: string) => ipcRenderer.invoke('credential:delete', key),

  // Git
  gitTest: (localPath: string, branch?: string) => ipcRenderer.invoke('git:test', localPath, branch),
  gitFetch: (projectId: string, dateRange: unknown) => ipcRenderer.invoke('git:fetch', projectId, dateRange),

  // SVN
  svnCheckInstall: () => ipcRenderer.invoke('svn:checkInstall'),
  svnTest: (repoUrl: string) =>
    ipcRenderer.invoke('svn:test', repoUrl),
  svnFetch: (projectId: string, dateRange: unknown) => ipcRenderer.invoke('svn:fetch', projectId, dateRange),

  // Slack
  slackTest: (credentialKey: string) => ipcRenderer.invoke('slack:test', credentialKey),
  slackFetchChannels: (credentialKey: string) => ipcRenderer.invoke('slack:fetchChannels', credentialKey),
  slackFetch: (projectId: string, dateRange: unknown) => ipcRenderer.invoke('slack:fetch', projectId, dateRange),

  // File
  fileBrowse: (defaultPath?: string) => ipcRenderer.invoke('file:browse', defaultPath),
  fileFetch: (projectId: string, dateRange: unknown) => ipcRenderer.invoke('file:fetch', projectId, dateRange),

  // Claude
  claudeTest: (credentialKey: string) => ipcRenderer.invoke('claude:test', credentialKey),
  claudeFormat: (rawText: string, templateId: string) => ipcRenderer.invoke('claude:format', rawText, templateId),

  // Mail
  mailOpen: (to: string[], subject: string, body: string) =>
    ipcRenderer.invoke('mail:open', to, subject, body),

  // Report
  reportGenerate: (
    projectIds: string[],
    dateRange: unknown,
    type: 'daily' | 'weekly',
    templateId: string
  ) => ipcRenderer.invoke('report:generate', projectIds, dateRange, type, templateId),
  reportSave: (text: string, filename: string) => ipcRenderer.invoke('report:save', text, filename),

  // Events
  onReportProgress: (callback: (progress: CollectionProgress) => void) => {
    ipcRenderer.on('report:progress', (_, progress) => callback(progress))
    return () => ipcRenderer.removeAllListeners('report:progress')
  },
  onReportLog: (callback: (line: string) => void) => {
    ipcRenderer.on('report:log', (_, line) => callback(line))
    return () => ipcRenderer.removeAllListeners('report:log')
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
