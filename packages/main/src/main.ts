import {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  Notification,
} from 'electron'
import pkg from 'electron-updater'
import * as path from 'path'
import * as isDev from 'electron-is-dev'
import { fileURLToPath } from 'url'

const { autoUpdater } = pkg

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null

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

  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../../packages/web/dist/index.html')}`

  console.log('Loading URL:', startUrl)
  mainWindow.loadURL(startUrl)

  if (isDev) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Page failed to load:', errorCode, errorDescription)
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
  autoUpdater.checkForUpdatesAndNotify()
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

