import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { Projects } from './pages/Projects'
import { ProjectEdit } from './pages/ProjectEdit'
import { Templates } from './pages/Templates'
import { Settings } from './pages/Settings'
import { ReportPreview } from './pages/ReportPreview'
import { LanguageSelectModal } from './components/LanguageSelectModal'
import { useAppStore } from './store/app.store'
import { api } from './lib/api'
import { setLanguage } from './i18n'
import type { AppLanguage } from '@shared/types/settings.types'

function AppRoutes(): JSX.Element {
  const navigate = useNavigate()
  const { settings, setSettings, setProjects, setTemplates, addProgress, addLog } = useAppStore()
  const [initializing, setInitializing] = useState(true)
  const [showLangSelect, setShowLangSelect] = useState(false)

  useEffect(() => {
    Promise.all([
      api.settingsGet(),
      api.projectList(),
      api.templateList()
    ]).then(([s, p, t]) => {
      if (s.success) {
        setSettings(s.data)
        if (s.data.general.language) {
          setLanguage(s.data.general.language)
        } else {
          // 初回起動：言語未設定
          setShowLangSelect(true)
        }
      }
      if (p.success) setProjects(p.data)
      if (t.success) setTemplates(t.data)

      if (p.success && p.data.length === 0) {
        navigate('/projects', { replace: true })
      }
    }).finally(() => {
      setInitializing(false)
    })

    const unsubProgress = api.onReportProgress((progress) => addProgress(progress))
    const unsubLog = api.onReportLog((line) => addLog(line))
    return () => { unsubProgress(); unsubLog() }
  }, [])

  const handleLanguageSelect = async (lang: AppLanguage): Promise<void> => {
    setShowLangSelect(false)
    if (!settings) return
    const newSettings = { ...settings, general: { ...settings.general, language: lang } }
    await api.settingsSave(newSettings)
    setSettings(newSettings)
  }

  if (initializing) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Loading...
      </div>
    )
  }

  return (
    <>
      {showLangSelect && <LanguageSelectModal onSelect={handleLanguageSelect} />}
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/new" element={<ProjectEdit />} />
        <Route path="/projects/:id" element={<ProjectEdit />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/report-preview" element={<ReportPreview />} />
      </Routes>
    </>
  )
}

export default function App(): JSX.Element {
  return (
    <HashRouter>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <AppRoutes />
        </main>
      </div>
    </HashRouter>
  )
}
