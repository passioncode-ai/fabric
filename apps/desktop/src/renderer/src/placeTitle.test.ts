import { describe, expect, it } from 'vitest'
import { projectPlaceTitle } from './placeTitle'
import { en } from './i18n/en'

const t = ((key: string, vars?: Record<string, string | number>): string => {
  let s: string = (en as Record<string, string>)[key]
  for (const [k, v] of Object.entries(vars ?? {})) s = s.replace(`{${k}}`, String(v))
  return s
}) as unknown as Parameters<typeof projectPlaceTitle>[2]

describe('the top bar names a project place (SP-1; 0.3.20 iteration 3 run three, UX-60)', () => {
  it('names Pulse and Releases, with the project when opened for one', () => {
    expect(projectPlaceTitle('pulse', null, t)).toBe(en['launch.pulse.open'])
    expect(projectPlaceTitle('releases', null, t)).toBe(en['launch.releases.list'])
    expect(projectPlaceTitle('pulse', 'AdOps', t)).toBe(en['rail.placeOf'].replace('{place}', en['launch.pulse.open']).replace('{project}', 'AdOps'))
    expect(projectPlaceTitle('board', 'AdOps', t)).toContain('AdOps')
  })
})
