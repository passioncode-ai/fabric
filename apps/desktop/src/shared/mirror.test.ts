import { describe, expect, it } from 'vitest'
import { compareMirror, mirrorEstate, type Estate } from './mirror.ts'

const project = (over: Partial<Estate['projects'][number]> = {}) => ({
  id: 'b0000000-0000-4000-8000-000000000001',
  name: 'Fabric',
  purpose: null,
  repo_path: '/Users/example/DATA/fabric',
  status: 'active',
  memory_backend: 'local',
  default_agent: 'claude-code',
  mcp_servers: [],
  ...over
})

const estate = (over: Partial<Estate> = {}): Estate => ({
  projects: [project()],
  agents: [],
  ...over
})

describe('the workspace mirror', () => {
  it('is BYTE-IDENTICAL for the same estate given in a different order', () => {
    // The rule that fails invisibly. A mirror that reorders makes every write a
    // diff and `git blame` answer "everything changed, by whoever saved last" —
    // which looks like it works and destroys the only reason to have it.
    const a = project({ id: 'a0000000-0000-4000-8000-000000000001', name: 'A' })
    const b = project({ id: 'c0000000-0000-4000-8000-000000000001', name: 'B' })
    expect(mirrorEstate({ projects: [a, b], agents: [] })).toEqual(
      mirrorEstate({ projects: [b, a], agents: [] })
    )
  })

  it('sorts a server list, so re-ticking two boxes in the other order is not a change', () => {
    const one = mirrorEstate(estate({ projects: [project({ mcp_servers: ['linear', 'context7'] })] }))
    const two = mirrorEstate(estate({ projects: [project({ mcp_servers: ['context7', 'linear'] })] }))
    expect(one).toEqual(two)
  })

  it('NAMES its fields and never spreads a row', () => {
    // The security assertion. A column added later — a token, a cached
    // credential — must not reach the operator's git history because somebody
    // widened a select. The allowlist holds by default, not by review.
    const leaky = { ...project(), session_token: 'sk-do-not-mirror-me' }
    const files = mirrorEstate({ projects: [leaky], agents: [] })
    expect(JSON.stringify(files)).not.toContain('sk-do-not-mirror-me')
    expect(JSON.stringify(files)).not.toContain('session_token')
  })

  it('quotes a purpose that would break a hand-rolled writer', () => {
    // These are the exact strings a bad escaper corrupts, and they are the
    // operator's own words.
    const nasty = 'ship: the thing — "fast", C:\\path, #1'
    const files = mirrorEstate(estate({ projects: [project({ purpose: nasty })] }))
    expect(files['workspace/projects.yaml']).toContain(JSON.stringify(nasty))
  })

  it('writes an empty estate as empty lists rather than as nothing', () => {
    // Absent and zero are different, and a file that is simply missing reads as
    // "Fabric has not run" rather than "this estate has no projects".
    const files = mirrorEstate({ projects: [], agents: [] })
    expect(files['workspace/projects.yaml']).toContain('projects: []')
    expect(files['workspace/agents.yaml']).toContain('agents: []')
  })

  it('mirrors an agent with its instructions and reach', () => {
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
    expect(files['workspace/agents.yaml']).toContain('"Release watcher"')
    expect(files['workspace/agents.yaml']).toContain('- "linear"')
    expect(files['workspace/agents.yaml']).toContain('permission_mode: null')
  })
})

describe('comparing the workspace with the estate', () => {
  it('says nothing when they agree', () => {
    expect(compareMirror(mirrorEstate(estate()), estate())).toEqual([])
  })

  it('reports a file that is missing', () => {
    const d = compareMirror({}, estate())
    expect(d.map((x) => x.path).sort()).toEqual(['workspace/agents.yaml', 'workspace/projects.yaml'])
  })

  it('says the FILE is out of date, not the estate — the database is the store', () => {
    // ADR-0002 asks for a gate and does not say which side wins. Saying it here
    // stops the question being answered differently by whoever hits it first.
    const stale = { ...mirrorEstate(estate()), 'workspace/projects.yaml': 'projects: []\n' }
    const [d] = compareMirror(stale, estate())
    expect(d.reason).toContain('the estate is the store')
  })

  it('reports a file Fabric does not write, rather than ignoring it', () => {
    const extra = { ...mirrorEstate(estate()), 'workspace/notes.yaml': 'x' }
    const d = compareMirror(extra, estate())
    expect(d).toHaveLength(1)
    expect(d[0].path).toBe('workspace/notes.yaml')
  })
})
