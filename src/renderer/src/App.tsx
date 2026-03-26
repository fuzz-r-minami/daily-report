import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { Projects } from './pages/Projects'
import { ProjectEdit } from './pages/ProjectEdit'
import { Templates } from './pages/Templates'
import { Settings } from './pages/Settings'
import { ReportPreview } from './pages/ReportPreview'
import { useAppStore } from './store/app.store'
import { api } from './lib/api'

function AppRoutes(): JSX.Element {
  const navigate = useNavigate()
  const { settings, setSettings, setProjects, setTemplates, addProgress, addLog } = useAppStore()
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    Promise.all([
      api.settingsGet(),
      api.projectList(),
      api.templateList()
    ]).then(([s, p, t]) => {
      if (s.success) setSettings(s.data)
      if (p.success) setProjects(p.data)
      if (t.success) setTemplates(t.data)

      // First-run: if no projects, navigate to Projects page with a hint
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

  if (initializing) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        読み込み中...
      </div>
    )
  }

  return (
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
