export const APP_NAME = '日報ジェネレーター'
export const APP_VERSION = '1.0.2'

export const SLACK_CLIENT_ID = '379997451684.10778849087878'

export const PROJECT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#6B7280'  // gray
]

export const CLAUDE_MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (推奨)' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6 (高品質)' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (高速)' }
]

export const DEFAULT_EMAIL_SUBJECT_DAILY = '【作業報告】 {{date}} ○○'
export const DEFAULT_EMAIL_SUBJECT_WEEKLY = '【週報】 {{week_range}} ○○'
export const DEFAULT_EMAIL_SUBJECT_MONTHLY = '【月報】 {{month}} ○○'

export const DEFAULT_PREAMBLE = 'お疲れ様です。○○です。\n{{date}} の作業報告になります。'
export const DEFAULT_PREAMBLE_WEEKLY = 'お疲れ様です。○○です。\n{{week_range}} の作業報告になります。'
export const DEFAULT_PREAMBLE_MONTHLY = 'お疲れ様です。○○です。\n{{month}} の作業報告になります。'
export const DEFAULT_POSTAMBLE = '以上、よろしくお願いいたします。'

export const DEFAULT_SYSTEM_PROMPT_DAILY =
  `あなたは日報作成アシスタントです。
提供された情報を元に、元のフォーマットを保ったまま「作業内容」欄を完成させてください。
リンク先から作業内容の文脈を補完し、箇条書きを活用して重複する内容はまとめてください。
ファイル名などをそのまま書かずに、Slackの会話やコミットコメントから推察できる内容を日本語の文章で記述してください。
出力された全文をテキストとして使用するので、余計な会話文などは含まないようにしてください。
また、Slackの会話記録は情報漏洩防止のため削除するようにしてください。`

export const DEFAULT_SYSTEM_PROMPT_WEEKLY =
  `あなたは週報作成アシスタントです。
提供された情報を元に、元のフォーマットを保ったまま「作業内容」欄を完成させてください。
リンク先から作業内容の文脈を補完し、箇条書きを活用して重複する内容はまとめてください。
ファイル名などをそのまま書かずに、Slackの会話やコミットコメントから推察できる内容を日本語の文章で記述してください。
出力された全文をテキストとして使用するので、余計な会話文などは含まないようにしてください。
また、Slackの会話記録は情報漏洩防止のため削除するようにしてください。`

export const DEFAULT_SYSTEM_PROMPT_MONTHLY =
  `あなたは月報作成アシスタントです。
提供された情報を元に、元のフォーマットを保ったまま「作業内容」欄を完成させてください。
リンク先から作業内容の文脈を補完し、箇条書きを活用して重複する内容はまとめてください。
ファイル名などをそのまま書かずに、Slackの会話やコミットコメントから推察できる内容を日本語の文章で記述してください。
出力された全文をテキストとして使用するので、余計な会話文などは含まないようにしてください。
また、Slackの会話記録は情報漏洩防止のため削除するようにしてください。`

export const GIT_MAX_COMMITS = 200
export const SVN_MAX_COMMITS = 200
export const PERFORCE_MAX_CHANGES = 200
export const REDMINE_MAX_ISSUES = 100
export const SLACK_MAX_MESSAGES = 500
export const FILE_MAX_ENTRIES = 5000
