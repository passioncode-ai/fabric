import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
if (!process.argv[2]) throw Error('Pass audited checkout root')
const {deriveLiveness}=await import(pathToFileURL(path.join(process.argv[2],'apps/desktop/src/shared/liveness.ts')).href)
const thresholds={expectedIntervalMs:60000,quietAfterMs:180000,stallAfterMs:900000,orientationGraceMs:180000,resumeGraceMs:300000}
const base={heartbeat:{beatSeq:3,phase:'working',receivedAt:599000},beatsSupported:true,observation:{processEnded:false,lastOutputAt:599000,orientedAt:null,startedAt:1},thresholds,now:600000}
const broken=deriveLiveness(base), corrected=deriveLiveness({...base,observation:{...base.observation,orientedAt:1000}})
assert.equal(broken.state,'stalled'); assert.equal(corrected.state,'working')
const wait={...base,heartbeat:{beatSeq:3,phase:'waiting',receivedAt:1000},observation:{...base.observation,orientedAt:1000},now:1000000}
const noRef=deriveLiveness(wait), withRef=deriveLiveness({...wait,heartbeat:{...wait.heartbeat,waitingOn:{kind:'question',id:'q1'}}})
assert.equal(noRef.state,'stalled'); assert.equal(withRef.state,'waiting')
console.log(JSON.stringify({orientation:{handlerInputs:broken,recordedOrientation:corrected},wait:{callerInputs:noRef,unresolvedQuestion:withRef}},null,2))
console.log('PASS: both input-wiring counterexamples reproduced using current pure derivation; no live agent or database used.')
