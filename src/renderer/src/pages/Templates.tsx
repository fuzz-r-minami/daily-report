import { useState } from 'react'
import { useAppStore } from '../store/app.store'
import { api } from '../lib/api'
import type { Template } from '@shared/types/settings.types'
import {
  DEFAULT_SYSTEM_PROMPT_DAILY,
  DEFAULT_SYSTEM_PROMPT_WEEKLY,
  DEFAULT_EMAIL_SUBJECT_DAILY,
  DEFAULT_EMAIL_SUBJECT_WEEKLY
} from '@shared/constants'


export function Templates(): JSX.Element {
  const { templates, addTemplate, updateTemplate, removeTemplate } = useAppStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<Template>>({})
  const [saving, setSaving] = useState(false)
  const [showTypePicker, setShowTypePicker] = useState(false)

  const startEdit = (t: Template): void => {
    setEditingId(t.id)
    setForm({ ...t })
  }

  const startNew = (type: 'daily' | 'weekly'): void => {
    setShowTypePicker(false)
    setEditingId('new')
    setForm({
      name: '',
      type,
      isDefault: false,
      systemPrompt: type === 'daily' ? DEFAULT_SYSTEM_PROMPT_DAILY : DEFAULT_SYSTEM_PROMPT_WEEKLY,
      emailSubjectTemplate: type === 'daily' ? DEFAULT_EMAIL_SUBJECT_DAILY : DEFAULT_EMAIL_SUBJECT_WEEKLY,
      emailTo: []
    })
  }

  const handleSave = async (): Promise<void> => {
    if (!form.name?.trim()) return
    setSaving(true)
    try {
      if (editingId === 'new') {
        const r = await api.templateCreate(form as Omit<Template, 'id' | 'createdAt' | 'updatedAt'>)
        if (r.success) { addTemplate(r.data); setEditingId(null) }
      } else {
        const r = await api.templateUpdate(form as Template)
        if (r.success) { updateTemplate(r.data); setEditingId(null) }
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (t: Template): Promise<void> => {
    if (!confirm(`テンプレート「${t.name}」を削除しますか？`)) return
    const r = await api.templateDelete(t.id)
    if (r.success) removeTemplate(t.id)
  }

  if (editingId) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <h2 className="text-xl font-bold">{editingId === 'new' ? 'テンプレート追加' : 'テンプレート編集'}</h2>

        <div className="space-y-2">
          <label className="text-sm font-medium">テンプレート名</label>
          <input type="text" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <div className="flex gap-4">
          <div className="space-y-1 flex-1">
            <label className="text-sm font-medium">種別</label>
            <select value={form.type || 'daily'} onChange={(e) => setForm({ ...form, type: e.target.value as Template['type'] })}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="daily">日報</option>
              <option value="weekly">週報</option>
            </select>
          </div>
          <div className="space-y-1 flex-1">
            <label className="text-sm font-medium">件名テンプレート</label>
            <input type="text" value={form.emailSubjectTemplate || ''} onChange={(e) => setForm({ ...form, emailSubjectTemplate: e.target.value })}
              placeholder="【日報】{{date}}" className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">送信先メールアドレス（改行区切り）</label>
          <textarea value={(form.emailTo || []).join('\n')} onChange={(e) => setForm({ ...form, emailTo: e.target.value.split('\n').filter(Boolean) })}
            rows={2} placeholder="manager@example.com"
            className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Claude システムプロンプト</label>
          <textarea value={form.systemPrompt || ''} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
            rows={3} className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y" />
        </div>

        <div className="flex gap-3">
          <button onClick={() => setEditingId(null)}
            className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">
            キャンセル
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">テンプレート管理</h2>
        {showTypePicker ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">種別を選択:</span>
            <button onClick={() => startNew('daily')}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90">
              日報
            </button>
            <button onClick={() => startNew('weekly')}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90">
              週報
            </button>
            <button onClick={() => setShowTypePicker(false)}
              className="px-3 py-1.5 border border-border rounded-md text-sm hover:bg-accent">
              キャンセル
            </button>
          </div>
        ) : (
          <button onClick={() => setShowTypePicker(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90">
            + 新規追加
          </button>
        )}
      </div>
      <div className="space-y-2">
        {templates.map((t) => (
          <div key={t.id} className="flex items-center gap-3 p-4 rounded-md border border-border bg-card">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{t.name}</p>
                <span className="text-xs text-muted-foreground">
                  {t.type === 'daily' ? '日報' : '週報'}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(t)}
                className="px-3 py-1 text-xs rounded border border-border hover:bg-accent">
                編集
              </button>
              <button onClick={() => handleDelete(t)}
                className="px-3 py-1 text-xs rounded border border-destructive text-destructive hover:bg-destructive/10">
                削除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
