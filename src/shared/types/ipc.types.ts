import type { AppSettings, Project, Template, ClaudeSettings } from './settings.types'
import type { CollectedData, DateRange, ReportSession, CollectionProgress } from './report.types'

export type IpcResult<T> = { success: true; data: T } | { success: false; error: string }

// Settings
export interface IpcSettingsApi {
  'settings:get': () => Promise<IpcResult<AppSettings>>
  'settings:save': (settings: AppSettings) => Promise<IpcResult<void>>
  'settings:getDataDir': () => Promise<IpcResult<string>>
  'settings:openDataDir': () => Promise<IpcResult<void>>
}

// Projects
export interface IpcProjectApi {
  'project:create': (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<IpcResult<Project>>
  'project:update': (project: Project) => Promise<IpcResult<Project>>
  'project:delete': (id: string) => Promise<IpcResult<void>>
  'project:list': () => Promise<IpcResult<Project[]>>
}

// Templates
export interface IpcTemplateApi {
  'template:create': (template: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>) => Promise<IpcResult<Template>>
  'template:update': (template: Template) => Promise<IpcResult<Template>>
  'template:delete': (id: string) => Promise<IpcResult<void>>
  'template:list': () => Promise<IpcResult<Template[]>>
}

// Credentials
export interface IpcCredentialApi {
  'credential:set': (key: string, value: string) => Promise<IpcResult<void>>
  'credential:get': (key: string) => Promise<IpcResult<string | null>>
  'credential:delete': (key: string) => Promise<IpcResult<void>>
}

// Git
export interface IpcGitApi {
  'git:test': (repoPath: string, credentialKey?: string) => Promise<IpcResult<string>>
  'git:fetch': (projectId: string, dateRange: DateRange) => Promise<IpcResult<CollectedData['git']>>
}

// SVN
export interface IpcSvnApi {
  'svn:checkInstall': () => Promise<IpcResult<string>>
  'svn:test': (repoUrl: string) => Promise<IpcResult<string>>
  'svn:fetch': (projectId: string, dateRange: DateRange) => Promise<IpcResult<CollectedData['svn']>>
}

// Slack
export interface IpcSlackApi {
  'slack:test': (credentialKey: string) => Promise<IpcResult<string>>
  'slack:fetchChannels': (credentialKey: string) => Promise<IpcResult<{ id: string; name: string }[]>>
  'slack:fetch': (projectId: string, dateRange: DateRange) => Promise<IpcResult<CollectedData['slack']>>
}

// Files
export interface IpcFileApi {
  'file:browse': (defaultPath?: string) => Promise<IpcResult<string>>
  'file:fetch': (projectId: string, dateRange: DateRange) => Promise<IpcResult<CollectedData['files']>>
}

// Claude
export interface IpcClaudeApi {
  'claude:test': (credentialKey: string) => Promise<IpcResult<string>>
  'claude:format': (rawText: string, templateId: string) => Promise<IpcResult<string>>
}

// Mail (mailto: で既定メーラーを開く)
export interface IpcMailApi {
  'mail:open': (to: string[], subject: string, body: string) => Promise<IpcResult<void>>
}

// Report
export interface IpcReportApi {
  'report:generate': (
    projectIds: string[],
    dateRange: DateRange,
    type: 'daily' | 'weekly' | 'monthly',
    templateId: string
  ) => Promise<IpcResult<ReportSession>>
  'report:save': (text: string, filename: string) => Promise<IpcResult<string>>
}

// IPC Events (main → renderer)
export interface IpcEvents {
  'report:progress': CollectionProgress
}
