declare global {
  interface Window {
    electron: {
      notify: (title: string, body: string, urgency?: string) => Promise<void>
      isWindowFocused: () => Promise<boolean>
      showWindow: () => Promise<void>
      onUpdateStatus: (callback: (status: string, data?: any) => void) => () => void
      onNotificationClicked: (callback: (data: { title: string; body: string }) => void) => () => void
      checkForUpdates: () => Promise<void>
      openUpdateUrl: (url: string) => Promise<void>
      installUpdate: () => Promise<void>
    }
  }
}

export {}
