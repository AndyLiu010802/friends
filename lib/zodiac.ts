const SIGNS = [
  { name: '摩羯座', from: [12, 22] },
  { name: '水瓶座', from: [1,  20] },
  { name: '双鱼座', from: [2,  19] },
  { name: '白羊座', from: [3,  21] },
  { name: '金牛座', from: [4,  20] },
  { name: '双子座', from: [5,  21] },
  { name: '巨蟹座', from: [6,  21] },
  { name: '狮子座', from: [7,  23] },
  { name: '处女座', from: [8,  23] },
  { name: '天秤座', from: [9,  23] },
  { name: '天蝎座', from: [10, 23] },
  { name: '射手座', from: [11, 22] },
] as const

export function getZodiac(birthday: string): string {
  const d = new Date(birthday)
  const m = d.getMonth() + 1
  const day = d.getDate()

  // December 22+ is 摩羯座
  if (m === 12 && day >= 22) return '摩羯座'

  // Iterate signs from 射手座 back to 水瓶座 (skip index 0 = 摩羯座)
  for (let i = SIGNS.length - 1; i >= 1; i--) {
    const [sm, sd] = SIGNS[i].from
    if (m > sm || (m === sm && day >= sd)) return SIGNS[i].name
  }

  // January 1–19 falls to 摩羯座
  return '摩羯座'
}

export function getZodiacElement(zodiac: string): 'fire' | 'earth' | 'air' | 'water' {
  if (['白羊座', '狮子座', '射手座'].includes(zodiac)) return 'fire'
  if (['金牛座', '处女座', '摩羯座'].includes(zodiac)) return 'earth'
  if (['双子座', '天秤座', '水瓶座'].includes(zodiac)) return 'air'
  return 'water'
}
