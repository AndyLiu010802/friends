import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MemoryTimeline from './MemoryTimeline'
import { extractMemory } from '@/lib/quickMemory'
import type { Memory } from '@/lib/types'

vi.mock('./MediaUpload', () => ({ default: () => null }))
vi.mock('./MediaItem', () => ({ default: () => null }))
vi.mock('@/lib/quickMemory', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/quickMemory')>()),
  extractMemory: vi.fn(),
}))

describe('MemoryTimeline quick add', () => {
  it('快速记录:只有 textarea,保存后按提取结果落库', async () => {
    vi.mocked(extractMemory).mockResolvedValue({ title: '一起爬山', tags: ['爬山'], valence: 'positive', initiator: 'friend' })
    const onChange = vi.fn()
    render(<MemoryTimeline friendId="f1" friendName="阿明" memories={[]} onChange={onChange} />)
    fireEvent.click(screen.getByText('+ 记录一颗星尘'))
    expect(screen.queryByPlaceholderText('标题')).not.toBeInTheDocument()
    expect(screen.queryByText(/这次互动感觉/)).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '她约我爬山,聊得很开心' } })
    fireEvent.click(screen.getByText('保存'))
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const saved = onChange.mock.calls[0][0][0]
    expect(saved.title).toBe('一起爬山')
    expect(saved.tags).toEqual(['爬山'])
    expect(saved.time).toMatch(/^\d{2}:\d{2}$/)
    expect(saved.content).toBe('她约我爬山,聊得很开心')
  })

  it('AI 失败时降级保存(标题取首句)', async () => {
    vi.mocked(extractMemory).mockResolvedValue(null)
    const onChange = vi.fn()
    render(<MemoryTimeline friendId="f1" friendName="阿明" memories={[]} onChange={onChange} />)
    fireEvent.click(screen.getByText('+ 记录一颗星尘'))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '一起吃了火锅。很开心' } })
    fireEvent.click(screen.getByText('保存'))
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange.mock.calls[0][0][0].title).toBe('一起吃了火锅')
  })

  it('内容为空时保存按钮禁用', () => {
    render(<MemoryTimeline friendId="f1" friendName="阿明" memories={[]} onChange={vi.fn()} />)
    fireEvent.click(screen.getByText('+ 记录一颗星尘'))
    expect(screen.getByText('保存')).toBeDisabled()
  })

  it('时间线显示 time,旧数据无 time 正常渲染', () => {
    const memories = [
      { id: 'm1', date: '2026-07-27', time: '09:05', title: '新的', content: '', tags: [], media: [] },
      { id: 'm2', date: '2026-07-01', title: '旧的', content: '', tags: [], media: [] },
    ]
    render(<MemoryTimeline friendId="f1" friendName="阿明" memories={memories} onChange={vi.fn()} />)
    expect(screen.getByText(/09:05/)).toBeInTheDocument()
    expect(screen.getByText('旧的')).toBeInTheDocument()
  })
})

describe('MemoryTimeline edit/delete', () => {
  it('编辑表单包含 time 输入且保存保留', async () => {
    const memories = [{ id: 'm1', date: '2026-07-27', time: '09:05', title: 't', content: '', tags: [], media: [] }]
    const onChange = vi.fn()
    render(<MemoryTimeline friendId="f1" friendName="阿明" memories={memories} onChange={onChange} />)
    fireEvent.click(screen.getByText('编辑'))
    const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement
    expect(timeInput.value).toBe('09:05')
    fireEvent.change(timeInput, { target: { value: '10:30' } })
    fireEvent.click(screen.getAllByText('保存')[0])
    expect(onChange.mock.calls[0][0][0].time).toBe('10:30')
  })

  it('edit form still captures valence and initiator', () => {
    const memories: Memory[] = [{ id: 'm1', date: '2026-07-01', title: '一起吃饭', content: '', tags: [], media: [] }]
    const onChange = vi.fn()
    render(<MemoryTimeline friendId="f1" friendName="阿明" memories={memories} onChange={onChange} />)

    fireEvent.click(screen.getByText('编辑'))
    fireEvent.click(screen.getByText('😣 别扭/不愉快'))
    fireEvent.click(screen.getByText('TA 发起'))
    fireEvent.click(screen.getAllByText('保存')[0])

    expect(onChange).toHaveBeenCalledTimes(1)
    const saved: Memory[] = onChange.mock.calls[0][0]
    expect(saved[0]).toMatchObject({ valence: 'negative', initiator: 'friend' })
  })

  it('clicking a selected valence again clears it in edit form', () => {
    const memories: Memory[] = [{ id: 'm1', date: '2026-07-01', title: 't', content: '', tags: [], media: [] }]
    const onChange = vi.fn()
    render(<MemoryTimeline friendId="f1" friendName="阿明" memories={memories} onChange={onChange} />)

    fireEvent.click(screen.getByText('编辑'))
    const btn = screen.getByText('😊 开心/顺利')
    fireEvent.click(btn)
    fireEvent.click(btn)
    fireEvent.click(screen.getAllByText('保存')[0])

    const saved: Memory[] = onChange.mock.calls[0][0]
    expect(saved[0].valence).toBeUndefined()
  })

  it('deletes a memory after confirm', () => {
    const memories: Memory[] = [{ id: 'm1', date: '2026-07-01', title: '一起吃饭', content: '', tags: [], media: [] }]
    const onChange = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<MemoryTimeline friendId="f1" friendName="阿明" memories={memories} onChange={onChange} />)

    fireEvent.click(screen.getByText('删除'))

    expect(onChange).toHaveBeenCalledWith([])
    vi.restoreAllMocks()
  })
})
