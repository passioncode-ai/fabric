import { describe, expect, it } from 'vitest'
import { mirrorEstate, parseMirror } from './mirror.ts'

const project = (over = {}) => ({
  id: 'b0000000-0000-4000-8000-000000000001',
  name: 'Fabric',
  purpose: null,
  repo_path: '/Users/example/DATA/fabric',
  status: 'active',
  memory_backend: 'local',
  default_agent: 'claude-code',
  mcp_servers: [] as string[],
  ...over
})

describe('reading a mirror back', () => {
  it('reads exactly what the writer wrote — the only round trip that matters', () => {
    const estate = {
      projects: [
        project(),
        project({
          id: 'c0000000-0000-4000-8000-000000000002',
          name: 'Other',
          purpose: 'ship: the thing — "fast"',
          mcp_servers: ['context7', 'linear']
        })
      ],
      agents: []
    }
    const files = mirrorEstate(estate)
    const read = parseMirror(files['workspace/projects.yaml'], 'projects')
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(read.rows).toHaveLength(2)
    expect(read.rows[0].name).toBe('Fabric')
    expect(read.rows[0].purpose).toBeNull()
    expect(read.rows[0].mcp_servers).toEqual([])
    expect(read.rows[1].purpose).toBe('ship: the thing — "fast"')
    expect(read.rows[1].mcp_servers).toEqual(['context7', 'linear'])
  })

  it('reads an empty estate as no rows, not as a failure', () => {
    const files = mirrorEstate({ projects: [], agents: [] })
    expect(parseMirror(files['workspace/projects.yaml'], 'projects')).toEqual({ ok: true, rows: [] })
  })

  it('reads agents back too', () => {
    const files = mirrorEstate({
      projects: [],
      agents: [
        {
          id: 'd0000000-0000-4000-8000-000000000001',
          project_id: 'b0000000-0000-4000-8000-000000000001',
          name: 'Release watcher',
          runner_id: 'claude-code',
          instructions: 'Watch what ships.',
          mcp_servers: ['linear'],
          permission_mode: null
        }
      ]
    })
    const read = parseMirror(files['workspace/agents.yaml'], 'agents')
    expect(read.ok && read.rows[0].name).toBe('Release watcher')
    expect(read.ok && read.rows[0].mcp_servers).toEqual(['linear'])
  })

  it('REFUSES the whole file on one line it does not understand, naming the line', () => {
    // The rule with teeth. A mirror is machine-written, so an unreadable line is
    // a hand edit or a newer format — and importing "most of it" silently drops
    // something the operator has. A refusal that names the line is recoverable.
    const files = mirrorEstate({ projects: [project()], agents: [] })
    const tampered = files['workspace/projects.yaml'].replace(
      'status: "active"',
      'status: active'
    )
    const read = parseMirror(tampered, 'projects')
    expect(read.ok).toBe(false)
    if (read.ok) return
    expect(read.reason).toMatch(/^line \d+:/)
    expect(read.reason).toContain('Nothing was imported')
  })

  it('refuses a line that is not a field at all, rather than skipping it', () => {
    // A separate branch from the one above, and it needed its own test: the
    // first plant against it PASSED, because a tampered VALUE still matches the
    // field pattern and was refused by a different check. A plant that passes
    // says the test does not reach the branch it was aimed at.
    const files = mirrorEstate({ projects: [project()], agents: [] })
    const tampered = files['workspace/projects.yaml'].replace(
      '    status: "active"',
      '    ???'
    )
    const read = parseMirror(tampered, 'projects')
    expect(read.ok).toBe(false)
    if (!read.ok) expect(read.reason).toContain('neither a field nor a list item')
  })

  it('refuses a file that is not the list it was asked for', () => {
    const files = mirrorEstate({ projects: [project()], agents: [] })
    expect(parseMirror(files['workspace/projects.yaml'], 'agents').ok).toBe(false)
  })
})
