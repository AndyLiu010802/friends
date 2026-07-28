import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import PwaSetup, { getInstallPrompt, promptInstall, _resetForTest } from './PwaSetup'

const register = vi.fn().mockResolvedValue(undefined)
const unregister = vi.fn()
const getRegistrations = vi.fn().mockResolvedValue([{ unregister }])

beforeEach(() => {
  _resetForTest()
  register.mockClear()
  unregister.mockClear()
  getRegistrations.mockClear()
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true, value: { register, getRegistrations },
  })
})
afterEach(() => {
  vi.unstubAllEnvs()
  // @ts-expect-error 清理 mock
  delete navigator.serviceWorker
})

describe('PwaSetup', () => {
  it('生产环境注册 /sw.js', () => {
    vi.stubEnv('NODE_ENV', 'production')
    render(<PwaSetup />)
    expect(register).toHaveBeenCalledWith('/sw.js')
  })

  it('开发环境不注册,且清理既有注册(防缓存毒化 dev)', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    render(<PwaSetup />)
    expect(register).not.toHaveBeenCalled()
    await waitFor(() => expect(unregister).toHaveBeenCalled())
  })

  it('捕获 beforeinstallprompt 后 getInstallPrompt 非空并派发就绪事件', () => {
    render(<PwaSetup />)
    const readyListener = vi.fn()
    window.addEventListener('youji:install-ready', readyListener)
    const evt = new Event('beforeinstallprompt') as Event & { preventDefault: () => void }
    const pd = vi.spyOn(evt, 'preventDefault')
    window.dispatchEvent(evt)
    expect(pd).toHaveBeenCalled()
    expect(getInstallPrompt()).toBe(evt)
    expect(readyListener).toHaveBeenCalled()
    window.removeEventListener('youji:install-ready', readyListener)
  })

  it('promptInstall 走 accepted 流程并清空存量', async () => {
    render(<PwaSetup />)
    const evt = Object.assign(new Event('beforeinstallprompt'), {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    })
    window.dispatchEvent(evt)
    await expect(promptInstall()).resolves.toBe('accepted')
    expect(evt.prompt).toHaveBeenCalled()
    expect(getInstallPrompt()).toBeNull()
  })

  it('无存量事件时 promptInstall 返回 unavailable', async () => {
    await expect(promptInstall()).resolves.toBe('unavailable')
  })
})
