// PL-1, DA-1, DO-2 (0.3.14 review, iteration 2): a piece filed by a session that was not launched on a task is linked
// from the session's one live claim in the project; none or several link nothing and say why.
import { describe, expect, it } from 'vitest'
import { spawnedChainFrom, spawnParentOf } from './spawnParent'
import { mayChain } from './loopBound'

describe('spawnParentOf', () => {
  // CO-466: a launched session that claims one other task here, and not its own, works on that task now.
  it('a launched session holding one other claim here links from the claimed task, and says why', () => {
    const spawn = spawnParentOf('t-launch', 'p1', [{ work_id: 't-other', project_id: 'p1' }])
    expect(spawn).toMatchObject({ parent: 't-other', from: 'claim' })
    expect(spawn.why).toMatch(/t-other, the task this session claims.*not t-launch, the task Fabric launched it on/)
  })

  it('a launched session links from its own task otherwise: no claim, a claim on it, several, another project, or claims unread', () => {
    const launch = { parent: 't-launch', from: 'launch', why: null }
    expect(spawnParentOf('t-launch', 'p1', [])).toEqual(launch)
    expect(spawnParentOf('t-launch', 'p1', [{ work_id: 't-launch', project_id: 'p1' }, { work_id: 't-other', project_id: 'p1' }])).toEqual(launch)
    expect(spawnParentOf('t-launch', 'p1', [{ work_id: 'a', project_id: 'p1' }, { work_id: 'b', project_id: 'p1' }])).toEqual(launch)
    expect(spawnParentOf('t-launch', 'p1', [{ work_id: 't-other', project_id: 'p2' }])).toEqual(launch)
    expect(spawnParentOf('t-launch', 'p1', null, 'deadline')).toEqual(launch)
  })

  it('an enrolled session (no launch task) with exactly one live claim links from that claim', () => {
    expect(spawnParentOf(null, 'p1', [{ work_id: 't-request', project_id: 'p1' }])).toEqual({ parent: 't-request', from: 'claim', why: null })
  })

  it('a claim in another project is not a parent (link_tasks refuses cross-project links)', () => {
    expect(spawnParentOf(null, 'p1', [{ work_id: 't-a', project_id: 'p1' }, { work_id: 't-b', project_id: 'p2' }]).parent).toBe('t-a')
  })

  it('no live claim: no link, and the answer says why', () => {
    const r = spawnParentOf(null, 'p1', [])
    expect(r.parent).toBeNull()
    expect(r.why).toMatch(/^no single claimed task/)
    expect(r.why).toMatch(/fabric_task_link/)
  })

  it('several live claims: no link, and the answer says why', () => {
    const r = spawnParentOf(null, 'p1', [{ work_id: 't-a', project_id: 'p1' }, { work_id: 't-b', project_id: 'p1' }])
    expect(r.parent).toBeNull()
    expect(r.why).toMatch(/2 live claims/)
  })

  it('a claims read that failed links nothing and names the failure', () => {
    const r = spawnParentOf(null, 'p1', null, 'timeout')
    expect(r.parent).toBeNull()
    expect(r.why).toMatch(/could not be read \(timeout\)/)
  })
})

// ER-24, DA-8 (iteration 3): the chain bound's read is walked a task at a time and its error is kept.
describe('spawnedChainFrom', () => {
  const links: Record<string, string> = { c3: 'c2', c2: 'c1', c1: 'req' }
  const read = (fail: string | null = null) => async (id: string) =>
    fail && id === fail ? { parents: [], failed: 'deadline' } : { parents: links[id] ? [links[id]] : [], failed: null }

  it('walks up from the parent and the bound judges the depth (the fourth hand-off in one chain is refused)', async () => {
    const walk = await spawnedChainFrom(read(), 'c3', 5)
    expect(walk).toEqual({ from: { c3: ['c2'], c2: ['c1'], c1: ['req'] }, failed: null })
    expect(mayChain(walk.from, 'c3')).toMatchObject({ ok: false, depth: 4, bound: 4 })
  })

  it('a failed hop is named, never read as the top of the chain', async () => {
    const walk = await spawnedChainFrom(read('c2'), 'c3', 5)
    expect(walk.failed).toBe('deadline')
  })

  it('reads at most `hops` links and stops at a cycle', async () => {
    let reads = 0
    const cyclic = async (id: string) => { reads++; return { parents: [id === 'a' ? 'b' : 'a'], failed: null } }
    const walk = await spawnedChainFrom(cyclic, 'a', 5)
    expect(reads).toBe(2)
    expect(mayChain(walk.from, 'a').ok).toBe(false)
    let long = 0
    await spawnedChainFrom(async (id) => { long++; return { parents: [id + 'x'], failed: null } }, 't', 5)
    expect(long).toBe(5)
  })

  // CO-468: a task with several `spawned` parents. The first one alone was followed, so a longer chain or a cycle
  // through another parent went uncounted.
  const graph = (links: Record<string, string[]>) => async (id: string) => ({ parents: links[id] ?? [], failed: null })

  it('follows every parent, and the longest way back decides the bound', async () => {
    // c3 came from a (short) and from b2, which is three hand-offs deep: the short parent sorts first.
    const walk = await spawnedChainFrom(graph({ c3: ['a', 'b2'], b2: ['b1'], b1: ['b0'] }), 'c3', 5)
    expect(walk.from).toEqual({ c3: ['a', 'b2'], b2: ['b1'], b1: ['b0'] })
    expect(mayChain(walk.from, 'c3')).toMatchObject({ ok: false, depth: 4 })
  })

  it('refuses a cycle that runs through a second parent', async () => {
    const walk = await spawnedChainFrom(graph({ t: ['a', 'z'], z: ['t'] }), 't', 5)
    expect(mayChain(walk.from, 't')).toMatchObject({ ok: false })
    expect(mayChain(walk.from, 't').reason).toMatch(/descends from itself/)
  })

  it('a chain wider than its read budget is unread, never judged short', async () => {
    const wide: Record<string, string[]> = { t: Array.from({ length: 10 }, (_, i) => `p${i}`) }
    for (let i = 0; i < 10; i++) wide[`p${i}`] = [`q${i}`]
    const walk = await spawnedChainFrom(graph(wide), 't', 5, 5)
    expect(walk.failed).toMatch(/more than 5 tasks/)
  })
})

describe('stageTaskOf (the mockup parity: a stage report names the session\'s one live claim)', () => {
  it('names the launch task, else the one claim in this project, else nothing', async () => {
    const { stageTaskOf } = await import('./spawnParent')
    expect(stageTaskOf('launch', 'p1', [])).toBe('launch')
    expect(stageTaskOf(null, 'p1', [{ work_id: 't1', project_id: 'p1' }, { work_id: 't9', project_id: 'p2' }])).toBe('t1')
    expect(stageTaskOf(null, 'p1', [{ work_id: 't1', project_id: 'p1' }, { work_id: 't2', project_id: 'p1' }])).toBeNull()
    expect(stageTaskOf(null, 'p1', null, 'away')).toBeNull()
  })
})
