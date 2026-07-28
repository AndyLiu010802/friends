import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import InstallPanel from './InstallPanel'
import * as pwa from './PwaSetup'

vi.mock('./PwaSetup', async importOriginal => ({
  ...(await importOriginal<typeof import('./PwaSetup')>()),
  getInstallPrompt: vi.fn().mockReturnValue(null),
  promptInstall: vi.fn(),
}))

function stubMatchMedia(standalone: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((q: string) => ({
    matches: q.includes('display-mode') ? standalone : false,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })))
}

function stubUA(ua: string) {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: ua })
}

const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'

beforeEach(() => {
  vi.mocked(pwa.getInstallPrompt).mockReturnValue(null)
  vi.mocked(pwa.promptInstall).mockReset()
  stubMatchMedia(false)
  stubUA(DESKTOP_UA)
})
afterEach(() => vi.unstubAllGlobals())

describe('InstallPanel', () => {
  it('standalone 模式显示已安装', () => {
    stubMatchMedia(true)
    render(<InstallPanel />)
    expect(screen.getByText(/已安装/)).toBeInTheDocument()
  })

  it('可安装时显示安装按钮并调用 promptInstall', async () => {
    vi.mocked(pwa.getInstallPrompt).mockReturnValue({} as pwa.BeforeInstallPromptEvent)
    vi.mocked(pwa.promptInstall).mockResolvedValue('accepted')
    render(<InstallPanel />)
    fireEvent.click(screen.getByText(/安装友记/))
    await waitFor(() => expect(pwa.promptInstall).toHaveBeenCalled())
    expect(screen.getByText(/已安装/)).toBeInTheDocument()
  })

  it('iOS Safari 显示两步说明', () => {
    stubUA(IOS_UA)
    render(<InstallPanel />)
    expect(screen.getByText(/添加到主屏幕/)).toBeInTheDocument()
  })

  it('iPadOS 伪装 Mac UA 时按触点数识别为 iOS', () => {
    stubUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15')
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 })
    render(<InstallPanel />)
    expect(screen.getByText(/添加到主屏幕/)).toBeInTheDocument()
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 })
  })

  it('其余环境显示不支持提示', () => {
    render(<InstallPanel />)
    expect(screen.getByText(/不支持安装/)).toBeInTheDocument()
  })

  it('挂载后收到 install-ready 事件切换为可安装', () => {
    render(<InstallPanel />)
    expect(screen.getByText(/不支持安装/)).toBeInTheDocument()
    vi.mocked(pwa.getInstallPrompt).mockReturnValue({} as pwa.BeforeInstallPromptEvent)
    act(() => { window.dispatchEvent(new Event('youji:install-ready')) })
    expect(screen.getByText(/安装友记/)).toBeInTheDocument()
  })
})
