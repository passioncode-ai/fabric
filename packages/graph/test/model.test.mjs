// @fabric/graph's model: neighbours both ways to a depth, time order with undated last, agents folded between people's
// commands, groups in first-seen order, and edges to unknown nodes dropped and counted.
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const { neighbours, byTime, collapseAgents, groupsOf, joined } = await import(path.resolve(import.meta.dirname, '../src/model.ts'))

const data = {
  nodes: [
    { id: 'a', kind: 'decision', label: 'A', at: '2026-11-20T10:00:00Z', actor: 'person', group: 'x' },
    { id: 'b', kind: 'task', label: 'B', at: '2026-11-20T09:00:00Z', actor: 'agent', group: 'y' },
    { id: 'c', kind: 'task', label: 'C', actor: 'agent', group: 'x' },
    { id: 'd', kind: 'session', label: 'D', at: '2026-11-20T11:00:00Z', actor: 'ceo' }
  ],
  edges: [{ from: 'a', to: 'b', kind: 'caused' }, { from: 'c', to: 'b', kind: 'spawned' }, { from: 'd', to: 'zz', kind: 'answered' }]
}

test('neighbours walks both ways to the depth asked and never invents an unknown node', () => {
  assert.deepEqual(neighbours(data, 'a', 1).map((x) => [x.node.id, x.hop]), [['a', 0], ['b', 1]])
  assert.deepEqual(neighbours(data, 'a', 2).map((x) => [x.node.id, x.hop]), [['a', 0], ['b', 1], ['c', 2]])
  assert.deepEqual(neighbours(data, 'd', 3).map((x) => x.node.id), ['d'], 'the edge to zz leads nowhere')
  assert.deepEqual(neighbours(data, 'nope'), [])
})

test('time order is oldest first and an undated node goes last', () => {
  assert.deepEqual(byTime(data).map((n) => n.id), ['b', 'a', 'd', 'c'])
})

test('agents between people\'s commands fold into one item that keeps them', () => {
  const items = collapseAgents(byTime(data))
  assert.deepEqual(items.map((i) => (i.kind === 'node' ? i.node.id : `folded:${i.nodes.map((n) => n.id).join('')}`)), ['folded:b', 'a', 'folded:dc'])
})

test('groups come in first-seen order with the ungrouped as an empty name', () => {
  assert.deepEqual(groupsOf(data.nodes), ['x', 'y', ''])
})

test('an edge to an unknown node is dropped and counted', () => {
  const j = joined(data)
  assert.equal(j.dropped, 1)
  assert.equal(j.edges.length, 2)
})
