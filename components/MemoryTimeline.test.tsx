import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MemoryTimeline from './MemoryTimeline'
import type { Memory } from '@/lib/types'

vi.mock('./MediaUpload', () => ({ default: () => null }))
vi.mock('./MediaItem', () => ({ default: () => null }))

describe('MemoryTimeline valence/initiator capture', () => {
  it('saves valence and initiator chosen in the add form', () => {
    const onChange = vi.fn()
    render(<MemoryTimeline friendId="f1" memories={[]} onChange={onChange} />)

    fireEvent.click(screen.getByText('+ 记录一颗星尘'))
    fireEvent.change(screen.getByPlaceholderText('日期'), { target: { value: '2026-07-01' } })
    fireEvent.change(screen.getByPlaceholderText('标题'), { target: { value: '一起吃饭' } })
    fireEvent.click(screen.getByText('😣 别扭/不愉快'))
    fireEvent.click(screen.getByText('TA 发起'))
    fireEvent.click(screen.getByText('保存'))

    expect(onChange).toHaveBeenCalledTimes(1)
    const saved: Memory[] = onChange.mock.calls[0][0]
    expect(saved[0]).toMatchObject({ valence: 'negative', initiator: 'friend' })
  })

  it('clicking a selected valence again clears it', () => {
    const onChange = vi.fn()
    render(<MemoryTimeline friendId="f1" memories={[]} onChange={onChange} />)

    fireEvent.click(screen.getByText('+ 记录一颗星尘'))
    fireEvent.change(screen.getByPlaceholderText('日期'), { target: { value: '2026-07-01' } })
    fireEvent.change(screen.getByPlaceholderText('标题'), { target: { value: 't' } })
    const btn = screen.getByText('😊 开心/顺利')
    fireEvent.click(btn)
    fireEvent.click(btn)
    fireEvent.click(screen.getByText('保存'))

    const saved: Memory[] = onChange.mock.calls[0][0]
    expect(saved[0].valence).toBeUndefined()
  })
})
