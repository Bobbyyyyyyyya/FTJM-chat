import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  Notification,
  nativeImage,
  shell,
  safeStorage,
} from 'electron'
import pkg from 'electron-updater'
import https from 'https'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, writeFileSync } from 'fs'

const { autoUpdater } = pkg

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const GITHUB_OWNER = 'Bobbyyyyyyyya'
const GITHUB_REPO = 'FTJM-chat'
const isMac = process.platform === 'darwin'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null
let tray: Tray | null
let loadRetryCount = 0
const MAX_LOAD_RETRIES = 30
let isQuitting = false

const getIconPath = () => {
  if (isDev) {
    return path.join(__dirname, '../../packages/main/assets/icon.png')
  }
  return path.join(process.resourcesPath, 'icon.png')
}

const getTrayIconPath = () => {
  if (isDev) {
    return path.join(__dirname, '../../packages/main/assets/icon.png')
  }
  return path.join(process.resourcesPath, 'icon.png')
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: getIconPath(),
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

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

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

function showWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
}

function createTray() {
  const iconPath = getTrayIconPath()
  const icon = nativeImage.createFromPath(iconPath)
  const trayIcon = isMac ? icon.resize({ width: 22, height: 22 }) : icon.resize({ width: 32, height: 32 })
  if (isMac) trayIcon.setTemplateImage(true)

  tray = new Tray(trayIcon)
  tray.setToolTip('FTJM Chat')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show FTJM Chat',
      click: () => showWindow(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)
  tray.on('click', () => showWindow())
}

app.on('ready', () => {
  createWindow()
  createTray()
  if (!isDev) {
    setTimeout(checkForUpdates, 5000)
    setInterval(checkForUpdates, 3600000)
  }
  setupIpcHandlers()
})

app.on('window-all-closed', () => {})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  } else {
    showWindow()
  }
})

app.on('before-quit', () => {
  isQuitting = true
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
  ipcMain.handle('notify', (_event, { title, body, urgency }) => {
    const n = new Notification({
      title,
      body,
      urgency: urgency || 'normal',
    })
    n.on('click', () => {
      showWindow()
      mainWindow?.webContents.send('notification-clicked', { title, body })
    })
    n.show()
  })

  ipcMain.handle('get-window-focused', () => {
    return mainWindow?.isFocused() || false
  })

  ipcMain.handle('show-window', () => {
    showWindow()
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

  ipcMain.handle('encrypt-store', (_event, key: string, value: string) => {
    try {
      if (!safeStorage.isEncryptionAvailable()) return false
      const encrypted = safeStorage.encryptString(value)
      const storagePath = path.join(app.getPath('userData'), 'secure-store.json')
      let store: Record<string, string> = {}
      try {
        store = JSON.parse(readFileSync(storagePath, 'utf-8'))
      } catch {}
      store[key] = encrypted.toString('base64')
      writeFileSync(storagePath, JSON.stringify(store), 'utf-8')
      return true
    } catch { return false }
  })

  ipcMain.handle('decrypt-store', (_event, key: string) => {
    try {
      if (!safeStorage.isEncryptionAvailable()) return null
      const storagePath = path.join(app.getPath('userData'), 'secure-store.json')
      let store: Record<string, string> = {}
      try {
        store = JSON.parse(readFileSync(storagePath, 'utf-8'))
      } catch {}
      if (!store[key]) return null
      const buffer = Buffer.from(store[key], 'base64')
      return safeStorage.decryptString(buffer)
    } catch { return null }
  })
}

const template: any = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Exit',
        accelerator: 'CmdOrCtrl+Q',
        click: () => {
          isQuitting = true
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
        click: () => {},
      },
    ],
  },
]

const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)
