import { ipcMain, shell } from 'electron'
import type { IpcResult } from '@shared/types/ipc.types'

export function registerMailHandlers(): void {
  ipcMain.handle(
    'mail:open',
    async (_, to: string[], subject: string, body: string): Promise<IpcResult<void>> => {
      try {
        const mailto =
          `mailto:${to.join(',')}` +
          `?subject=${encodeURIComponent(subject)}` +
          `&body=${encodeURIComponent(body)}`
        await shell.openExternal(mailto)
        return { success: true, data: undefined }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )
}
