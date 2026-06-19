import {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  Notification,
  shell,
} from 'electron'
import pkg from 'electron-updater'
import https from 'https'
import * as path from 'path'
import { fileURLToPath } from 'url'

const { autoUpdater } = pkg

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const GITHUB_OWNER = 'Bobbyyyyyyyya'
const GITHUB_REPO = 'FTJM-chat'
const isMac = process.platform === 'darwin'

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

  mainWindow.webContents.openDevTools()

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
    setTimeout(checkForUpdates, 5000)
    setInterval(checkForUpdates, 3600000)
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

function checkForUpdates() {
  if (!mainWindow) return
  mainWindow.webContents.send('update-status', 'checking')

  if (isMac) {
    checkGithubRelease()
  } else {
    setupUpdaterListeners()
    autoUpdater.autoDownload = true
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
    })
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('checkForUpdates failed:', err)
    })
  }
}

let updaterListenersRegistered = false

function setupUpdaterListeners() {
  if (updaterListenersRegistered) return
  updaterListenersRegistered = true

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-status', 'available', {
      version: info?.version,
    })
  })

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update-status', 'not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-status', 'downloading', progress)
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update-status', 'downloaded', {
      version: info?.version,
    })
  })

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err)
    mainWindow?.webContents.send('update-status', 'error', err.message || err)
  })
}

function checkGithubRelease() {
  const currentVersion = app.getVersion()
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`

  https.get(url, { headers: { 'User-Agent': 'FTJM-Chat' } }, (res) => {
    let body = ''
    res.on('data', (chunk) => { body += chunk })
    res.on('end', () => {
      try {
        const release = JSON.parse(body)
        if (!release.tag_name) {
          mainWindow?.webContents.send('update-status', 'error', 'Could not fetch release info')
          return
        }
        const latestVersion = release.tag_name.replace(/^v/, '')
        if (latestVersion !== currentVersion) {
          mainWindow?.webContents.send('update-status', 'available', {
            version: latestVersion,
            url: release.html_url,
          })
        } else {
          mainWindow?.webContents.send('update-status', 'not-available')
        }
      } catch {
        mainWindow?.webContents.send('update-status', 'error', 'Failed to parse update info')
      }
    })
  }).on('error', (err) => {
    mainWindow?.webContents.send('update-status', 'error', err.message)
  })
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
    checkForUpdates()
  })

  ipcMain.handle('open-update-url', (_event, url: string) => {
    shell.openExternal(url)
  })

  ipcMain.handle('install-update', () => {
    if (!isMac) {
      autoUpdater.quitAndInstall()
    }
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

