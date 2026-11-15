import { describe, expect, it } from 'vitest'
import { fingerprintInput, frameNames, messageTemplate } from './bugFingerprint'

const stack = (fns: string[]): string => ['Error: x', ...fns.map((f) => `    at ${f} (/Users/example/app/out/main/index.js:10:5)`)].join('\n')

describe('the bug fingerprint (W4 of the quality waves, the bug tracker §3.5)', () => {
  it('one bug with other numbers, ids, paths and versions gives one input', () => {
    const a = fingerprintInput({ cls: 'error', code: 'board.dispatch.started', errorName: 'Error', message: 'read of /Users/example/DATA/x/y.json failed after 3 tries (request 11111111-2222-3333-4444-555555555555, v0.3.20)', stack: stack(['readFile', 'startRun', 'pass']) })
    const b = fingerprintInput({ cls: 'error', code: 'board.dispatch.started', errorName: 'Error', message: 'read of /Users/example/work/z/q.json failed after 7 tries (request 99999999-8888-7777-6666-555555555555, v0.3.21)', stack: stack(['readFile', 'startRun', 'pass']) })
    expect(a).toBe(b)
  })
  it('other top frames give another input', () => {
    const base = { cls: 'error', code: 'c', errorName: 'TypeError', message: 'x is undefined' }
    expect(fingerprintInput({ ...base, stack: stack(['a', 'b', 'c']) })).not.toBe(fingerprintInput({ ...base, stack: stack(['a', 'b', 'd']) }))
  })
  it('a path, an e-mail, a URL and a token never reach the template', () => {
    const t = messageTemplate('POST https://api.example.com/v1?key=abc failed for ann@example.com with ghp_ABCDEFGHIJKLMNOPQRSTUVWX in /Users/example/secret/notes.txt and "quoted value"')
    for (const leak of ["example.com", "@example", 'ghp_', 'secret/notes', 'quoted value']) expect(t).not.toContain(leak)
    expect(t).toContain('<url>'); expect(t).toContain('<email>'); expect(t).toContain('<path>')
  })
  it('frames skip anonymous and runtime ones and keep three', () => {
    expect(frameNames(stack(['<anonymous>', 'process.processTicksAndRejections', 'one', 'two', 'three', 'four']))).toEqual(['one', 'two', 'three'])
    expect(frameNames(undefined)).toEqual([])
  })
})
