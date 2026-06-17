import {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  Notification,
  dialog,
} from 'electron'
import pkg from 'electron-updater'
import * as path from 'path'
import { fileURLToPath } from 'url'

const { autoUpdater } = pkg

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null
let loadRetryCount = 0
const MAX_LOAD_RETRIES = 30

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  let startUrl: string
  if (isDev) {
    startUrl = 'http://localhost:5173'
  } else if (app.isPackaged) {
    startUrl = `file://${path.join(process.resourcesPath, 'web-dist/index.html')}`
  } else {
    startUrl = `file://${path.join(__dirname, '../../packages/web/dist/index.html')}`
  }

  console.log('Loading URL:', startUrl)
  mainWindow.loadURL(startUrl)

  if (isDev) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.log('Page failed to load:', errorCode, errorDescription, validatedURL)
    if (errorCode === -3) return
    if (!startUrl) return
    if (loadRetryCount >= MAX_LOAD_RETRIES) {
      console.error('Max load retries reached, giving up')
      return
    }
    loadRetryCount++
    setTimeout(() => {
      mainWindow?.loadURL(startUrl)
    }, 2000)
  })

  mainWindow.webContents.on('did-finish-load', () => {
    loadRetryCount = 0
  })
}

app.on('ready', () => {
  createWindow()
  if (!isDev) {
    setupAutoUpdater()
  }
  setupIpcHandlers()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

function setupAutoUpdater() {
  try {
    autoUpdater.autoDownload = true

    autoUpdater.on('checking-for-update', () => {
      mainWindow?.webContents.send('update-status', 'checking')
    })

    autoUpdater.on('update-available', (info) => {
      mainWindow?.webContents.send('update-status', 'available', info)
    })

    autoUpdater.on('update-not-available', (info) => {
      mainWindow?.webContents.send('update-status', 'not-available', info)
    })

    autoUpdater.on('download-progress', (progress) => {
      mainWindow?.webContents.send('update-status', 'downloading', progress)
    })

    autoUpdater.on('update-downloaded', (info) => {
      mainWindow?.webContents.send('update-status', 'downloaded', info)
    })

    autoUpdater.checkForUpdates()
  } catch (err) {
    console.error('Auto-updater failed (this is expected on very new macOS versions):', err)
  }
}

function setupIpcHandlers() {
  ipcMain.handle('notify', (_event, { title, body }) => {
    new Notification({
      title,
      body,
    }).show()
  })

  ipcMain.handle('get-window-focused', () => {
    return mainWindow?.isFocused() || false
  })

  ipcMain.handle('check-for-updates', () => {
    try {
      autoUpdater.checkForUpdates()
    } catch (err) {
      console.error('Manual check for updates failed:', err)
    }
  })

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall()
  })
}

// Create menu
const template: any = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Exit',
        accelerator: 'CmdOrCtrl+Q',
        click: () => {
          app.quit()
        },
      },
    ],
  },
  {
    label: 'Help',
    submenu: [
      {
        label: 'About',
        click: () => {
          // About dialog
        },
      },
    ],
  },
]

const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)

