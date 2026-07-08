import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import EmptyUniverse from './EmptyUniverse'

describe('EmptyUniverse', () => {
  it('渲染引导文案与新建链接', () => {
    render(<EmptyUniverse />)
    expect(screen.getByText(/你的宇宙还空着/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /点亮第一位朋友/ })).toHaveAttribute('href', '/friend/new')
  })
})
