import { describe, it, expect } from 'vitest'
import { isPasswordPrompt, PASSWORD_PATTERNS } from '../password-detection'

describe('isPasswordPrompt', () => {
  it('returns false for undefined content', () => {
    expect(isPasswordPrompt(undefined)).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isPasswordPrompt('')).toBe(false)
  })

  it('returns false for plain terminal output', () => {
    expect(isPasswordPrompt('$ ls\nfile1.txt\nfile2.txt')).toBe(false)
  })

  it('detects sudo password prompt', () => {
    expect(isPasswordPrompt('$ sudo apt update\n[sudo] password for user:')).toBe(true)
  })

  it('detects generic password prompt', () => {
    expect(isPasswordPrompt('connecting to server...\nPassword:')).toBe(true)
  })

  it('detects passphrase prompt', () => {
    expect(isPasswordPrompt('Enter passphrase for key:')).toBe(true)
  })

  it('detects PIN prompt', () => {
    expect(isPasswordPrompt('Unlock device\nEnter PIN:')).toBe(true)
  })

  it('detects authentication required', () => {
    expect(isPasswordPrompt('Authentication required for operation')).toBe(true)
  })

  it('only checks last 5 lines', () => {
    const lines = Array(10).fill('normal output')
    lines.push('Password:')
    // Password is at line 11 (within last 5 of 11 lines)
    expect(isPasswordPrompt(lines.join('\n'))).toBe(true)
  })

  it('ignores password prompts beyond last 5 lines', () => {
    const lines = ['Password:']
    lines.push(...Array(10).fill('normal output'))
    // Password is at line 1, well beyond last 5 lines
    expect(isPasswordPrompt(lines.join('\n'))).toBe(false)
  })

  it('is case insensitive', () => {
    expect(isPasswordPrompt('PASSWORD:')).toBe(true)
    expect(isPasswordPrompt('password:')).toBe(true)
  })
})

describe('PASSWORD_PATTERNS', () => {
  it('exports pattern array', () => {
    expect(Array.isArray(PASSWORD_PATTERNS)).toBe(true)
    expect(PASSWORD_PATTERNS.length).toBeGreaterThan(0)
    for (const pattern of PASSWORD_PATTERNS) {
      expect(pattern).toBeInstanceOf(RegExp)
    }
  })
})
