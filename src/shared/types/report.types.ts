export interface DateRange {
  start: string // ISO8601
  end: string // ISO8601
}

export interface GitCommit {
  hash: string
  date: string
  author: string
  email: string
  message: string
  filesChanged: string[]
  repoUrl?: string
}

export interface SvnCommit {
  revision: number
  date: string
  author: string
  message: string
  paths: string[]
  repoUrl?: string
}

export interface SlackMessage {
  timestamp: string
  channelId: string
  channelName: string
  text: string
  threadTs?: string
  permalink?: string
}

export interface ChangedFile {
  path: string
  modifiedAt: string
  changeType: 'created' | 'modified' | 'deleted'
  sizeBytes: number
}

export interface CollectedData {
  projectId: string
  projectName: string
  dateRange: DateRange
  git?: {
    commits: GitCommit[]
    fetchedAt: string
    error?: string
    uncommittedFiles?: string[]
    untrackedFiles?: string[]
  }
  svn?: {
    commits: SvnCommit[]
    fetchedAt: string
    error?: string
    uncommittedFiles?: string[]
    untrackedFiles?: string[]
  }
  slack?: {
    messages: SlackMessage[]
    fetchedAt: string
    error?: string
  }
  files?: {
    changedFiles: ChangedFile[]
    fetchedAt: string
    error?: string
  }
}

export interface ReportSession {
  id: string
  type: 'daily' | 'weekly'
  dateRange: DateRange
  projectIds: string[]
  templateId: string
  collectedData: CollectedData[]
  rawText: string
  formattedText: string
  status: 'collecting' | 'formatting' | 'ready' | 'sent'
  createdAt: string
  sentAt?: string
}

export type CollectionProgress = {
  projectId: string
  projectName: string
  step: 'git' | 'svn' | 'slack' | 'files'
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped'
  message?: string
}
