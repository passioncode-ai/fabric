// Editor recovery in the window (ADR-0106 amendment): the unsaved buffer is kept as the person types,
// offered back on the next open, and restoring never overwrites a file that changed on disk.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from './i18n'

// Monaco cannot run in jsdom; a stand-in editor exposes exactly what the window uses.
const editors: Array<{ value: string; listeners: Array<() => void>; getValue: () => string; setValue: (v: string) => void }> = []
vi.mock('monaco-editor', () => {
  const create = (_host: unknown, opts: { value: string }) => {
    const ed = {
      value: opts.value,
      listeners: [] as Array<() => void>,
      getValue() { return ed.value },
      setValue(v: string) { ed.value = v; for (const l of ed.listeners) l() },
      onDidChangeModelContent(l: () => void) { ed.listeners.push(l); return { dispose() {} } },
      addCommand() {}, focus() {}, dispose() {}
    }
    editors.push(ed)
    return ed
  }
  return {
    editor: { create, createDiffEditor: () => ({ setModel() {}, getModel: () => null, dispose() {} }), createModel: () => ({ dispose() {} }), defineTheme() {} },
    KeyMod: { CtrlCmd: 0 }, KeyCode: { KeyS: 0 }
  }
})
vi.mock('monaco-editor/editor/editor.worker?worker', () => ({ default: class {} }))
vi.mock('monaco-editor/language/json/json.worker?worker', () => ({ default: class {} }))
vi.mock('monaco-editor/language/css/css.worker?worker', () => ({ default: class {} }))
vi.mock('monaco-editor/language/html/html.worker?worker', () => ({ default: class {} }))
vi.mock('monaco-editor/language/typescript/ts.worker?worker', () => ({ default: class {} }))

const { EditorWindow } = await import('./EditorWindow')

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); editors.length = 0 })

function bridge(kept: { content: string; baseHash: string; at: string } | null) {
  const files = {
    read: vi.fn(async () => ({ path: '/repo/a.ts', name: 'a.ts', content: 'on disk', hash: 'h-disk', language: 'typescript' })),
    write: vi.fn(), requestOverwrite: vi.fn(), openExternally: vi.fn(async () => ({ ok: true })),
    recoveryRead: vi.fn(async () => kept),
    recoveryKeep: vi.fn(async () => ({ kept: true })),
    recoveryFlush: vi.fn()
  }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { files } }))
  return files
}
const mount = () => render(<I18nProvider locale="en"><EditorWindow filePath="/repo/a.ts" /></I18nProvider>)

describe('editor recovery', () => {
  it('offers a kept buffer back and restores it into the editor when the file is unchanged', async () => {
    const files = bridge({ content: 'my unsaved work', baseHash: 'h-disk', at: '2026-10-03T12:00:00Z' })
    mount()
    expect(await screen.findByText(/Unsaved changes from .* were kept/)).toBeTruthy()
    await waitFor(() => expect(editors.length).toBe(1))
    fireEvent.click(screen.getByRole('button', { name: 'Restore them' }))
    expect(editors[0].getValue()).toBe('my unsaved work')
    expect(files.recoveryKeep).not.toHaveBeenCalledWith('/repo/a.ts', null, 'h-disk')
  })

  it('says the file changed on disk and does not write the kept buffer into the editor directly', async () => {
    bridge({ content: 'my unsaved work', baseHash: 'h-older', at: '2026-10-03T12:00:00Z' })
    mount()
    expect(await screen.findByText(/has changed on disk since/)).toBeTruthy()
    await waitFor(() => expect(editors.length).toBe(1))
    fireEvent.click(screen.getByRole('button', { name: 'Restore them' }))
    expect(editors[0].getValue()).toBe('on disk')
  })

  it('discarding the kept buffer removes it', async () => {
    const files = bridge({ content: 'my unsaved work', baseHash: 'h-disk', at: '2026-10-03T12:00:00Z' })
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Discard them' }))
    expect(files.recoveryKeep).toHaveBeenCalledWith('/repo/a.ts', null, 'h-disk')
    expect(screen.queryByText(/were kept/)).toBeNull()
  })

  it('keeps the buffer a moment after the person stops typing, and discards it when the buffer is clean again', async () => {
    const files = bridge(null)
    mount()
    await waitFor(() => expect(editors.length).toBe(1))
    vi.useFakeTimers()
    act(() => editors[0].setValue('typed'))
    expect(files.recoveryKeep).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(800) })
    expect(files.recoveryKeep).toHaveBeenCalledWith('/repo/a.ts', 'typed', 'h-disk')
    act(() => editors[0].setValue('on disk'))
    act(() => { vi.advanceTimersByTime(800) })
    expect(files.recoveryKeep).toHaveBeenLastCalledWith('/repo/a.ts', null, 'h-disk')
  })
})
