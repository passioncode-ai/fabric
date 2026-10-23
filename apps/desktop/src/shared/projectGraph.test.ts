import { describe, expect, it } from 'vitest'
import { aroundProject, composeGraph } from './projectGraph'

const projects = [
  { id: 'a', name: 'fabric', summary: 'The CEO agent', business: 'PassionCode', repo_path: '/w/fabric' },
  { id: 'b', name: 'Agent Contract', summary: null, business: 'PassionCode ', repo_path: '/w/fabric-agent-contract' },
  { id: 'c', name: 'site', summary: null, business: null, repo_path: null }
]

describe('how the projects relate (OF-32, SCN-175)', () => {
  it('matches a relation to a project by name or repository folder, and draws one that matches none as outside', () => {
    const g = composeGraph({ projects, relations: [
      { project_id: 'a', kind: 'depends-on', target: 'fabric-agent-contract' },
      { project_id: 'a', kind: 'used-by', target: 'Some Service' },
      { project_id: 'a', kind: 'depends-on', target: 'FABRIC-agent-contract' }
    ], threads: [] })
    expect(g.edges).toEqual([{ from: 'a', to: 'b', kind: 'depends-on' }, { from: 'a', to: 'outside:some service', kind: 'used-by' }])
    expect(g.nodes.find((n) => n.id === 'outside:some service')).toMatchObject({ name: 'Some Service', outside: true })
    expect(g.businesses).toEqual(['PassionCode'])
  })

  it('joins the projects of each board thread, weighted by its messages, and ignores projects it does not know', () => {
    const g = composeGraph({ projects, relations: [], threads: [
      { participants: ['a', 'b', 'gone'], messageCount: 3 },
      { participants: ['b', 'a'], messageCount: 2 },
      { participants: ['c'], messageCount: 9 }
    ] })
    expect(g.edges).toEqual([{ from: 'a', to: 'b', kind: 'board', weight: 5 }])
  })

  it('centred on a project, keeps it and its neighbours only', () => {
    const g = composeGraph({ projects, relations: [{ project_id: 'a', kind: 'talks-to', target: 'site' }], threads: [] })
    expect(aroundProject(g, 'c').nodes.map((n) => n.id).sort()).toEqual(['a', 'c'])
    expect(aroundProject(g, 'b').nodes.map((n) => n.id)).toEqual(['b'])
    expect(aroundProject(g, null)).toBe(g)
  })
})
