import { describe, expect, it } from 'vitest'
import { classifyStartupFailure } from './startupFailure.ts'

/** Shapes MEASURED on this machine 2026-09-05, not imagined. */
const enoent = { message: 'spawnSync supabase ENOENT', code: 'ENOENT' }
const timedOut = { message: 'spawnSync supabase ETIMEDOUT', code: 'ETIMEDOUT' }
const startFailed = {
  message:
    'Command failed: supabase start\nfailed to inspect service: Cannot connect to the Docker daemon\n',
  status: 1
}
const schemaMissing = {
  message:
    "estates read failed: Could not find the table 'public.estates' in the schema cache (PGRST205)"
}

describe('why the app would not start', () => {
  it('names a missing command-line tool', () => {
    expect(classifyStartupFailure(enoent).cause).toBe('supabase-cli-missing')
  })

  it('does NOT confuse a slow start with a missing tool', () => {
    // Both arrive as `spawnSync supabase <CODE>`. Measured: a timeout is
    // ETIMEDOUT and a missing binary is ENOENT, and the remedies have nothing
    // in common — one is "install it", the other is "Docker is probably still
    // waking up". Matching the common prefix would tell an operator whose
    // Docker is slow that Supabase is not installed.
    expect(classifyStartupFailure(timedOut).cause).toBe('stack-start-timed-out')
  })

  it('recognises a timeout in its ASYNCHRONOUS shape too', () => {
    // Measured 2026-09-05, and it is nothing like the synchronous one. Moving
    // the start off the main thread (M101) changes what a timeout looks like:
    // `execFileSync` throws `spawnSync supabase ETIMEDOUT` with code ETIMEDOUT,
    // while the promisified `execFile` kills the child and reports
    // `Command failed: supabase start` with code NULL and `killed: true`.
    // Reading only the message would have silently downgraded a four-minute
    // timeout to "the stack refused to start" — a regression introduced by the
    // very change that fixed the blocking.
    const asyncTimeout = {
      message: 'Command failed: supabase start\n',
      code: null,
      killed: true,
      signal: 'SIGTERM'
    }
    expect(classifyStartupFailure(asyncTimeout).cause).toBe('stack-start-timed-out')
  })

  it('a child killed by a signal is not confused with one that exited badly', () => {
    // `killed` is what separates them: a non-zero exit carries the status, a
    // kill carries none.
    expect(
      classifyStartupFailure({ message: 'Command failed: supabase start\nboom', code: 1 }).cause
    ).toBe('stack-would-not-start')
  })

  it('names a stack that refused, and keeps the stack’s own words', () => {
    const f = classifyStartupFailure(startFailed)
    expect(f.cause).toBe('stack-would-not-start')
    expect(f.detail).toContain('Docker')
  })

  it('names missing migrations rather than a broken database', () => {
    // The database is up and answering. Saying "the database failed" would send
    // the operator to the wrong place entirely.
    expect(classifyStartupFailure(schemaMissing).cause).toBe('schema-missing')
  })

  it('names a repository it cannot find', () => {
    expect(
      classifyStartupFailure({
        message: 'Cannot locate the fabric repository (needed for the local Supabase stack). Set FABRIC_REPO.'
      }).cause
    ).toBe('repository-not-found')
  })

  it('names a stack that runs but says nothing', () => {
    expect(
      classifyStartupFailure({
        message: 'supabase status did not yield API_URL/SERVICE_ROLE_KEY (got: ANON_KEY)'
      }).cause
    ).toBe('stack-up-but-silent')
  })

  it('names a database that is simply not answering', () => {
    // Found by DRIVING the real path, not by reading code: with explicit
    // SUPABASE_URL pointing at a stopped stack, a genuine run produced
    // `estates read failed: TypeError: fetch failed` and landed in "unknown".
    // That is the commonest failure there is — the stack was stopped since the
    // app last worked — and "we could not work out why" is a poor answer to it.
    expect(
      classifyStartupFailure({ message: 'estates read failed: TypeError: fetch failed' }).cause
    ).toBe('database-unreachable')
    expect(
      classifyStartupFailure({ message: 'connect ECONNREFUSED 127.0.0.1:54321', code: 'ECONNREFUSED' })
        .cause
    ).toBe('database-unreachable')
  })

  it('names the identity refusal, and keeps the repair\'s reason in the details (0.3.4 i1 UX-1)', () => {
    // Before 0.3.4 this landed in "unknown": every fresh install showed "could not work out why" for a cause the
    // app had already named (CO-241). The repair's reason travels in the message, so the details carry it.
    const said = 'identity could not be established: that person is not a member of this estate' +
      ' — the repair for a database only the old seed touched did not apply: the estate has history after its creation'
    const f = classifyStartupFailure(new Error(said))
    expect(f.cause).toBe('identity-refused')
    expect(f.title).toBe('Fabric does not have access to the Estate it opened.')
    expect(f.detail).toContain('the estate has history after its creation')
    expect(classifyStartupFailure({ message: 'the identity of this build could not be established' }).cause).not.toBe('identity-refused')
  })

  it('an unrecognised failure is UNKNOWN and says so, rather than guessing', () => {
    // A wrong diagnosis costs more than an honest "we do not know": the
    // operator follows the remedy, it does not help, and they conclude the
    // product is broken in some deeper way.
    const f = classifyStartupFailure({ message: 'something nobody predicted' })
    expect(f.cause).toBe('unknown')
    expect(f.detail).toContain('something nobody predicted')
  })

  it('every classification carries a title and a remedy — never a bare code', () => {
    for (const e of [enoent, timedOut, startFailed, schemaMissing, { message: 'x' }]) {
      const f = classifyStartupFailure(e)
      expect(f.title.length).toBeGreaterThan(10)
      expect(f.remedy.length).toBeGreaterThan(10)
    }
  })

  it('survives an error that is not an Error at all', () => {
    // `catch (e)` catches whatever was thrown, including a string or null.
    expect(classifyStartupFailure(null).cause).toBe('unknown')
    expect(classifyStartupFailure('plain string').detail).toContain('plain string')
  })
})

