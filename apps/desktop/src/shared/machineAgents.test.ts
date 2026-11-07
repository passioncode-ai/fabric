// The agents of this machine, as every session reads them in fabric_whoami (the operator, 2026-11-07).
import { describe, expect, it } from 'vitest'
import { machineAgentsOf, MACHINE_AGENTS_LIMIT, type RegistryEntryLike } from './machineAgents.ts'

const entry = (key: string, over: Partial<RegistryEntryLike> = {}): RegistryEntryLike => ({
  key, kind: 'service', name: key, summary: `what ${key} does`, placement: 'local', origin: 'http://127.0.0.1:47000', ...over
})

describe('machineAgentsOf', () => {
  it('lists each agent by name with what it says it does, and where a remote one answers', () => {
    const got = machineAgentsOf({
      entries: [
        entry('apps-starter.default', { name: 'Apps Starter', summary: 'Scoped readiness and starts for explicitly enrolled installed projects.' }),
        entry('texts.cloud', { name: 'Texts', placement: 'remote', origin: 'https://texts.example' }),
        entry('media.default', { name: 'Media', summary: '   ' })
      ],
      problems: [{ code: 'unreadable' }]
    })
    expect(got.agents.map((a) => a.name)).toEqual(['Apps Starter', 'Media', 'Texts'])
    expect(got.agents[0]).toEqual({ key: 'apps-starter.default', name: 'Apps Starter', what: 'Scoped readiness and starts for explicitly enrolled installed projects.', kind: 'service', placement: 'local', origin: null })
    expect(got.agents[2].origin).toBe('https://texts.example')
    expect(got.agents[1].what).toBeNull()
    expect([got.more, got.refused]).toEqual([0, 1])
  })

  it('cuts a long summary and counts what is past the limit, never dropping it silently', () => {
    const many = Array.from({ length: MACHINE_AGENTS_LIMIT + 3 }, (_, i) => entry(`s${String(i).padStart(3, '0')}.default`, { summary: 'x'.repeat(400) }))
    const got = machineAgentsOf({ entries: many, problems: [] })
    expect(got.agents).toHaveLength(MACHINE_AGENTS_LIMIT)
    expect(got.more).toBe(3)
    expect(got.agents[0].what!.length).toBeLessThanOrEqual(160)
  })
})
