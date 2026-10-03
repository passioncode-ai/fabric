import { describe, expect, it } from 'vitest'
import { INSTRUCTIONS_MIN, NAME_MAX, agentNameTakenAtWrite, nameKey, nameTaken, readSpec, resolveServers } from './agentSpec.ts'

const ok = (over: Partial<Parameters<typeof readSpec>[0]> = {}) =>
  readSpec({
    name: 'Release watcher',
    instructions: 'Watch what ships and say what changed for a user.',
    runnerId: 'claude-code',
    ...over
  })

describe('reading an agent somebody described', () => {
  it('takes a name, a brief and a runner', () => {
    const v = ok()
    expect(v.ok && v.spec.name).toBe('Release watcher')
  })

  it('refuses a nameless agent and an over-long name', () => {
    expect(ok({ name: '  ' }).ok).toBe(false)
    expect(ok({ name: 'x'.repeat(NAME_MAX + 1) }).ok).toBe(false)
  })

  it('refuses a brief too short to act on', () => {
    // Not a style rule: "fix bugs" is an agent the operator will not recognise
    // in a week and the model cannot act on. The text IS the whole brief.
    const v = ok({ instructions: 'fix bugs' })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toContain(String(INSTRUCTIONS_MIN))
  })

  it('drops a duplicate server rather than refusing it', () => {
    // Asking twice is a typo, not a decision.
    const v = ok({ servers: ['linear', 'linear', ' linear '] })
    expect(v.ok && v.spec.servers).toEqual(['linear'])
  })

  it('refuses an agent with no program to run in', () => {
    expect(ok({ runnerId: '' }).ok).toBe(false)
  })
})

describe('what an agent may actually reach', () => {
  it('gives it what it ASKED for, not the whole ceiling', () => {
    // Least privilege is the point of asking. Handed the project's whole list,
    // every agent in the project would carry every credential the project has.
    const r = resolveServers(['linear'], ['linear', 'sentry', 'context7'])
    expect(r).toEqual({ ok: true, servers: ['linear'] })
  })

  it('REFUSES a request outside the ceiling rather than trimming it', () => {
    // The assertion with teeth. Trimmed, the agent starts without a tool it
    // declared, looks for it, does not find it, and improvises — the same
    // mid-run failure ADR-0034 refuses one level down.
    const r = resolveServers(['linear', 'sentry'], ['linear'])
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.refused).toEqual(['sentry'])
    expect(r.reason).toContain('sentry')
    expect(r.reason).toContain("project's settings")
  })

  it('names every server it refused, not just the first', () => {
    const r = resolveServers(['a', 'b', 'c'], ['b'])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.refused).toEqual(['a', 'c'])
  })

  it('an agent asking for nothing gets nothing, however much the project grants', () => {
    // The ceiling is not a default. An agent that declared no servers reaches
    // Fabric and nothing else, in a project that grants three.
    expect(resolveServers([], ['linear', 'sentry', 'context7'])).toEqual({ ok: true, servers: [] })
  })
})

describe('one agent per name in a project', () => {
  it('a name is taken across case and surrounding space, and an empty name takes nothing', () => {
    const existing = [{ name: 'Reviewer' }, { name: 'Planner ' }]
    expect(nameTaken(' reviewer', existing)).toBe(true)
    expect(nameTaken('PLANNER', existing)).toBe(true)
    expect(nameTaken('Reviewer 2', existing)).toBe(false)
    expect(nameTaken('   ', existing)).toBe(false)
    expect(nameTaken('Reviewer', [])).toBe(false)
  })

  // Release review iteration 3, finding 7: the database folds case with Unicode SIMPLE case mapping
  // (`lower(… collate pg_c_utf8)`, migration 73). The same pairs are asserted against the database in
  // apps/desktop/test/estate-identity-db.test.mjs and on the Supabase image in gateway-reads.test.mjs.
  it('folds case beyond ASCII exactly as the database rule does (simple case mapping, no context)', () => {
    expect(nameTaken('ärzt', [{ name: 'ÄRZT' }])).toBe(true)
    // JS `toLowerCase` folds a word-final Σ to ς; simple mapping (and the database) gives σ.
    expect(nameTaken('οδοσ', [{ name: 'ΟΔΟΣ' }])).toBe(true)
    // JS `toLowerCase` turns İ into two code points; simple mapping gives i.
    expect(nameTaken('i', [{ name: 'İ' }])).toBe(true)
    expect(nameKey(' ΟΔΟΣ ')).toBe('οδοσ')
    expect(nameKey('İSTANBUL')).toBe('istanbul')
  })
})

describe('a name taken between the read and the write (migration 72)', () => {
  it('recognises the write boundary refusing a taken name, in the journal\'s sentence', () => {
    expect(agentNameTakenAtWrite(new Error('append_event(agent.registered@1) failed: this project already has an agent called Scout'))).toBe(true)
  })
  it('never mistakes another failure for it', () => {
    expect(agentNameTakenAtWrite(new Error('append_event(agent.registered@1) failed: permission denied'))).toBe(false)
    expect(agentNameTakenAtWrite(new Error('append_event(task.created@1) failed: this project already has an agent called Scout'))).toBe(false)
    expect(agentNameTakenAtWrite(null)).toBe(false)
  })
})
