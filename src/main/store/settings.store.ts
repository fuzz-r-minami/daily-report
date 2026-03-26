import Store from 'electron-store'
import { v4 as uuidv4 } from 'uuid'
import type { AppSettings, Project, Template } from '@shared/types/settings.types'
import { DEFAULT_SETTINGS } from '@shared/types/settings.types'

const store = new Store<AppSettings>({
  name: 'config',
  defaults: DEFAULT_SETTINGS
})

export function getSettings(): AppSettings {
  return store.store
}

export function saveSettings(settings: AppSettings): void {
  store.store = settings
}

// Projects
export function getProjects(): Project[] {
  return store.get('projects', [])
}

export function createProject(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Project {
  const now = new Date().toISOString()
  const project: Project = {
    ...data,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now
  }
  const projects = getProjects()
  store.set('projects', [...projects, project])
  return project
}

export function updateProject(project: Project): Project {
  const projects = getProjects()
  const updated = { ...project, updatedAt: new Date().toISOString() }
  const index = projects.findIndex((p) => p.id === project.id)
  if (index === -1) throw new Error(`Project not found: ${project.id}`)
  projects[index] = updated
  store.set('projects', projects)
  return updated
}

export function deleteProject(id: string): void {
  const projects = getProjects()
  store.set(
    'projects',
    projects.filter((p) => p.id !== id)
  )
}

export function getProjectById(id: string): Project | undefined {
  return getProjects().find((p) => p.id === id)
}

// Templates
export function getTemplates(): Template[] {
  return store.get('templates', DEFAULT_SETTINGS.templates)
}

export function createTemplate(data: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>): Template {
  const now = new Date().toISOString()
  const template: Template = {
    ...data,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now
  }
  const templates = getTemplates()
  store.set('templates', [...templates, template])
  return template
}

export function updateTemplate(template: Template): Template {
  const templates = getTemplates()
  const updated = { ...template, updatedAt: new Date().toISOString() }
  const index = templates.findIndex((t) => t.id === template.id)
  if (index === -1) throw new Error(`Template not found: ${template.id}`)
  templates[index] = updated
  store.set('templates', templates)
  return updated
}

export function deleteTemplate(id: string): void {
  const templates = getTemplates()
  store.set(
    'templates',
    templates.filter((t) => t.id !== id)
  )
}

export function getDataDir(): string {
  return store.get('general.dataDir', '')
}
