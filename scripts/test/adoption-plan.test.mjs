import test from 'node:test';
import assert from 'node:assert/strict';
import {load,validate} from '../check-adoption-plan.mjs';
import {PUBLIC_ROOT} from '../lib/public-history.mjs';
const seed=()=>structuredClone(load());
const pins=d=>d.plan.packets.flatMap(p=>p.baseline_sources);
// Every product-model view once; the count follows the model instead of a literal that goes stale.
test('bounded adoption graph resolves',()=>{const d=seed();assert.equal(validate(d).views,d.viewIds.length)});
for(const [name,mutate,pattern] of [
 ['missing view',d=>d.inventory.families[0].views.pop(),/view coverage/],
 ['duplicate view',d=>d.inventory.families[0].views.push(d.inventory.families[0].views[0]),/duplicate view/],
 ['dependency cycle',d=>d.plan.packets[0].depends_on.push('AD23'),/cycle/],
 ['orphan finding',d=>d.review.findings[0].decisions=[],/orphan finding/],
 ['unbound upstream output',d=>d.plan.packets[1].inputs[0].receipt='imaginary',/upstream output/],
 ['missing immutable context',d=>d.plan.packets[0].baseline_sources=[],/source pins/],
 ['unknown packet in phase',d=>d.journey.phases[0].packets.push('AD999'),/unknown phase packet/],
 ['duplicate requirement owner',d=>d.plan.modules[1].requirements.push(d.plan.modules[0].requirements[0]),/duplicate requirement/],
 ['missing negative check',d=>d.plan.packets[0].negative_checks=[],/incomplete packet/],
 ['missing test owner',d=>d.plan.packets[0].test_write_candidates=[],/missing test owner/],
 ['wrong proof tier',d=>d.plan.packets[1].inputs[0].minimum_proof_tier='prototype',/invalid edge proof/],
 ['unresolved STT accepted',d=>d.plan.packets.find(p=>p.id==='AD13').inputs.find(i=>i.packet==='AD12').predicate='anything',/invalid edge predicate/],
 // The public re-creation of the history (scripts/lib/public-history.mjs): a pin is on the baseline,
 // repinned off it only with identical bytes, or stale ON the baseline — never quietly moved.
 ['stale pin moved off its baseline',d=>{const s=pins(d).find(s=>s.verification==='stale-pre-publication');s.commit=PUBLIC_ROOT},/invalid stale source pin/],
 ['stale pin with an invented reason',d=>{pins(d).find(s=>s.verification==='stale-pre-publication').stale.reason='claim-changed'},/invalid stale source pin/],
 ['repinned pin whose bytes changed',d=>{pins(d).find(s=>s.repinned_from).repinned_from.file_sha256='0'.repeat(64)},/invalid repinned source pin/],
 ['repinned pin under a line rule',d=>{pins(d).find(s=>s.repinned_from).repinned_from.rule='cited-lines-moved'},/invalid repinned source pin/],
 ['unmarked pin moved off its baseline',d=>{const s=pins(d).find(s=>s.verification==='stale-pre-publication');delete s.verification;delete s.stale;s.commit=PUBLIC_ROOT},/invalid source pin/]
])test('planted defect rejected: '+name,()=>{const d=seed();mutate(d);assert.throws(()=>validate(d),pattern)});
