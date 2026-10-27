import { describe, expect, it } from 'vitest'
import { splashProgress, PATIENCE_MS } from './splashProgress.ts'

const at = (seconds: number, last?: string | null): string =>
  splashProgress({ elapsedMs: seconds * 1000, lastLine: last ?? null })

describe('what the splash says while the stack starts', () => {
  it('says what is happening before it says how long', () => {
    // Measured: the renderer does not run its page AT ALL while the main thread
    // is blocked (+6387ms against a block ending at +6328ms), so until M101
    // this text was never on screen at any point. The first second is the one
    // it now has to earn.
    expect(at(0)).toMatch(/starting/i)
  })

  it('shows elapsed time once a wait is long enough to be doubted', () => {
    expect(at(2)).not.toMatch(/\d+s/)
    expect(at(12)).toMatch(/12s/)
  })

  it('past the point of patience it says the wait is EXPECTED, not that it is stuck', () => {
    // A first-ever start pulls container images. Silence here is what makes a
    // person force-quit a process that was working.
    const late = at(PATIENCE_MS / 1000 + 5)
    expect(late).toMatch(/first/i)
  })

  it('shows the stack’s own last line when there is one', () => {
    expect(at(20, 'Pulling supabase/postgres')).toContain('Pulling supabase/postgres')
  })

  it('never lets one long line become the whole window', () => {
    const long = 'x'.repeat(400)
    expect(at(20, long).length).toBeLessThan(200)
  })

  it('ignores a blank line rather than showing an empty gap', () => {
    expect(at(20, '   ')).toBe(at(20, null))
  })

  it('is plain text — a splash renders it into HTML and must not be a hole', () => {
    // The text is written into the page by the main process. A stack that
    // prints a tag would otherwise be able to put markup on the screen.
    expect(at(20, '<img src=x onerror=alert(1)>')).not.toContain('<')
  })
})

describe('the splash speaks the interface\'s language (CO-306, SCN-161)', () => {
  const ru = (seconds: number, last: string | null = null): string => splashProgress({ elapsedMs: seconds * 1000, lastLine: last, locale: 'ru' })

  it('says what is happening, how long and that a first run is slow, in Russian', () => {
    expect(ru(0)).toBe('Запускаю локальную базу')
    expect(ru(12)).toBe('Запускаю локальную базу · 12 с')
    expect(ru(PATIENCE_MS / 1000 + 5)).toMatch(/Первый запуск скачивает образы и идёт долго$/)
  })

  it('says Fabric\'s own notes in the person\'s language, and passes the stack\'s own words through', () => {
    expect(ru(6, 'Waiting for Docker to answer (8 s)')).toMatch(/Жду ответа Docker \(8 с\)$/)
    expect(ru(6, 'The stack is still starting, try 2 of 4')).toMatch(/База ещё запускается, попытка 2 из 4$/)
    expect(ru(6, 'Pulling supabase/postgres')).toMatch(/Pulling supabase\/postgres$/)
    expect(at(6, 'The stack is still starting, try 2 of 4')).toMatch(/try 2 of 4$/)
  })

  it('carries no dash between its parts, in either language', () => {
    for (const s of [at(PATIENCE_MS / 1000 + 5, 'line'), ru(PATIENCE_MS / 1000 + 5, 'line')]) expect(s).not.toMatch(/—/)
  })
})

describe('CO-294: Fabric starting Docker\'s own app', () => {
  it('says which app it starts, in the person\'s language', () => {
    expect(splashProgress({ elapsedMs: 0, lastLine: 'Starting OrbStack', locale: 'ru' })).toMatch(/Запускаю OrbStack$/)
    expect(splashProgress({ elapsedMs: 0, lastLine: 'Starting Docker Desktop', locale: 'ru' })).toMatch(/Запускаю Docker Desktop$/)
    expect(splashProgress({ elapsedMs: 0, lastLine: 'Starting OrbStack' })).toMatch(/Starting OrbStack$/)
  })
})
