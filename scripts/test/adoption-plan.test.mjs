import test from 'node:test';
import assert from 'node:assert/strict';
import {load,validate} from '../check-adoption-plan.mjs';
const seed=()=>structuredClone(load());
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
 ['unresolved STT accepted',d=>d.plan.packets.find(p=>p.id==='AD13').inputs.find(i=>i.packet==='AD12').predicate='anything',/invalid edge predicate/]
])test('planted defect rejected: '+name,()=>{const d=seed();mutate(d);assert.throws(()=>validate(d),pattern)});
