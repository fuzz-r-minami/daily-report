import { create } from 'zustand'
import type { Project, Template, AppSettings } from '@shared/types/settings.types'
import type { ReportSession, CollectionProgress } from '@shared/types/report.types'

interface AppState {
  settings: AppSettings | null
  projects: Project[]
  templates: Template[]
  currentSession: ReportSession | null
  progressLog: CollectionProgress[]
  logs: string[]
  isGenerating: boolean
  isAllocating: boolean

  setSettings: (settings: AppSettings) => void
  setProjects: (projects: Project[]) => void
  addProject: (project: Project) => void
  updateProject: (project: Project) => void
  removeProject: (id: string) => void
  setTemplates: (templates: Template[]) => void
  addTemplate: (template: Template) => void
  updateTemplate: (template: Template) => void
  removeTemplate: (id: string) => void
  setCurrentSession: (session: ReportSession | null) => void
  addProgress: (progress: CollectionProgress) => void
  clearProgress: () => void
  addLog: (line: string) => void
  clearLogs: () => void
  setIsGenerating: (v: boolean) => void
  setIsAllocating: (v: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  settings: null,
  projects: [],
  templates: [],
  currentSession: null,
  progressLog: [],
  logs: [],
  isGenerating: false,
  isAllocating: false,

  setSettings: (settings) => set({ settings }),
  setProjects: (projects) => set({ projects }),
  addProject: (project) => set((s) => ({ projects: [...s.projects, project] })),
  updateProject: (project) =>
    set((s) => ({ projects: s.projects.map((p) => (p.id === project.id ? project : p)) })),
  removeProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
  setTemplates: (templates) => set({ templates }),
  addTemplate: (template) => set((s) => ({ templates: [...s.templates, template] })),
  updateTemplate: (template) =>
    set((s) => ({ templates: s.templates.map((t) => (t.id === template.id ? template : t)) })),
  removeTemplate: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),
  setCurrentSession: (session) => set({ currentSession: session }),
  addProgress: (progress) =>
    set((s) => {
      const existing = s.progressLog.findIndex(
        (p) => p.projectId === progress.projectId && p.step === progress.step
      )
      if (existing >= 0) {
        const log = [...s.progressLog]
        log[existing] = progress
        return { progressLog: log }
      }
      return { progressLog: [...s.progressLog, progress] }
    }),
  clearProgress: () => set({ progressLog: [] }),
  addLog: (line) => set((s) => ({ logs: [...s.logs, line] })),
  clearLogs: () => set({ logs: [] }),
  setIsGenerating: (v) => set({ isGenerating: v }),
  setIsAllocating: (v) => set({ isAllocating: v })
}))
