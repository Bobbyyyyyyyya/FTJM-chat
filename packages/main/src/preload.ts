const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  notify: (title: string, body: string) =>
    ipcRenderer.invoke('notify', { title, body }),
  isWindowFocused: () => ipcRenderer.invoke('get-window-focused'),
  onUpdateStatus: (callback: (status: string, data?: any) => void) => {
    const handler = (_event: any, status: string, data?: any) => callback(status, data)
    ipcRenderer.on('update-status', handler)
    return () => ipcRenderer.removeListener('update-status', handler)
  },
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
})
