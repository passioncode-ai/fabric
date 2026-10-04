// Execute by copying this fixture into apps/desktop/src/renderer/src/_i3-review.test.tsx.
import {afterEach,expect,it,vi} from 'vitest'
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react'
import {AgentAccessPanel} from './AgentAccessPanel'
import {I18nProvider} from './i18n'
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals()})
const defer=()=>{let resolve:any;const promise=new Promise<any>(r=>resolve=r);return {promise,resolve}}
const ov=(connected:boolean)=>({hub:{listening:true,origin:'http://127.0.0.1:47070'},products:[{product:'fabric-inbox',name:'Fabric Inbox',connection:connected?{server:'https://inbox.example.com',level:'admin',connectedAt:'2026-10-03T00:00:00Z',keyExpiresAt:null}:null,lastAttempt:null}],pending:[],agents:[],denials:[]})
it('independent: a delayed pre-disconnect poll cannot replace the post-disconnect reading',async()=>{vi.useFakeTimers();const reads=[defer(),defer(),defer()];let i=0;vi.stubGlobal('window',Object.assign(window,{fabric:{hub:{overview:vi.fn(()=>reads[i++].promise),disconnect:vi.fn(async()=>({ok:true}))}}}));render(<I18nProvider locale="en"><AgentAccessPanel onClose={()=>{}}/></I18nProvider>);await act(async()=>reads[0].resolve(ov(true)));await act(async()=>vi.advanceTimersByTime(4000));fireEvent.click(screen.getByRole('button',{name:'Disconnect'}));await act(async()=>{});await act(async()=>reads[2].resolve(ov(false)));expect(screen.getByRole('button',{name:'Connect'})).toBeTruthy();await act(async()=>reads[1].resolve(ov(true)));console.log(JSON.stringify({case:'late-poll-after-disconnect',buttons:[...document.querySelectorAll('button')].map(x=>x.textContent)}));expect(screen.queryByRole('button',{name:'Reconnect'})).toBeNull()})
