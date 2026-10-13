import assert from 'node:assert/strict';
import {fixture} from './fixture-fixed.mjs';
const f=fixture({existing:true});await f.publisher.configure();
f.rpcHook=(_name,args)=>{f.row.observed={...args.p_observed};f.row.observed_at='1970-01-01T02:00:01.000+02:00';assert.equal(Date.parse(f.row.observed_at),Date.parse(args.p_at));return {data:true,error:null}};
const result=await f.publisher.publish();console.log(JSON.stringify({result,storedTimestamp:f.row.observed_at,storedEpoch:Date.parse(f.row.observed_at)}));
assert.equal(result.state,'published','valid offset timestamp denotes exact submitted instant');
