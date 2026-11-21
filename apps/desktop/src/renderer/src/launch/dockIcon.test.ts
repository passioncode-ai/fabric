// Wave I: the Dock icon is drawn from the same markup as the CEO's face, with the token colours resolved.
import { describe, expect, it } from 'vitest'
import { avatarSvg, isDockIconPng } from '../../../shared/avatarSvg.ts'
import { resolvedAvatarSvg, TILE } from './dockIcon'

const tokens: Record<string, string> = {
  '--avatar-wave-0': '#D8EDEB', '--avatar-wave-1': '#438EA3', '--avatar-wave-2': '#BCD78C', '--avatar-wave-3': '#204451'
}

describe('the app icon is the CEO face', () => {
  it('draws the chosen character with its resolved colours, scaled onto the icon grid', () => {
    const svg = resolvedAvatarSvg({ seed: 42, style: 'wave' }, (t) => tokens[t] ?? '') ?? ''
    expect(svg).toContain('fill:#D8EDEB')
    expect(svg).toContain('fill:#204451')
    expect(svg).not.toContain('var(')
    const width = Number(/width="([\d.]+)"/.exec(svg)?.[1])
    expect(width * 116 / 120).toBeCloseTo(TILE, 5)
  })

  it('a different face is a different icon; the same face the same icon', () => {
    const read = (t: string): string => tokens[t] ?? '#000'
    expect(resolvedAvatarSvg({ seed: 42, style: 'wave' }, read)).toBe(resolvedAvatarSvg({ seed: 42, style: 'wave' }, read))
    expect(resolvedAvatarSvg({ seed: 43, style: 'wave' }, read)).not.toBe(resolvedAvatarSvg({ seed: 42, style: 'wave' }, read))
  })

  it('a token that does not resolve leaves the Dock alone rather than guessing a colour', () => {
    expect(resolvedAvatarSvg({ seed: 42, style: 'orbit' }, (t) => tokens[t] ?? '')).toBeNull()
  })

  it('a bad seed or a quote in a colour cannot break the markup', () => {
    const svg = avatarSvg(-1, ['"><script>', '#1', '#2', '#3'])
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('cx="38"')
  })

  it('the main process takes a bounded PNG data URL only', () => {
    expect(isDockIconPng('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
    expect(isDockIconPng('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false)
    expect(isDockIconPng('file:///etc/passwd')).toBe(false)
    expect(isDockIconPng(`data:image/png;base64,${'A'.repeat(4 * 1024 * 1024)}`)).toBe(false)
    expect(isDockIconPng(42)).toBe(false)
  })
})
