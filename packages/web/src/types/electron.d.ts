declare global {
  interface Window {
    electron: {
      notify: (title: string, body: string) => Promise<void>
      isWindowFocused: () => Promise<boolean>
    }
  }
}

export {}
