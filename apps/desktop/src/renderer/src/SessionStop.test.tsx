import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SessionStop, StopStatus } from './SessionStop'
import { I18nProvider } from './i18n'
import type { TerminalSession } from '../../shared/types'
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
const session={sessionId:'s',running:true,termination:undefined} as TerminalSession
function setup(over: Partial<TerminalSession> = {}, end=vi.fn().mockResolvedValue({sessionId:'s',state:'outcome_unknown',reasonCode:'termination_unproved'})) {
 const dismiss=vi.fn().mockResolvedValue(undefined),refresh=vi.fn()
 vi.stubGlobal('window',Object.assign(globalThis.window,{fabric:{terminal:{end,dismiss}}}))
 const view=render(<I18nProvider locale="en"><SessionStop session={{...session,...over}} refresh={refresh} onError={vi.fn()}/></I18nProvider>)
 return {end,dismiss,refresh,view}
}
describe('Stop control',()=>{
 it('keeps verified receipt after stale requested props or a failed refresh',async()=>{
  const f=setup({},vi.fn().mockResolvedValue({sessionId:'s',state:'stopped',reasonCode:'termination_observed',receiptSeq:12}))
  f.refresh.mockRejectedValue(Error('refresh offline'))
  fireEvent.click(screen.getByText('Stop execution'))
  await screen.findByText('Stop verified')
  f.view.rerender(<I18nProvider locale="en"><SessionStop session={{...session,termination:{sessionId:'s',state:'requested',reasonCode:'stop_requested'}}} refresh={f.refresh} onError={vi.fn()}/></I18nProvider>)
  expect(screen.getByText('Stop verified')).toBeTruthy()
  expect(screen.queryByRole('button',{name:'Stopping…'})).toBeNull()
 })
 it('authority refusal offers retry but not Force or dismissal',()=>{
  setup({termination:{sessionId:'s',state:'refused',reasonCode:'authority_changed'}})
  expect(screen.getByText('Check stop again')).toBeTruthy()
  expect(screen.queryByText('Force stop')).toBeNull()
  expect(screen.queryByText('Dismiss')).toBeNull()
 })

 // ADR-0160 §1 (0.3.7 wave 3): one press stops; no «are you sure» row. The stop is an act with its undo (start again).
 it('stops at once with one press, asks nothing, and does not claim success on unknown',async()=>{
  const f=setup();fireEvent.click(screen.getByText('Stop execution'))
  expect(screen.queryByText('Stop this execution? The task and its history remain.')).toBeNull()
  await screen.findByText('Stop unverified')
  expect(f.end).toHaveBeenCalledWith('s',{force:false});expect(screen.queryByText('Dismiss')).toBeNull()
  expect(screen.getByText('Check stop again')).toBeTruthy()
 })
 it('Force stop is one press too, with its explicit option',async()=>{
  const f=setup({running:false,termination:{sessionId:'s',state:'outcome_unknown',reasonCode:'pending'}})
  fireEvent.click(screen.getByText('Force stop'));await waitFor(()=>expect(f.end).toHaveBeenCalledWith('s',{force:true}))
  expect(screen.queryByText('Force this session to stop? Unsaved work may be lost.')).toBeNull()
 })
 it('IPC loss retains a recovery state',async()=>{
  setup({},vi.fn().mockRejectedValue(Error('lost')));fireEvent.click(screen.getByText('Stop execution'))
  await screen.findByText('Stop unverified');expect(screen.getByText('Check stop again')).toBeTruthy()
 })
 it('blocks repeat input while the request is pending',async()=>{
  const f=setup({},vi.fn(()=>new Promise(()=>{})));fireEvent.click(screen.getByText('Stop execution'))
  const button=screen.getByRole('button',{name:'Stopping…'}) as HTMLButtonElement
  expect(button.disabled).toBe(true);fireEvent.click(button);expect(f.end).toHaveBeenCalledTimes(1)
 })
 it('root exit alone offers recovery, not dismissal',()=>{
  setup({running:false});expect(screen.getByText('Stop execution')).toBeTruthy();expect(screen.queryByText('Dismiss')).toBeNull()
 })

 // OF-02 (the operator, 2026-10-19): a session whose process ended said «Stop unverified» and offered Force stop to a
 // process that was gone. It says it ended, with its exit code; the provider's background caveat stays, in words.
 it('a session whose process ended says so with its exit code, and offers no Force stop',()=>{
  const ended={running:false,exitCode:1,termination:{sessionId:'s',state:'outcome_unknown',reasonCode:'provider_termination_unproved'}} as Partial<TerminalSession>
  setup(ended)
  expect(screen.queryByText('Force stop')).toBeNull()
  expect(screen.queryByText('Stop execution')).toBeNull()
  expect(screen.getByText(/The agent's process ended/)).toBeTruthy()
  render(<I18nProvider locale="en"><StopStatus state={ended.termination!} session={{...session,...ended}}/></I18nProvider>)
  expect(screen.getByText('Session ended · exit 1')).toBeTruthy()
  expect(screen.queryByText('Stop unverified')).toBeNull()
 })

 // CO-327, ADR-0170: an ended managed run whose Stop is unknown offers «Work is over», which frees its task.
 it('offers «Work is over» for an ended run of a task, and settles the stop when it is said',async()=>{
  const ended={sessionId:'s',state:'outcome_unknown',reasonCode:'provider_termination_unproved',managed:true,taskId:'t',runId:'r',commandId:'c'} as const
  const attestOver=vi.fn().mockResolvedValue({...ended,state:'stopped',basis:'attested',reasonCode:'attested',receiptSeq:44})
  const f=setup({running:false,exitCode:0,termination:ended})
  Object.assign(window.fabric.terminal,{attestOver})
  fireEvent.click(screen.getByRole('button',{name:'Work is over'}))
  await waitFor(()=>expect(attestOver).toHaveBeenCalledWith('s'))
  await screen.findByText('Stop verified')
  expect(f.refresh).toHaveBeenCalled()
 })
 it('does not offer «Work is over» while the process runs, or for a session with no task run',()=>{
  setup({running:true,termination:{sessionId:'s',state:'outcome_unknown',reasonCode:'provider_termination_unproved',managed:true,taskId:'t',runId:'r',commandId:'c'}})
  expect(screen.queryByRole('button',{name:'Work is over'})).toBeNull()
  cleanup()
  setup({running:false,exitCode:0,termination:{sessionId:'s',state:'outcome_unknown',reasonCode:'provider_termination_unproved'}})
  expect(screen.queryByRole('button',{name:'Work is over'})).toBeNull()
 })
})
