import { ipcMain } from 'electron'
import type { IpcResult } from '@shared/types/ipc.types'
import * as settingsStore from '../store/settings.store'
import * as credentialsStore from '../store/credentials.store'
import {
  startOAuthFlow,
  testCalendarConnection
} from '../services/calendar.service'

export function registerCalendarHandlers(): void {
  /** OAuth2 フローを開始してリフレッシュトークンを取得・保存 */
  ipcMain.handle('calendar:startAuth', async (): Promise<IpcResult<string>> => {
    try {
      const settings = settingsStore.getSettings()
      const gc = settings.googleCalendar
      if (!gc?.clientId || !gc?.clientSecret) {
        return { success: false, error: 'Client ID と Client Secret を先に設定してください' }
      }
      const refreshToken = await startOAuthFlow(gc.clientId, gc.clientSecret)
      const credKey = gc.credentialKey || 'google-calendar-refresh-token'
      await credentialsStore.setCredential(credKey, refreshToken)

      // credentialKey を設定に保存
      const newSettings = {
        ...settings,
        googleCalendar: { ...gc, credentialKey: credKey }
      }
      settingsStore.saveSettings(newSettings)

      return { success: true, data: '認証完了。リフレッシュトークンを保存しました。' }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  /** 接続テスト */
  ipcMain.handle('calendar:test', async (): Promise<IpcResult<string>> => {
    try {
      const settings = settingsStore.getSettings()
      const gc = settings.googleCalendar
      if (!gc?.clientId || !gc?.clientSecret) {
        return { success: false, error: 'Client ID と Client Secret が未設定です' }
      }
      const refreshToken = await credentialsStore.getCredential(gc.credentialKey || 'google-calendar-refresh-token')
      if (!refreshToken) {
        return { success: false, error: 'リフレッシュトークンがありません。先に認証してください。' }
      }
      const msg = await testCalendarConnection(gc.clientId, gc.clientSecret, refreshToken)
      return { success: true, data: msg }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

}
