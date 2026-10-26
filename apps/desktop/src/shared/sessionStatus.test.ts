// A session's status from the signals Fabric already has (the operator's second review, 2026-10-26, v2 §4.5, R-19):
// observed first, the agent's own word second; the first that holds wins.
import { describe, expect, it } from 'vitest'
import { sessionStatus } from './sessionStatus.ts'

describe('sessionStatus', () => {
  it('is an error when a console ended with a failure or the agent says it is stuck', () => {
    expect(sessionStatus({ terminal: { state: 'ended', exitCode: 1 } })).toBe('error')
    expect(sessionStatus({ stale: false, phase: 'blocked' })).toBe('error')
  })
  it('is ended when the console ended cleanly', () => {
    expect(sessionStatus({ terminal: { state: 'ended', exitCode: 0 } })).toBe('ended')
  })
  it('is waiting when the agent says it waits, or its console stopped for input', () => {
    expect(sessionStatus({ stale: false, phase: 'waiting' })).toBe('waiting')
    expect(sessionStatus({ stale: false, terminal: { state: 'idle', exitCode: null } })).toBe('waiting')
  })
  it('is working with a recent sign, idle when it has gone quiet', () => {
    expect(sessionStatus({ stale: false, terminal: { state: 'running', exitCode: null } })).toBe('working')
    expect(sessionStatus({ stale: false })).toBe('working')
    expect(sessionStatus({ stale: true })).toBe('idle')
  })
})
