// Type-safe wrapper around window.api (exposed by preload)
import type { ElectronAPI } from '../../../preload/index'

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export const api = window.api
