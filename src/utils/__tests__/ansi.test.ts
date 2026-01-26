import { describe, it, expect } from 'vitest'
import { ansiToHtml } from '../ansi'

describe('ansiToHtml', () => {
  it('passes through plain text unchanged', () => {
    const result = ansiToHtml('hello world')
    expect(result).toBe('hello world')
  })

  it('converts ANSI color codes to HTML spans', () => {
    // ESC[31m = red foreground
    const result = ansiToHtml('\x1b[31mred text\x1b[0m')
    expect(result).toContain('red text')
    expect(result).toContain('<span')
    expect(result).toContain('class=')
  })

  it('handles bold ANSI codes', () => {
    const result = ansiToHtml('\x1b[1mbold\x1b[0m')
    expect(result).toContain('bold')
    expect(result).toContain('<span')
  })

  it('handles empty string', () => {
    expect(ansiToHtml('')).toBe('')
  })

  it('handles multiple ANSI sequences', () => {
    const result = ansiToHtml('\x1b[31mred\x1b[0m normal \x1b[32mgreen\x1b[0m')
    expect(result).toContain('red')
    expect(result).toContain('normal')
    expect(result).toContain('green')
  })
})
