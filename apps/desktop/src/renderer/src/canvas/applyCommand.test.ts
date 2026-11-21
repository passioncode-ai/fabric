// ADR-0201: a command applied in the canvas window, over a fake Excalidraw (the real one is checked in a browser at
// stage 6 of the run): names found or said back, names kept unique, arrows bound to both ends, a highlight that takes
// itself back without touching a colour the person chose meanwhile.
import { describe, expect, it } from 'vitest'
import { HIGHLIGHT_STROKE } from '../../../shared/canvas'
import { applyCommand, edgePoint, textsOf, type CanvasApi, type CanvasLib, type El } from './applyCommand'

function fake(elements: El[] = []) {
  let scene = elements
  const looked: unknown[] = []
  const later: Array<() => void> = []
  const api: CanvasApi = {
    getSceneElements: () => scene,
    updateScene: ({ elements: next }) => { if (next) scene = [...next] },
    scrollToContent: (target) => { looked.push(target) }
  }
  // Excalidraw's converter, reduced to what this file relies on: one element per skeleton, ids kept, a label a text.
  const lib: CanvasLib = {
    convert: (sk) => sk.flatMap((s) => {
      const el = { x: 0, y: 0, width: 100, height: 50, ...s, label: undefined } as unknown as El
      const label = (s.label as { text?: string } | undefined)?.text
      return label ? [{ ...el, boundElements: [{ id: `${el.id}-t`, type: 'text' }] }, { id: `${el.id}-t`, type: 'text', text: label, containerId: el.id, x: 0, y: 0, width: 1, height: 1 }] : [el]
    }),
    patch: (el, p) => ({ ...el, ...p }),
    capture: { immediately: 'now', never: 'never' },
    nonce: () => 'k',
    later: (fn) => { later.push(fn) }
  }
  return { api, lib, scene: () => scene, looked, later }
}

const shape = (id: string, text: string, fabricId?: string, x = 0): El[] => [
  { id, type: 'rectangle', x, y: 0, width: 200, height: 80, boundElements: [{ id: `${id}-t`, type: 'text' }], ...(fabricId ? { customData: { fabricId } } : {}) },
  { id: `${id}-t`, type: 'text', text, containerId: id, x, y: 0, width: 1, height: 1 }
]

describe('applyCommand', () => {
  it('draws a diagram beside what the canvas holds, renaming a name already taken, and looks at it', () => {
    const f = fake(shape('r1', 'Оплата', 'call'))
    const a = applyCommand(f.api, f.lib, { op: 'draw', diagram: { nodes: [{ id: 'call', text: 'Звонок', kind: 'box' }, { id: 'ceo', text: 'CEO', kind: 'box' }], edges: [{ from: 'call', to: 'ceo' }], tour: [{ node: 'call', say: 'Начало' }] } })
    expect(a.ok).toBe(true)
    expect(a.drawn).toEqual(['call-2', 'ceo'])
    expect(a.tour).toEqual([{ node: 'call-2', say: 'Начало' }])
    const made = f.scene().filter((e) => e.id.startsWith('fx-k-'))
    expect(made.map((e) => e.id)).toContain('fx-k-call-2')
    expect(Math.min(...made.filter((e) => e.type === 'rectangle').map((e) => e.x))).toBeGreaterThan(200)
    expect(f.looked.at(-1)).toHaveLength(made.length)
  })

  it('a diagram main did not check is checked here: a node without words draws nothing', () => {
    const f = fake()
    const a = applyCommand(f.api, f.lib, { op: 'draw', diagram: { nodes: [{ id: 'a', text: '', kind: 'box' }], edges: [] } })
    expect(a.ok).toBe(false)
    expect(f.scene()).toEqual([])
  })

  it('connects two elements found by their words with an arrow bound to both', () => {
    const f = fake([...shape('r1', 'Оплата'), ...shape('r2', 'Доставка', undefined, 400)])
    const a = applyCommand(f.api, f.lib, { op: 'connect', from: 'оплата', to: 'доставка', label: 'потом' })
    expect(a).toEqual({ ok: true, drawn: ['r1->r2'] })
    const arrow = f.scene().find((e) => e.type === 'arrow')!
    expect(arrow.startBinding).toMatchObject({ elementId: 'r1' })
    expect(arrow.endBinding).toMatchObject({ elementId: 'r2' })
    expect(f.scene().find((e) => e.id === 'r1')!.boundElements).toContainEqual({ id: arrow.id, type: 'arrow' })
    expect(f.scene().find((e) => e.id === 'r2')!.boundElements).toContainEqual({ id: arrow.id, type: 'arrow' })
    expect(f.scene().filter((e) => e.id === 'r1')).toHaveLength(1)
  })

  it('a name that matches nothing is said back with the names that exist, and nothing changes', () => {
    const f = fake(shape('r1', 'Оплата'))
    const before = f.scene()
    const a = applyCommand(f.api, f.lib, { op: 'highlight', target: 'склад' })
    expect(a.ok).toBe(false)
    expect(a.unresolved).toEqual([{ name: 'склад', candidates: ['Оплата'] }])
    expect(f.scene()).toBe(before)
  })

  it('a highlight outlines the element and takes the outline back by itself, unless the person recoloured it', () => {
    const f = fake([{ ...shape('r1', 'Оплата')[0]!, strokeColor: '#1e1e1e', strokeWidth: 2 }, shape('r1', 'Оплата')[1]!])
    applyCommand(f.api, f.lib, { op: 'highlight', target: 'Оплата' })
    expect(f.scene()[0]!.strokeColor).toBe(HIGHLIGHT_STROKE)
    f.later.shift()!()
    expect(f.scene()[0]).toMatchObject({ strokeColor: '#1e1e1e', strokeWidth: 2 })
    applyCommand(f.api, f.lib, { op: 'highlight', target: 'Оплата' })
    f.api.updateScene({ elements: f.scene().map((e) => (e.id === 'r1' ? { ...e, strokeColor: '#1971c2' } : e)) })
    f.later.shift()!()
    expect(f.scene()[0]!.strokeColor).toBe('#1971c2')
  })

  it('adds a note linked from an element, and removes an element with its words', () => {
    const f = fake(shape('r1', 'Канвас', 'canvas'))
    const a = applyCommand(f.api, f.lib, { op: 'add', node: { id: '', text: 'Проверить цену', kind: 'note' }, connectFrom: 'canvas' })
    expect(a).toEqual({ ok: true, drawn: ['n1'] })
    expect(f.scene().some((e) => e.type === 'arrow' && (e.startBinding as { elementId: string }).elementId === 'r1')).toBe(true)
    const r = applyCommand(f.api, f.lib, { op: 'remove', target: 'canvas' })
    expect(r).toEqual({ ok: true, removed: ['canvas'] })
    expect(f.scene().filter((e) => e.id === 'r1' || e.id === 'r1-t').every((e) => e.isDeleted)).toBe(true)
  })

  it('names every text a command draws, for the font to load first, and finds where a line leaves a box', () => {
    expect(textsOf({ op: 'draw', diagram: { nodes: [{ id: 'a', text: 'A', kind: 'box' }], edges: [{ from: 'a', to: 'a', label: 'L' }] } })).toEqual(['A', 'L'])
    expect(textsOf({ op: 'focus' })).toEqual([])
    expect(edgePoint({ x: 0, y: 0, width: 100, height: 50 }, { x: 300, y: 25 })).toEqual({ x: 100, y: 25 })
    expect(edgePoint({ x: 0, y: 0, width: 100, height: 50 }, { x: 50, y: 25 })).toEqual({ x: 50, y: 25 })
  })
})
