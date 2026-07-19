declare global {
  interface Window {
    electron: {
      getScreenSources: () => Promise<{ id: string; name: string; thumbnailURL: string }[]>
      notify: (title: string, body: string, urgency?: string) => Promise<void>
      isWindowFocused: () => Promise<boolean>
      showWindow: () => Promise<void>
      onUpdateStatus: (callback: (status: string, data?: any) => void) => () => void
      onNotificationClicked: (callback: (data: { title: string; body: string }) => void) => () => void
      openNotificationSettings: () => Promise<void>
      checkForUpdates: () => Promise<void>
      openUpdateUrl: (url: string) => Promise<void>
      installUpdate: () => Promise<void>
      encryptStore: (key: string, value: string) => Promise<boolean>
      decryptStore: (key: string) => Promise<string | null>
      checkMacBanned: () => Promise<{ banned: boolean; macs: string[]; bannedList: string[] }>
    }
  }
}

export {}
