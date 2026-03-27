import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { autoUpdater } from 'electron-updater'
import { registerSettingsHandlers } from './ipc/settings.handler'
import { registerGitHandlers } from './ipc/git.handler'
import { registerSvnHandlers } from './ipc/svn.handler'
import { registerSlackHandlers } from './ipc/slack.handler'
import { registerFileHandlers } from './ipc/file.handler'
import { registerClaudeHandlers } from './ipc/claude.handler'
import { registerMailHandlers } from './ipc/mail.handler'
import { registerReportHandlers } from './ipc/report.handler'
import { registerCalendarHandlers } from './ipc/calendar.handler'
import { registerPerforceHandlers } from './ipc/perforce.handler'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const isDev = !app.isPackaged
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.drepo.app')
  }

  app.on('browser-window-created', (_, window) => {
    window.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12') {
        window.webContents.toggleDevTools()
        event.preventDefault()
      }
    })
  })

  // Register IPC handlers
  registerSettingsHandlers()
  registerGitHandlers()
  registerSvnHandlers()
  registerSlackHandlers()
  registerFileHandlers()
  registerClaudeHandlers()
  registerMailHandlers()
  registerCalendarHandlers()
  registerPerforceHandlers()

  createWindow()

  if (mainWindow) {
    registerReportHandlers(mainWindow)
  }

  // Auto updater (packaged build only)
  if (app.isPackaged) {
    autoUpdater.autoDownload = false

    autoUpdater.on('checking-for-update', () => {
      mainWindow?.webContents.send('update:status', { type: 'checking' })
    })
    autoUpdater.on('update-available', (info) => {
      mainWindow?.webContents.send('update:status', { type: 'available', version: info.version })
    })
    autoUpdater.on('update-not-available', () => {
      mainWindow?.webContents.send('update:status', { type: 'not-available' })
    })
    autoUpdater.on('download-progress', (p) => {
      mainWindow?.webContents.send('update:status', { type: 'downloading', percent: Math.floor(p.percent) })
    })
    autoUpdater.on('update-downloaded', () => {
      mainWindow?.webContents.send('update:status', { type: 'downloaded' })
    })
    autoUpdater.on('error', (err) => {
      mainWindow?.webContents.send('update:status', { type: 'error', message: err.message })
    })

    ipcMain.handle('update:check', () => autoUpdater.checkForUpdates())
    ipcMain.handle('update:download', () => autoUpdater.downloadUpdate())
    ipcMain.handle('update:install', () => { autoUpdater.quitAndInstall() })

    // 起動後30秒後にチェック（起動直後は重いので少し遅らせる）
    setTimeout(() => autoUpdater.checkForUpdates(), 30_000)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
