const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  notify: (title: string, body: string) =>
    ipcRenderer.invoke('notify', { title, body }),
  isWindowFocused: () => ipcRenderer.invoke('get-window-focused'),
})
