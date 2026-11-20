// @fabric/graph's views in the window: the time line folds agents' steps between people's commands and opens them in
// place, lanes by group, states said in words; the table lists the same nodes by group; the layout is the same on every
// run and keeps groups apart.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GraphTable, GraphTimeline, type GraphData } from '.'
import { layout } from './layout'

afterEach(cleanup)

const data: GraphData = {
  nodes: [
    { id: 'd1', kind: 'decision', label: 'Owner: build Memory', at: '2026-11-20T10:00:00Z', actor: 'person', state: 'done', group: 'memory' },
    { id: 't1', kind: 'task', label: 'Index passes', at: '2026-11-20T10:10:00Z', actor: 'agent', state: 'done', group: 'memory' },
    { id: 't2', kind: 'task', label: 'Draw the map', at: '2026-11-20T10:20:00Z', actor: 'agent', state: 'open', group: 'memory' },
    { id: 'd2', kind: 'decision', label: 'Owner: one graph module', at: '2026-11-20T11:00:00Z', actor: 'person', state: 'waiting', group: 'graph' }
  ],
  edges: [{ from: 'd1', to: 't1', kind: 'caused' }, { from: 't1', to: 't2', kind: 'spawned' }]
}
const words = {
  folded: (n: number) => `agents: ${n} steps`, actor: (a: string) => a, state: (s: string) => `state ${s}`, lane: (g: string) => `lane ${g || 'none'}`, when: (at: string) => at.slice(11, 16)
}

describe('GraphTimeline', () => {
  it('folds the agents\' steps between people\'s commands and opens them in place', () => {
    render(<GraphTimeline data={data} onlyPeople words={words} />)
    expect(screen.getByText('Owner: build Memory')).toBeTruthy()
    expect(screen.queryByText('Index passes')).toBeNull()
    const fold = screen.getByRole('button', { name: 'agents: 2 steps' })
    expect(fold.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(fold)
    expect(screen.getByText('Index passes')).toBeTruthy()
    expect(screen.getByText('state waiting')).toBeTruthy()
  })

  it('draws a lane per group when asked', () => {
    render(<GraphTimeline data={data} groupBy="group" words={words} />)
    expect(screen.getByRole('region', { name: 'lane memory' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'lane graph' })).toBeTruthy()
  })
})

describe('GraphTable', () => {
  it('lists the nodes by group and opens one by its name', () => {
    let picked = ''
    render(<GraphTable data={data} caption="Decisions" groupTitle={(g) => `group ${g}`} onPick={(n) => { picked = n.id }} pickLabel={(n) => `open ${n.label}`}
      columns={[{ key: 'label', title: 'What', value: (n) => n.label }, { key: 'links', title: 'Links', value: (_n, d) => String(d), numeric: true }]} />)
    expect(screen.getByText('group memory')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'open Index passes' }))
    expect(picked).toBe('t1')
  })
})

describe('layout', () => {
  it('places the same data the same way every time, every node finite', () => {
    const a = layout(data, 80), b = layout(data, 80)
    for (const n of data.nodes) {
      expect(a.get(n.id)).toEqual(b.get(n.id))
      expect(Number.isFinite(a.get(n.id)!.x) && Number.isFinite(a.get(n.id)!.y)).toBe(true)
    }
  })
})
