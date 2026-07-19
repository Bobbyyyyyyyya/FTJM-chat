export const BANNED_MACS: string[] = [
  '02:F3:F9:F1:D9:A6',
  '02:53:33:0D:D8:D6',
]

export function isMacBanned(macAddress: string): boolean {
  const normalized = macAddress.toUpperCase().replace(/[:-]/g, ':')
  return BANNED_MACS.some(
    (banned) => banned.toUpperCase().replace(/[:-]/g, ':') === normalized
  )
}
