import {
  DEFAULT_SYSTEM_PROMPT_DAILY,
  DEFAULT_SYSTEM_PROMPT_WEEKLY,
  DEFAULT_SYSTEM_PROMPT_MONTHLY,
  DEFAULT_EMAIL_SUBJECT_DAILY,
  DEFAULT_EMAIL_SUBJECT_WEEKLY,
  DEFAULT_EMAIL_SUBJECT_MONTHLY,
  DEFAULT_PREAMBLE,
  DEFAULT_PREAMBLE_WEEKLY,
  DEFAULT_PREAMBLE_MONTHLY,
  DEFAULT_POSTAMBLE,
  APP_VERSION
} from '../constants'

export interface AppSettings {
  version: string
  general: GeneralSettings
  projects: Project[]
  templates: Template[]
  claude: ClaudeSettings
  googleCalendar?: GoogleCalendarSettings
  slackWorkspaces?: SlackWorkspace[]
}

export type AppLanguage = 'ja' | 'en' | 'zh-CN' | 'zh-TW' | 'ko'

export interface GeneralSettings {
  dataDir: string
  logRetentionDays: number
  defaultReportType: 'daily' | 'weekly' | 'monthly'
  language?: AppLanguage
}

export interface Project {
  id: string
  name: string
  enabled: boolean
  color: string
  gitRepos?: GitProjectConfig[]
  svnRepos?: SvnProjectConfig[]
  perforceRepos?: PerforceProjectConfig[]
  redmineConfigs?: RedmineProjectConfig[]
  slack?: SlackProjectConfig
  googleCalendar?: GoogleCalendarProjectConfig
  filePaths?: FilePathConfig[]
  createdAt: string
  updatedAt: string
}

export interface GitProjectConfig {
  id: string
  enabled: boolean
  localPath: string    // ローカル作業ディレクトリ
  repoUrl: string      // リモートURL（HTTPS認証時のトークン注入用、任意）
  branch: string
  useSSH: boolean
  credentialKey: string
}

export interface SvnProjectConfig {
  id: string
  enabled: boolean
  localPath: string    // ローカル作業コピーパス（svn status 用）
  repoUrl: string      // SVNリポジトリURL（svn log 用）
  username?: string    // コミットの絞り込み用（認証は行わない）
}

export interface PerforceProjectConfig {
  id: string
  enabled: boolean
  port: string         // P4PORT 例: perforce:1666
  username: string     // P4USER
  depotPath: string    // デポパス 例: //depot/myproject/...
  credentialKey: string  // P4PASSWD / チケット（keytar）
}

export interface RedmineProjectConfig {
  id: string
  enabled: boolean
  baseUrl: string       // 例: https://redmine.example.com
  projectId?: string    // Redmineプロジェクト識別子（空=全プロジェクト）
  username?: string     // Basic認証ユーザー名
  credentialKey: string // APIアクセスキー（keytar）
  basicAuthPasswordKey?: string // Basic認証パスワード（keytar、任意）
}

export interface SlackWorkspace {
  workspaceId: string
  workspaceName: string
  credentialKey: string  // "slack-token-{workspaceId}"
}

export interface SlackProjectConfig {
  enabled: boolean
  workspaceId: string
  channelIds: string[]
}

export interface FilePathConfig {
  path: string
  recursive: boolean
  excludePatterns: string[]
  includePatterns: string[]
}

export interface Template {
  id: string
  name: string
  type: 'daily' | 'weekly' | 'monthly'
  isDefault: boolean
  preamble: string
  postamble: string
  systemPrompt: string
  emailSubjectTemplate: string
  emailTo: string[]
  createdAt: string
  updatedAt: string
}

export interface ClaudeSettings {
  enabled: boolean
  model: string
  maxTokens: number
  credentialKey: string
}

export interface GoogleCalendarSettings {
  clientId: string
  clientSecret: string
  credentialKey: string  // refresh token の keytar キー
}

export interface GoogleCalendarProjectConfig {
  enabled: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  version: APP_VERSION,
  general: {
    dataDir: '',
    logRetentionDays: 30,
    defaultReportType: 'daily',
  },
  projects: [],
  templates: [
    {
      id: 'default-daily',
      name: 'Default Daily Template',
      type: 'daily',
      isDefault: true,
      preamble: DEFAULT_PREAMBLE,
      postamble: DEFAULT_POSTAMBLE,
      systemPrompt: DEFAULT_SYSTEM_PROMPT_DAILY,
      emailSubjectTemplate: DEFAULT_EMAIL_SUBJECT_DAILY,
      emailTo: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'default-weekly',
      name: 'Default Weekly Template',
      type: 'weekly',
      isDefault: true,
      preamble: DEFAULT_PREAMBLE_WEEKLY,
      postamble: DEFAULT_POSTAMBLE,
      systemPrompt: DEFAULT_SYSTEM_PROMPT_WEEKLY,
      emailSubjectTemplate: DEFAULT_EMAIL_SUBJECT_WEEKLY,
      emailTo: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'default-monthly',
      name: 'Default Monthly Tempalte',
      type: 'monthly',
      isDefault: true,
      preamble: DEFAULT_PREAMBLE_MONTHLY,
      postamble: DEFAULT_POSTAMBLE,
      systemPrompt: DEFAULT_SYSTEM_PROMPT_MONTHLY,
      emailSubjectTemplate: DEFAULT_EMAIL_SUBJECT_MONTHLY,
      emailTo: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  claude: {
    enabled: false,
    model: 'claude-sonnet-4-6',
    maxTokens: 4096,
    credentialKey: 'claude-api-key'
  }
}
