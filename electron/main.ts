import { app, BrowserWindow, shell } from 'electron'
import path from 'path'
import { createIPCHandler } from 'electron-trpc/main'
import { router } from './ipc/router'
import { getDb, seedFakeRecords } from './db/index'

// Keep a global reference to prevent garbage collection
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f0f0f',
  })

  createIPCHandler({ router, windows: [mainWindow] })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  // Initialize DB; seed fake records in dev only
  getDb()
  if (process.env['NODE_ENV'] === 'development') seedFakeRecords()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
