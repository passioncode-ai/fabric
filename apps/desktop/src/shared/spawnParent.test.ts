// PL-1, DA-1, DO-2 (0.3.14 review, iteration 2): a piece filed by a session that was not launched on a task is linked
// from the session's one live claim in the project; none or several link nothing and say why.
import { describe, expect, it } from 'vitest'
import { spawnParentOf } from './spawnParent'

describe('spawnParentOf', () => {
  it('a launched session links from its own task, whatever it claims', () => {
    expect(spawnParentOf('t-launch', 'p1', [{ work_id: 't-other', project_id: 'p1' }])).toEqual({ parent: 't-launch', from: 'launch', why: null })
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
