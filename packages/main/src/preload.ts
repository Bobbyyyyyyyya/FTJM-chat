const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  notify: (title: string, body: string, urgency?: string) =>
    ipcRenderer.invoke('notify', { title, body, urgency }),
  isWindowFocused: () => ipcRenderer.invoke('get-window-focused'),
  showWindow: () => ipcRenderer.invoke('show-window'),
  onUpdateStatus: (callback: (status: string, data?: any) => void) => {
    const handler = (_event: any, status: string, data?: any) => callback(status, data)
    ipcRenderer.on('update-status', handler)
    return () => ipcRenderer.removeListener('update-status', handler)
  },
  onNotificationClicked: (callback: (data: { title: string; body: string }) => void) => {
    const handler = (_event: any, data: { title: string; body: string }) => callback(data)
    ipcRenderer.on('notification-clicked', handler)
    return () => ipcRenderer.removeListener('notification-clicked', handler)
  },
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  openUpdateUrl: (url: string) => ipcRenderer.invoke('open-update-url', url),
  installUpdate: () => ipcRenderer.invoke('install-update'),
})
