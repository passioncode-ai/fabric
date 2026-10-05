// Editor recovery in the window (ADR-0106 amendment): the unsaved buffer is kept as the person types,
// offered back on the next open, and restoring never overwrites a file that changed on disk.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from './i18n'

// Monaco cannot run in jsdom; a stand-in editor exposes exactly what the window uses.
const editors: Array<{ value: string; readOnly: boolean; listeners: Array<() => void>; getValue: () => string; setValue: (v: string) => void; save?: () => void; disposed: boolean }> = []
vi.mock('monaco-editor', () => {
  const create = (_host: unknown, opts: { value: string }) => {
    const ed = {
      value: opts.value,
      readOnly: false,
      disposed: false,
      save: undefined as undefined | (() => void),
      listeners: [] as Array<() => void>,
      updateOptions(o: { readOnly?: boolean }) { if (o.readOnly !== undefined) ed.readOnly = o.readOnly },
      getValue() { return ed.value },
      setValue(v: string) { ed.value = v; for (const l of ed.listeners) l() },
      onDidChangeModelContent(l: () => void) { ed.listeners.push(l); return { dispose() {} } },
      addCommand(_k: number, run: () => void) { ed.save = run }, focus() {}, dispose() { ed.disposed = true }
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

function bridge(kept: { content: string; baseHash: string; at: string } | null, text = true) {
  const files = {
    read: vi.fn(async () => ({ path: '/repo/a.ts', name: 'a.ts', content: text ? 'on disk' : '', text, hash: 'h-disk', language: 'typescript' })),
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

  it('the editor is read-only until the person chooses, so typing can never overwrite the kept buffer', async () => {
    const files = bridge({ content: 'my unsaved work', baseHash: 'h-disk', at: '2026-10-03T12:00:00Z' })
    mount()
    await screen.findByText(/were kept/)
    await waitFor(() => expect(editors.length).toBe(1))
    await waitFor(() => expect(editors[0].readOnly).toBe(true))
    vi.useFakeTimers()
    act(() => editors[0].setValue('typed before choosing'))
    act(() => { vi.advanceTimersByTime(800) })
    expect(files.recoveryKeep).not.toHaveBeenCalled()
    vi.useRealTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Discard them' }))
    await waitFor(() => expect(editors[0].readOnly).toBe(false))
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

// Audit 2026-10-05: A4-001 (P0), A2-002, A2-003, A2-004.
describe('editor saves', () => {
  it('a file that is not text opens with no editor and no save, so it can never be written back', async () => {
    const files = bridge(null, false)
    mount()
    expect(await screen.findByText(/This file is not text/)).toBeTruthy()
    expect(editors.length).toBe(0)
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(files.recoveryRead).not.toHaveBeenCalled()
    expect(files.write).not.toHaveBeenCalled()
  })

  it('Cmd+S on an untouched buffer writes nothing', async () => {
    const files = bridge(null)
    mount()
    await waitFor(() => expect(editors.length).toBe(1))
    await act(async () => { editors[0].save?.() })
    expect(files.write).not.toHaveBeenCalled()
  })

  it('a save keeps the same editor, and what was typed while it was in flight stays and stays unsaved', async () => {
    const files = bridge(null)
    let land: (r: unknown) => void = () => {}
    files.write.mockImplementation(() => new Promise((r) => { land = r }))
    mount()
    await waitFor(() => expect(editors.length).toBe(1))
    act(() => editors[0].setValue('first'))
    await act(async () => { editors[0].save?.() })
    expect(files.write).toHaveBeenCalledWith('/repo/a.ts', 'first', 'h-disk', undefined)
    act(() => editors[0].setValue('first and more'))
    await act(async () => { land({ ok: true, hash: 'h-first' }) })
    expect(editors.length).toBe(1)
    expect(editors[0].disposed).toBe(false)
    expect(editors[0].getValue()).toBe('first and more')
    expect(screen.getByText('unsaved')).toBeTruthy()
    // The next save presents the hash of what was written, not of what was first read.
    files.write.mockResolvedValue({ ok: true, hash: 'h-more' })
    await act(async () => { editors[0].save?.() })
    expect(files.write).toHaveBeenLastCalledWith('/repo/a.ts', 'first and more', 'h-first', undefined)
  })

  it('a conflict focuses its sentence, not a button, and "Keep mine" presents the disk version it showed', async () => {
    const files = bridge(null)
    files.write.mockResolvedValueOnce({ ok: false, reason: 'changed-on-disk', current: 'agent text', currentHash: 'h-agent' })
    files.requestOverwrite.mockResolvedValue({ grantId: 'g-1', expiresAt: '2026-10-05T23:59:00Z' })
    mount()
    await waitFor(() => expect(editors.length).toBe(1))
    act(() => editors[0].setValue('mine'))
    await act(async () => { editors[0].save?.() })
    const sentence = await screen.findByText(/changed on disk while you were editing/)
    expect(document.activeElement).toBe(sentence)
    expect(document.activeElement?.tagName).not.toBe('BUTTON')
    files.write.mockResolvedValueOnce({ ok: true, hash: 'h-mine' })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Keep mine and save' })) })
    // The diff stand-in has no model, so the content comes from the buffer the conflict was raised with.
    expect(files.write).toHaveBeenLastCalledWith('/repo/a.ts', 'mine', 'h-agent', 'g-1')
    await waitFor(() => expect(editors.length).toBe(2))
    expect(editors[1].getValue()).toBe('mine')
  })

  it('taking the disk version starts a clean editor from the disk text', async () => {
    const files = bridge(null)
    files.write.mockResolvedValueOnce({ ok: false, reason: 'changed-on-disk', current: 'agent text', currentHash: 'h-agent' })
    mount()
    await waitFor(() => expect(editors.length).toBe(1))
    act(() => editors[0].setValue('mine'))
    await act(async () => { editors[0].save?.() })
    fireEvent.click(await screen.findByRole('button', { name: 'Take the version on disk' }))
    await waitFor(() => expect(editors.length).toBe(2))
    expect(editors[1].getValue()).toBe('agent text')
    expect(screen.queryByText('unsaved')).toBeNull()
    expect(files.recoveryKeep).toHaveBeenLastCalledWith('/repo/a.ts', null, 'h-agent')
  })
})
