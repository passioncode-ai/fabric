import assert from 'node:assert/strict';import {fixture} from './fixture-fixed.mjs';
let positive=0,negative=0;
async function check(at,stamp,expected){const f=fixture({existing:true});f.wall=at;await f.publisher.configure();f.rpcHook=(_n,args)=>{f.row.observed={...args.p_observed};f.row.observed_at=stamp;return {data:true,error:null}};const r=await f.publisher.publish();assert.equal(r.state,expected,stamp);assert.equal(r.executionAuthorized,false);if(expected==='published')positive++;else{negative++;assert.equal((await f.publisher.publish()).reason,'reconcile_required');assert.equal(f.writes.length,1)}}
for(let offset=-840;offset<=840;offset+=15){const sign=offset<0?'-':'+';const n=Math.abs(offset),zone=sign+String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');const stamp=new Date(1000+offset*60000).toISOString().replace('Z',zone);await check(1000,stamp,'published')}
await check(Date.parse('2024-02-29T00:00:01Z'),'2024-02-29T02:00:01+02:00','published');
await check(Date.parse('2026-03-02T00:00:01Z'),'2026-02-30T02:00:01+02:00','unknown');
await check(Date.parse('2026-01-02T00:00:00Z'),'2026-01-01T24:00:00+00:00','unknown');
for(const stamp of ['1970-01-01T00:00:01-00:00','1970-01-01T02:00:01.000001+02:00','1970-01-01T00:00:01.001Z','1970-01-01T14:15:01+14:15','1969-12-31T09:45:01-14:15'])await check(1000,stamp,'unknown');
console.log(JSON.stringify({positive,negative,scope:'exact-offset equivalence and invalid-normalization/microsecond negatives; synthetic DB transport, actual publisher+sampler'}));
