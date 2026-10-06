// 0.3.2 verification UX-5, UX-6, ER-5: the conflict path keeps what was typed while a save was in flight,
// says when the file was deleted rather than changed, and never runs two saves at once.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from './i18n'
import { en } from './i18n/en'

type Ed = { value: string; listeners: Array<() => void>; getValue: () => string; setValue: (v: string) => void; save?: () => void }
const editors: Ed[] = []
const diffs: Array<{ original: string; modified: string }> = []
const liveDiffs: Array<{ modified: { value: string; getValue: () => string } }> = []
vi.mock('monaco-editor', () => {
  const create = (_host: unknown, opts: { value: string }) => {
    const ed = {
      value: opts.value, listeners: [] as Array<() => void>, save: undefined as undefined | (() => void),
      updateOptions() {}, getValue() { return ed.value },
      setValue(v: string) { ed.value = v; for (const l of ed.listeners) l() },
      onDidChangeModelContent(l: () => void) { ed.listeners.push(l); return { dispose() {} } },
      addCommand(_k: number, run: () => void) { ed.save = run }, focus() {}, dispose() {}
    }
    editors.push(ed)
    return ed
  }
  const createModel = (value: string) => { const m = { value, getValue: () => m.value, dispose() {} }; return m }
  const createDiffEditor = () => {
    let model: { original: { value: string }; modified: { value: string; getValue: () => string } } | null = null
    return {
      setModel(m: typeof model) { model = m; diffs.push({ original: m!.original.value, modified: m!.modified.value }); liveDiffs.push(m as never) },
      getModel: () => model,
      dispose() {}
    }
  }
  return { editor: { create, createDiffEditor, createModel, defineTheme() {} }, KeyMod: { CtrlCmd: 0 }, KeyCode: { KeyS: 0 } }
})

const { EditorWindow } = await import('./EditorWindow')

afterEach(() => { cleanup(); vi.unstubAllGlobals(); editors.length = 0; diffs.length = 0; liveDiffs.length = 0 })

function bridge(write: (...a: unknown[]) => Promise<unknown>, kept: { content: string; baseHash: string; at: string } | null = null) {
  const files = {
    read: vi.fn(async () => ({ path: '/repo/a.ts', name: 'a.ts', content: 'hello', text: true, hash: 'h-disk', language: 'typescript' })),
    write: vi.fn(write), requestOverwrite: vi.fn(async () => ({ grantId: 'g' })), openExternally: vi.fn(),
    recoveryRead: vi.fn(async () => kept), recoveryKeep: vi.fn(async () => ({ kept: true })), recoveryFlush: vi.fn()
  }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { files } }))
  return files
}
const mount = () => render(<I18nProvider locale="en"><EditorWindow filePath="/repo/a.ts" /></I18nProvider>)
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>((r) => { resolve = r }); return { promise, resolve } }

describe('the conflict path', () => {
  it('what was typed while the conflicting save was in flight is on the person\'s side of the diff', async () => {
    const answer = deferred<unknown>()
    bridge(() => answer.promise)
    mount()
    await waitFor(() => expect(editors.length).toBe(1))
    act(() => editors[0].setValue('hello\nmine'))
    act(() => editors[0].save!())
    act(() => editors[0].setValue('hello\nmine TYPED-WHILE-SAVING'))
    await act(async () => answer.resolve({ ok: false, reason: 'changed-on-disk', current: 'agent', currentHash: 'h-agent' }))
    await waitFor(() => expect(diffs.length).toBe(1))
    expect(diffs[0]).toEqual({ original: 'agent', modified: 'hello\nmine TYPED-WHILE-SAVING' })
  })

  it('a file deleted while open says so, and offers to close or to save it again', async () => {
    bridge(async () => ({ ok: false, reason: 'changed-on-disk', current: '', currentHash: 'absent' }))
    mount()
    await waitFor(() => expect(editors.length).toBe(1))
    act(() => editors[0].setValue('hello again'))
    await act(async () => editors[0].save!())
    expect(await screen.findByText(en['editor.deletedOnDisk'])).toBeTruthy()
    expect(screen.getByRole('button', { name: en['editor.saveAgain'] })).toBeTruthy()
    expect(screen.getByRole('button', { name: en['editor.closeDeleted'] })).toBeTruthy()
    expect(screen.queryByText(en['editor.conflict'])).toBeNull()
    // 0.3.2 verification UX-10: closing without saving closes; the unsaved-changes guard does not ask again.
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('button', { name: en['editor.closeDeleted'] }))
    expect(close).toHaveBeenCalledTimes(1)
    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(false)
  })

  it('a second save while the first is in flight writes nothing', async () => {
    const answer = deferred<unknown>()
    const files = bridge(() => answer.promise)
    mount()
    await waitFor(() => expect(editors.length).toBe(1))
    act(() => editors[0].setValue('hello\nmine'))
    act(() => editors[0].save!())
    act(() => editors[0].save!())
    await act(async () => answer.resolve({ ok: true, hash: 'h-mine' }))
    expect(files.write).toHaveBeenCalledTimes(1)
    fireEvent.click(document.body)
  })

  // 0.3.2 verification ER-1: "Keep mine" leaves the diff's side editable while the save is in flight.
  it('typing into the diff during a Keep mine save stays unsaved and kept for recovery', async () => {
    const files = bridge(async () => ({ ok: false, reason: 'changed-on-disk', current: 'agent', currentHash: 'h-agent' }))
    mount()
    await waitFor(() => expect(editors.length).toBe(1))
    act(() => editors[0].setValue('hello mine'))
    await act(async () => editors[0].save!())
    await waitFor(() => expect(liveDiffs.length).toBe(1))
    const answer = deferred<unknown>()
    files.write.mockImplementation(() => answer.promise)
    fireEvent.click(screen.getByRole('button', { name: en['editor.takeMine'] }))
    await waitFor(() => expect(files.write).toHaveBeenCalledTimes(2))
    liveDiffs[0].modified.value = 'hello mine AND MORE'
    await act(async () => answer.resolve({ ok: true, hash: 'h-mine' }))
    expect(files.recoveryKeep).toHaveBeenLastCalledWith('/repo/a.ts', 'hello mine AND MORE', 'h-mine')
    await waitFor(() => expect(editors.length).toBe(2))
    expect(editors[1].getValue()).toBe('hello mine AND MORE')
  })

  // 0.3.2 verification UX-1: restoring a kept buffer over a file that changed on disk shows the KEPT text.
  it('restoring a kept buffer over a changed file puts the kept text on the person\'s side of the diff', async () => {
    bridge(async () => ({ ok: true, hash: 'x' }), { content: 'my kept work', baseHash: 'h-older', at: '2026-10-06T12:00:00Z' })
    mount()
    await screen.findByText(/has changed on disk since/)
    await waitFor(() => expect(editors.length).toBe(1))
    fireEvent.click(screen.getByRole('button', { name: 'Restore them' }))
    await waitFor(() => expect(diffs.length).toBe(1))
    expect(diffs[0]).toEqual({ original: 'hello', modified: 'my kept work' })
  })
})
