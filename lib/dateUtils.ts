export function parseDateOnly(date: string): Date | null {
  const parts = date.split('-').map(Number)
  if (parts.length !== 3) return null
  const [year, month, day] = parts
  if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null
  return new Date(year, month - 1, day)
}

export function daysBetween(dateA: Date, dateB: Date): number {
  const a = new Date(dateA.getFullYear(), dateA.getMonth(), dateA.getDate())
  const b = new Date(dateB.getFullYear(), dateB.getMonth(), dateB.getDate())
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}
