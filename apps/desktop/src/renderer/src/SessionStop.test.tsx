import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SessionStop } from './SessionStop'
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
  fireEvent.click(screen.getByText('Stop execution'));fireEvent.click(screen.getByText('Stop execution'))
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

 it('confirms a normal Stop and does not claim success on unknown',async()=>{
  const f=setup();fireEvent.click(screen.getByText('Stop execution'));expect(f.end).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Stop execution'));await screen.findByText('Stop unverified')
  expect(f.end).toHaveBeenCalledWith('s',{force:false});expect(screen.queryByText('Dismiss')).toBeNull()
  expect(screen.getByText('Check stop again')).toBeTruthy()
 })
 it('needs a separate Force confirmation and explicit option',async()=>{
  const f=setup({running:false,termination:{sessionId:'s',state:'outcome_unknown',reasonCode:'pending'}})
  fireEvent.click(screen.getByText('Force stop'));expect(f.end).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Force stop'));await waitFor(()=>expect(f.end).toHaveBeenCalledWith('s',{force:true}))
 })
 it('IPC loss retains a recovery state',async()=>{
  setup({},vi.fn().mockRejectedValue(Error('lost')));fireEvent.click(screen.getByText('Stop execution'));fireEvent.click(screen.getByText('Stop execution'))
  await screen.findByText('Stop unverified');expect(screen.getByText('Check stop again')).toBeTruthy()
 })
 it('blocks repeat input while the request is pending',async()=>{
  const f=setup({},vi.fn(()=>new Promise(()=>{})));fireEvent.click(screen.getByText('Stop execution'));fireEvent.click(screen.getByText('Stop execution'))
  const button=screen.getByRole('button',{name:'Stopping…'}) as HTMLButtonElement
  expect(button.disabled).toBe(true);fireEvent.click(button);expect(f.end).toHaveBeenCalledTimes(1)
 })
 it('root exit alone offers recovery, not dismissal',()=>{
  setup({running:false});expect(screen.getByText('Stop execution')).toBeTruthy();expect(screen.queryByText('Dismiss')).toBeNull()
 })
})
