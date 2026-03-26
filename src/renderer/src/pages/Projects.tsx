import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/app.store'
import { api } from '../lib/api'
import { PROJECT_COLORS } from '@shared/constants'

export function Projects(): JSX.Element {
  const navigate = useNavigate()
  const { projects, removeProject } = useAppStore()

  const handleDelete = async (id: string, name: string): Promise<void> => {
    if (!confirm(`プロジェクト「${name}」を削除しますか？`)) return
    const result = await api.projectDelete(id)
    if (result.success) {
      removeProject(id)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">プロジェクト管理</h2>
        <button
          onClick={() => navigate('/projects/new')}
          className="btn-primary"
        >
          + 新規追加
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="card text-center py-12 space-y-4">
          <div className="text-5xl">📁</div>
          <div>
            <p className="font-semibold text-foreground">ようこそ！まずプロジェクトを追加しましょう</p>
            <p className="text-sm text-muted-foreground mt-1">
              日報・週報を生成したいプロジェクトを追加してください。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto text-left text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <span>📦</span><span>Gitリポジトリのコミットログを取得</span>
            </div>
            <div className="flex items-start gap-2">
              <span>🔀</span><span>SVNコミットログを取得</span>
            </div>
            <div className="flex items-start gap-2">
              <span>💬</span><span>Slackの投稿を取得</span>
            </div>
            <div className="flex items-start gap-2">
              <span>📂</span><span>変更ファイルの一覧を取得</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/projects/new')}
            className="btn-primary mx-auto"
          >
            最初のプロジェクトを追加
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => {
            const integrations = [
              (p.gitRepos?.some((r) => r.enabled)) && 'Git',
              (p.svnRepos?.some((r) => r.enabled)) && 'SVN',
              p.slack?.enabled && 'Slack',
              (p.filePaths?.length ?? 0) > 0 && `ファイル監視 ${p.filePaths!.length}件`
            ].filter(Boolean) as string[]

            return (
              <div
                key={p.id}
                className="flex items-center gap-3 p-4 rounded-md border border-border bg-card hover:bg-accent/30 transition-colors"
              >
                <span
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: p.color || PROJECT_COLORS[0] }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {integrations.length > 0 ? integrations.join(' / ') : '連携なし'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="px-3 py-1 text-xs rounded border border-border hover:bg-accent"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(p.id, p.name)}
                    className="px-3 py-1 text-xs rounded border border-destructive text-destructive hover:bg-destructive/10"
                  >
                    削除
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
