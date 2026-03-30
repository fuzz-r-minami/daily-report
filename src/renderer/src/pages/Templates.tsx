import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/app.store'
import { api } from '../lib/api'
import type { Template } from '@shared/types/settings.types'


export function Templates(): JSX.Element {
  const { t } = useTranslation()
  const { templates, addTemplate, updateTemplate, removeTemplate } = useAppStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<Template>>({})
  const [saving, setSaving] = useState(false)
  const [showTypePicker, setShowTypePicker] = useState(false)

  const startEdit = (tmpl: Template): void => {
    setEditingId(tmpl.id)
    setForm({ ...tmpl })
  }

  const startNew = (type: 'daily' | 'weekly' | 'monthly'): void => {
    setShowTypePicker(false)
    setEditingId('new')
    const preamble = t(`templates.defaultPreamble${type.charAt(0).toUpperCase() + type.slice(1)}`)
    const systemPrompt = t(`templates.defaultSystemPrompt${type.charAt(0).toUpperCase() + type.slice(1)}`)
    const emailSubjectTemplate = t(`templates.defaultEmailSubject${type.charAt(0).toUpperCase() + type.slice(1)}`)
    setForm({ name: '', type, isDefault: false, preamble, postamble: t('templates.defaultPostamble'), systemPrompt, emailSubjectTemplate, emailTo: [] })
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

  const handleDelete = async (tmpl: Template): Promise<void> => {
    if (!confirm(t('templates.confirmDelete', { name: tmpl.name }))) return
    const r = await api.templateDelete(tmpl.id)
    if (r.success) removeTemplate(tmpl.id)
  }

  const typeLabel = (type: string): string =>
    type === 'daily' ? t('templates.typeDaily') : type === 'weekly' ? t('templates.typeWeekly') : t('templates.typeMonthly')

  const preambleVars = form.type === 'weekly' ? '{{week_range}}' : form.type === 'monthly' ? '{{month}}' : '{{date}}'

  if (editingId) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <h2 className="text-xl font-bold">{editingId === 'new' ? t('templates.titleNew') : t('templates.titleEdit')}</h2>

        <div className="space-y-2">
          <label className="text-sm font-medium">{t('templates.labelName')}</label>
          <input type="text" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <div className="flex gap-4">
          <div className="space-y-1 flex-1">
            <label className="text-sm font-medium">{t('templates.labelType')}</label>
            <select value={form.type || 'daily'} onChange={(e) => setForm({ ...form, type: e.target.value as Template['type'] })}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="daily">{t('templates.typeDaily')}</option>
              <option value="weekly">{t('templates.typeWeekly')}</option>
              <option value="monthly">{t('templates.typeMonthly')}</option>
            </select>
          </div>
          <div className="space-y-1 flex-1">
            <label className="text-sm font-medium">{t('templates.labelSubject')}</label>
            <input type="text" value={form.emailSubjectTemplate || ''} onChange={(e) => setForm({ ...form, emailSubjectTemplate: e.target.value })}
              placeholder="【日報】{{date}}" className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">{t('templates.labelEmailTo')}</label>
          <textarea value={(form.emailTo || []).join('\n')} onChange={(e) => setForm({ ...form, emailTo: e.target.value.split('\n').filter(Boolean) })}
            rows={2} placeholder="manager@example.com"
            className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">{t('templates.labelPreamble')}</label>
          <p className="text-xs text-muted-foreground">{t('templates.preambleVars', { vars: preambleVars })}</p>
          <textarea value={form.preamble || ''} onChange={(e) => setForm({ ...form, preamble: e.target.value })}
            rows={2} className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">{t('templates.labelPostamble')}</label>
          <textarea value={form.postamble || ''} onChange={(e) => setForm({ ...form, postamble: e.target.value })}
            rows={2} className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">{t('templates.labelSystemPrompt')}</label>
          <textarea value={form.systemPrompt || ''} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
            rows={3} className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y" />
        </div>

        <div className="flex gap-3">
          <button onClick={() => setEditingId(null)}
            className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">
            {t('common.cancel')}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t('templates.title')}</h2>
        {showTypePicker ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('templates.selectType')}</span>
            <button onClick={() => startNew('daily')}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90">
              {t('templates.typeDaily')}
            </button>
            <button onClick={() => startNew('weekly')}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90">
              {t('templates.typeWeekly')}
            </button>
            <button onClick={() => startNew('monthly')}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90">
              {t('templates.typeMonthly')}
            </button>
            <button onClick={() => setShowTypePicker(false)}
              className="px-3 py-1.5 border border-border rounded-md text-sm hover:bg-accent">
              {t('common.cancel')}
            </button>
          </div>
        ) : (
          <button onClick={() => setShowTypePicker(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90">
            {t('common.add')}
          </button>
        )}
      </div>
      <div className="space-y-2">
        {templates.map((tmpl) => (
          <div key={tmpl.id} className="flex items-center gap-3 p-4 rounded-md border border-border bg-card">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{tmpl.name}</p>
                <span className="text-xs text-muted-foreground">{typeLabel(tmpl.type)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(tmpl)}
                className="px-3 py-1 text-xs rounded border border-border hover:bg-accent">
                {t('common.edit')}
              </button>
              <button onClick={() => handleDelete(tmpl)}
                className="px-3 py-1 text-xs rounded border border-destructive text-destructive hover:bg-destructive/10">
                {t('common.delete')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
