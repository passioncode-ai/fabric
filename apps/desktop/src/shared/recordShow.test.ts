import { describe, expect, it } from 'vitest'
import { callText, ceoText, duePieces, inboxFileName, isTarget, noteBody, referencedFiles, refusalOf, rewritePaths, saidIn } from './recordShow'

const TASK = 'task:3e306fa7-6a33-4221-8590-56daaa007d16'

describe('record show delivery (SCN-188)', () => {
  it('knows the two targets and refuses anything else', () => {
    expect(isTarget('ceo')).toBe(true)
    expect(isTarget(TASK)).toBe(true)
    expect(isTarget('task:../../etc')).toBe(false)
    expect(isTarget('board')).toBe(false)
    expect(isTarget(null)).toBe(false)
  })

  it('reads the script exit codes as refusals', () => {
    expect(refusalOf(3)).toBe('permission-screen')
    expect(refusalOf(4)).toBe('permission-microphone')
    expect(refusalOf(5)).toBe('already')
    expect(refusalOf(7)).toBe('not-recording')
    expect(refusalOf(1)).toBe('failed')
    expect(refusalOf(null)).toBe('failed')
  })

  it('names ready chunks and shots not yet delivered, oldest first', () => {
    const due = duePieces({
      name: 's',
      deliver: 'ceo',
      chunkFiles: ['chunk-001.md', 'chunk-000.md', 'context.md'],
      shots: [
        { at: 40, file: 'shots/b.png' },
        { at: 10, file: 'shots/a.png', deliver: TASK }
      ],
      delivered: ['chunk-000.md']
    })
    expect(due).toEqual([
      { key: 'chunk-001.md', kind: 'chunk', to: 'ceo', file: 'chunk-001.md', index: 1 },
      { key: 'shot:shots/a.png', kind: 'shot', to: TASK, file: 'shots/a.png' },
      { key: 'shot:shots/b.png', kind: 'shot', to: 'ceo', file: 'shots/b.png' }
    ])
  })

  it('delivers nothing from a session with no target, except shots that name their own', () => {
    const due = duePieces({
      name: 's',
      deliver: null,
      chunkFiles: ['chunk-000.md'],
      shots: [{ at: 1, file: 'shots/a.png' }, { at: 2, file: 'shots/b.png', deliver: 'ceo' }, { at: 3, file: '../x.png', deliver: 'ceo' }],
      delivered: []
    })
    expect(due.map((d) => d.key)).toEqual(['shot:shots/b.png'])
  })

  it('rewrites frame and shot paths to absolute copies and lists each once', () => {
    const md = 'кадр: frames/c000-00m04s-4.0.jpg и снова frames/c000-00m04s-4.0.jpg, снимок shots/shot-1.png. Пути к кадрам и снимкам даны от папки этого файла; открой'
    expect(referencedFiles(md)).toEqual(['frames/c000-00m04s-4.0.jpg', 'shots/shot-1.png'])
    const out = rewritePaths(md, (rel) => `/inbox/${inboxFileName('2026-11-19_19-44-49_demo', rel)}`)
    expect(out).toContain('/inbox/show-2026-11-19_19-44-49_demo-frames-c000-00m04s-4.0.jpg')
    expect(out).toContain('/inbox/show-2026-11-19_19-44-49_demo-shots-shot-1.png')
    expect(out).toContain('Пути к кадрам и снимкам полные')
    expect(inboxFileName('a b/../c', 'frames/x.jpg')).not.toMatch(/[/ ]/)
  })

  it('writes the CEO line and the call line in Russian and English with no em dash', () => {
    const texts = [
      ceoText({ kind: 'chunk', index: 1, start: 45, end: 90 }, 'ru'),
      ceoText({ kind: 'chunk', index: 1 }, 'en'),
      ceoText({ kind: 'shot' }, 'ru'),
      callText({ kind: 'chunk', to: 'ceo', index: 0, said: 'Вот тут смотри' }, 'ru'),
      callText({ kind: 'shot', to: 'ceo' }, 'en')
    ]
    expect(texts[0]).toContain('кусок 2 (00:45–01:30)')
    expect(texts[3]).toContain('«Вот тут смотри»')
    for (const t of texts) expect(t).not.toContain('—')
  })

  it('takes the words of one chunk from the manifest and cuts them', () => {
    const manifest = { items: [{ kind: 'chunk', index: 0, lines: [{ text: ' Вот тут ' }, { text: 'смотри' }] }, { kind: 'shot' }] }
    expect(saidIn(manifest, 0)).toBe('Вот тут смотри')
    expect(saidIn(manifest, 3)).toBe('')
    expect(saidIn({ items: [{ kind: 'chunk', index: 0, lines: [{ text: 'а'.repeat(500) }] }] }, 0, 10)).toHaveLength(10)
    expect(saidIn(null, 0)).toBe('')
    expect(noteBody('x'.repeat(10), 5)).toBe('xxxxx\n\n…')
  })
})
