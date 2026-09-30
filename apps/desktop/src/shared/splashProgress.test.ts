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
