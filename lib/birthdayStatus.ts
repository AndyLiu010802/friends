function parseBirthday(birthday: string): { month: number; day: number } | null {
  const parts = birthday.split('-').map(Number)
  if (parts.length !== 3) return null
  const [, month, day] = parts
  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null
  return { month, day }
}

export function getBirthdayStatus(
  birthday?: string,
  now: Date = new Date(),
): {
  daysUntil: number | null
  label: string | null
  isToday: boolean
  isSoon: boolean
} {
  const parsed = birthday ? parseBirthday(birthday) : null
  if (!parsed) {
    return { daysUntil: null, label: null, isToday: false, isSoon: false }
  }

  const { month, day } = parsed
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let nextBirthday = new Date(now.getFullYear(), month - 1, day)
  if (nextBirthday < today) {
    nextBirthday = new Date(now.getFullYear() + 1, month - 1, day)
  }
  const daysUntil = Math.round((nextBirthday.getTime() - today.getTime()) / 86400000)

  if (daysUntil === 0) {
    return { daysUntil, label: '今天生日 🎂', isToday: true, isSoon: true }
  }
  if (daysUntil <= 7) {
    return { daysUntil, label: `${daysUntil} 天后生日`, isToday: false, isSoon: true }
  }
  return { daysUntil, label: null, isToday: false, isSoon: false }
}
