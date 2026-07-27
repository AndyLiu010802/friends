'use client'
import { useEffect, useState } from 'react'

const QUERY = '(max-width: 640px)'

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches
  )
  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const onChange = (e: { matches: boolean }) => setMobile(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return mobile
}