import { startupDialog, type StartupCause } from './startupFailure.ts'

describe('what the operator is actually shown', () => {
  const f = classifyStartupFailure(enoent)

  it('leads with which precondition failed, not with a stack trace', () => {
    expect(startupDialog(f, { retryable: true, logPath: '/l/startup.log' }).message).toBe(f.title)
  })

  it('carries the remedy, the machine’s own words, and where the log is', () => {
    const d = startupDialog(f, { retryable: true, logPath: '/l/startup.log' })
    expect(d.detail).toContain(f.remedy)
    expect(d.detail).toContain('spawnSync supabase ENOENT')
    expect(d.detail).toContain('/l/startup.log')
  })

  it('offers Retry only when retrying is SAFE', () => {
    // Past `surface.start()` a retry would open a second listener and register
    // every IPC handler twice. The boundary is observed as bootstrap crosses
    // it, never inferred from the error — a failure we cannot place is a
    // failure we must not offer to repeat.
    expect(startupDialog(f, { retryable: true, logPath: '/l' }).buttons).toContain('Retry')
    expect(startupDialog(f, { retryable: false, logPath: '/l' }).buttons).not.toContain('Retry')
  })

  it('when a retry is unsafe it says so rather than leaving a silent gap', () => {
    const d = startupDialog(f, { retryable: false, logPath: '/l' })
    expect(d.detail.toLowerCase()).toContain('reopen')
  })

  it('always offers a way out and a way to copy', () => {
    for (const retryable of [true, false]) {
      const d = startupDialog(f, { retryable, logPath: '/l' })
      expect(d.buttons).toContain('Quit')
      expect(d.buttons.some((b) => /copy/i.test(b))).toBe(true)
      expect(d.defaultId).toBeGreaterThanOrEqual(0)
      expect(d.defaultId).toBeLessThan(d.buttons.length)
    }
  })
})

import { translator } from '../renderer/src/i18n/translate.ts'
import type { StringKey } from '../renderer/src/i18n/en.ts'

describe('the dialog in the operator’s language (0.3.3)', () => {
  const f = classifyStartupFailure(enoent)
  const ru = (key: string, vars?: Record<string, string | number>) => translator('ru')(key as StringKey, vars)

  it('speaks Russian when asked, title, remedy and buttons alike', () => {
    const d = startupDialog(f, { retryable: true, logPath: '/l', say: ru })
    expect(d.message).toBe(ru('startup.supabase-cli-missing.title'))
    expect(d.detail).toContain(ru('startup.supabase-cli-missing.remedy'))
    expect(d.detail).toContain(ru('startup.machineSaid'))
    expect(d.buttons).toEqual([ru('startup.retry'), ru('startup.copy'), ru('startup.quit')])
    expect(d.buttons.join(' ')).not.toMatch(/Retry|Quit|Copy/)
  })

  it('still carries the machine’s own words untranslated, because that is what a report is read in', () => {
    expect(startupDialog(f, { retryable: true, logPath: '/l', say: ru }).detail).toContain('spawnSync supabase ENOENT')
  })

  it('names what each button DOES index for index, so a translated label retries exactly as Retry did', () => {
    for (const retryable of [true, false]) {
      const d = startupDialog(f, { retryable, logPath: '/l', say: ru })
      expect(d.actions).toHaveLength(d.buttons.length)
      expect(d.actions).toEqual(retryable ? ['retry', 'copy', 'quit'] : ['copy', 'quit'])
      expect(d.actions[d.defaultId]).toBe(retryable ? 'retry' : 'quit')
    }
  })

  it('falls back to the cause’s own English for a cause the registry has no words for', () => {
    const odd = { ...f, cause: 'not-a-cause' as typeof f.cause, title: 'Own title', remedy: 'Own remedy' }
    const d = startupDialog(odd, { retryable: true, logPath: '/l', say: ru })
    expect(d.message).toBe('Own title')
    expect(d.detail).toContain('Own remedy')
  })
})

import { en } from '../renderer/src/i18n/en.ts'
import { ru as ruRegistry } from '../renderer/src/i18n/ru.ts'

describe('every startup cause has its words in both registries', () => {
  // A Record over the union, so a cause added to StartupCause without words fails to COMPILE here first.
  const every: Record<StartupCause, true> = { 'supabase-cli-missing': true, 'stack-start-timed-out': true, 'stack-would-not-start': true, 'stack-up-but-silent': true, 'repository-not-found': true, 'schema-missing': true, 'schema-not-ready': true, 'active-estate-unreadable': true, 'database-unreachable': true, unknown: true }
  for (const cause of Object.keys(every))
    it(cause, () => {
      for (const part of ['title', 'remedy'])
        for (const registry of [en, ruRegistry] as Record<string, string>[]) expect(registry[`startup.${cause}.${part}`], `${cause}.${part}`).toBeTruthy()
    })
})
