const DEVELOPER_NAMES = ['marko hoksen']

export function isDeveloper(name?: string | null): boolean {
  if (!name) return false
  const normalized = name.trim().toLowerCase()
  return DEVELOPER_NAMES.includes(normalized)
}