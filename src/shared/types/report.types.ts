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

export interface PerforceChangelist {
  change: number
  date: string    // ISO
  user: string
  client: string
  description: string
}

export interface CalendarEvent {
  id: string
  summary: string
  start: string    // ISO datetime (開始)
  end: string      // ISO datetime (終了)
  htmlLink: string // Google カレンダー上のリンク
  calendarId: string
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
  calendar?: {
    events: CalendarEvent[]
    fetchedAt: string
    error?: string
  }
  perforce?: {
    changelists: PerforceChangelist[]
    fetchedAt: string
    error?: string
  }
}

export interface ReportSession {
  id: string
  type: 'daily' | 'weekly' | 'monthly'
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

export interface AllocationResult {
  projectId: string
  projectName: string
  days: number  // 小数第1位まで（例: 10.5）
}

export type CollectionProgress = {
  projectId: string
  projectName: string
  step: 'git' | 'svn' | 'perforce' | 'slack' | 'files' | 'calendar'
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped'
  message?: string
}
