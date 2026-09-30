// These assertions exercise the real prototype reducer/renderer, not runtime guarantees.
import test from 'node:test'
import assert from 'node:assert/strict'
import {pulseData,pulseDays,pulseStats,applyPulseAction,fabricAvatar,renderPulse,renderReleases} from '../product/pulse.mjs'
import {renderLaunch} from '../product/launch.mjs'

test('draft generation does not replace saved identity; save survives screen changes',()=>{
 const s={state:'ready'},d=pulseData(s),before=fabricAvatar(false,d.identity)
 applyPulseAction(s,'style','spark');applyPulseAction(s,'generate')
 assert.equal(fabricAvatar(false,d.identity),before)
 applyPulseAction(s,'save-avatar');const selected={...d.identity}
 assert.equal(selected.style,'spark');assert.notEqual(fabricAvatar(false,d.identity),before)
 assert.match(renderLaunch('launch-home',s),/data-avatar-style="spark"/)
 assert.match(renderLaunch('launch-agent',s),/data-avatar-style="spark"/)
 applyPulseAction(s,'style','wave');applyPulseAction(s,'skip-avatar')
 assert.deepEqual(d.identity,selected);assert.equal(d.draft.style,'spark')
})
test('unknown coverage stays unknown; period and type totals resolve to event IDs',()=>{
 const s={},d=pulseData(s)
 assert.equal(pulseDays(d).find(x=>x.date==='2026-09-02').known,false)
 applyPulseAction(s,'kind','decision');applyPulseAction(s,'period','7')
 const days=pulseDays(d);assert.equal(days.length,7)
 assert(days.flatMap(x=>x.events).every(x=>x.kind==='decision'))
 assert.equal(new Set(days.flatMap(x=>x.events).map(x=>x.id)).size,days.reduce((n,x)=>n+x.events.length,0))
 assert(pulseDays(d,'studio').flatMap(x=>x.events).every(x=>x.project==='studio'))
})
test('pausing and incoming heartbeat never inflate progress or apply unseen batches',()=>{
 const s={},d=pulseData(s),before=pulseStats(d)
 applyPulseAction(s,'pause');applyPulseAction(s,'incoming')
 assert.equal(d.pending,1);assert.equal(d.update,0);assert.deepEqual(pulseStats(d),before)
 applyPulseAction(s,'apply');assert.equal(d.pending,0);assert.equal(d.update,1)
 applyPulseAction(s,'connection');assert.match(renderPulse(s),/Соединение потеряно/)
 assert.deepEqual(pulseStats(d),before)
})
test('avatar cannot be saved through a stale or conflicting screen',()=>{
 const s={state:'conflict'};const html=renderLaunch('launch-persona',s)
 assert.match(html,/data-pulse="save-avatar"[^>]*disabled/)
 assert.match(html,/Ваш текст остаётся|Источник изменился/)
})
test('release publication alone is visibly unverified; project scope cannot borrow Atlas facts',()=>{
 const s={};applyPulseAction(s,'release-project','studio')
 assert.match(renderReleases(s),/Проверка результата ещё не получена/)
 const html=renderPulse({scope:'project',project:'studio'})
 assert(!html.includes('Claude Code'));assert(!html.includes('Утренний обзор'))
 assert.match(html,/Текущее состояние источника неизвестно/)
})
