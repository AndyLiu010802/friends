import { describe, it, expect } from 'vitest'
import { safeParseAIJson } from './json'

describe('safeParseAIJson', () => {
  it('parses a plain JSON string', () => {
    const result = safeParseAIJson<{ a: number }>('{"a":1}')
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ a: 1 })
  })

  it('parses JSON wrapped in a ```json code fence', () => {
    const text = '```json\n{"a":2}\n```'
    const result = safeParseAIJson<{ a: number }>(text)
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ a: 2 })
  })

  it('strips leading and trailing prose around the JSON object', () => {
    const text = '这是结果：\n{"a":3}\n希望有帮助！'
    const result = safeParseAIJson<{ a: number }>(text)
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ a: 3 })
  })

  it('does not throw on malformed JSON and returns ok:false with the raw text', () => {
    const text = 'not json at all'
    const result = safeParseAIJson(text)
    expect(result.ok).toBe(false)
    expect(result.raw).toBe(text)
    expect(result.error).toBeTruthy()
  })

  // Edge cases beyond the spec's four required tests. The brace-slicing
  // algorithm is a deliberate simplification (first `{` / last `}`, not a
  // real brace-matcher) — these tests document its actual behavior rather
  // than change it.
  describe('edge cases (documenting known simplified-slicing behavior)', () => {
    it('parses correctly when the JSON contains nested objects', () => {
      const result = safeParseAIJson<{ a: number; nested: { b: number } }>(
        '{"a":1,"nested":{"b":2}}'
      )
      expect(result.ok).toBe(true)
      expect(result.data).toEqual({ a: 1, nested: { b: 2 } })
    })

    it('parses correctly when a string value itself contains literal braces', () => {
      const result = safeParseAIJson<{ text: string }>(
        '{"text": "use {curly braces} like this"}'
      )
      expect(result.ok).toBe(true)
      expect(result.data).toEqual({ text: 'use {curly braces} like this' })
    })

    it('extracts only the first JSON block when the response has multiple code fences', () => {
      const text =
        'Here is an example:\n```json\n{"example":true}\n```\nAnd here is the real answer:\n```json\n{"answer":42}\n```'
      const result = safeParseAIJson<{ example: boolean }>(text)
      expect(result.ok).toBe(true)
      expect(result.data).toEqual({ example: true })
    })

    it('KNOWN LIMITATION: fails when unfenced trailing prose contains a stray closing/opening brace', () => {
      // Because the algorithm slices from the first `{` to the LAST `}` in
      // the whole string (not a real brace-matcher), trailing prose that
      // itself contains brace characters (e.g. Chinese text using `{x, y}`
      // as informal set notation) pulls extra, non-JSON text into the slice
      // and parsing fails. This is a known, accepted gap of the simplified
      // algorithm — not something this task fixes. Wrapping AI output in a
      // code fence (see the multi-fence test above) avoids it.
      const text = '结果如下:\n{"a":1,"tags":{"x":true}}\n注：集合 {x, y} 仅供参考'
      const result = safeParseAIJson(text)
      expect(result.ok).toBe(false)
      expect(result.raw).toBe(text)
    })
  })
})
