declare global {
  interface Window {
    electron: {
      notify: (title: string, body: string) => Promise<void>
      isWindowFocused: () => Promise<boolean>
      onUpdateStatus: (callback: (status: string, data?: any) => void) => () => void
      checkForUpdates: () => Promise<void>
      openUpdateUrl: (url: string) => Promise<void>
    }
  }
}

export {}
