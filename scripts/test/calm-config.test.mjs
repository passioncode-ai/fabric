import test from 'node:test'
import assert from 'node:assert/strict'
import {renderIntegrations, integrationState, transitionIntegration} from '../product/integrations.mjs'
import {renderGovernance, governanceStore} from '../product/governance.mjs'

// Inspect only native disclosure ancestry: controls inside a closed details remain
// reachable by its summary, whereas primary save/recovery must not be concealed.
function disclosureControls(html) {
 const stack=[], controls=[]
 for (const [tag] of html.matchAll(/<details\b[^>]*>|<\/details\s*>|<(?:form|input|select|textarea|button)\b[^>]*>/g)) {
  if (tag.startsWith('</details')) {stack.pop();continue}
  if (tag.startsWith('<details')) {stack.push(/\sopen(?:\s|>)/.test(tag));continue}
  controls.push({tag, hidden:stack.some(open=>!open)})
 }
 return controls
}
const one=(html,fragment)=>{
 const matches=disclosureControls(html).filter(c=>c.tag.includes(fragment))
 assert.equal(matches.length,1,fragment+' must be unique')
 return matches[0]
}
const ctx={project:'atlas',estate:'team-estate',provider:'codex',revision:'demo-2',roleSlot:'reviewer',memberRole:'owner',read:'ready'}

test('provider setup and selected readiness have one form each; optional promotion stays reachable',()=>{
 const clean=renderIntegrations('providers',ctx)
 assert.equal(one(clean,'data-integrations-form="config-save"').hidden,false)
 let d=transitionIntegration(integrationState({}),{type:'config-save',data:{name:'Reviewer',consumer:'review',prompt:'Check the result',provider:'codex',providerRevision:'demo-2',reason:'Initial configuration'}},ctx)
 assert.equal(d.error,'')
 const id=Object.keys(d.sourceDemos.configs).find(id=>d.sourceDemos.configs[id].name==='Reviewer')
 assert.ok(id)
 const html=renderIntegrations('providers',{...ctx,integrations:d,agentConfig:id})
 assert.equal(one(html,'data-integrations-form="config-save"').hidden,false)
 assert.equal(one(html,'data-integrations-form="config-canary"').hidden,false)
 assert.equal(one(html,'data-integrations-form="config-promotion"').hidden,true)
})

test('owned project keeps primary configuration visible and preserves observer inputs in disclosure',()=>{
 const state={estate:'calm-owned',project:'atlas'}
 const html=renderGovernance('project-settings',state)
 for(const name of ['project-name','project-purpose','project-repos','project-reason'])assert.equal(one(html,`name="${name}"`).hidden,false,name)
 for(const name of ['project-scope','project-targets','project-future-consent','project-memory'])assert.equal(one(html,`name="${name}"`).hidden,true,name)
 assert.equal(one(html,'type="submit"').hidden,false)
})

test('expanded observer scope and pending conflict recovery remain visible',()=>{
 const state={estate:'calm-expanded',project:'atlas'}
 renderGovernance('project-settings',state)
 const d=governanceStore.get('calm-expanded:atlas')
 Object.assign(d.projectConfig,{scope:'all-future',futureConsent:true,preview:{baseRevision:4,diff:[]},conflict:{base:{},winning:{},draft:{}}})
 d.notice='Configuration changed elsewhere';d.error=true
 const html=renderGovernance('project-settings',state)
 assert.equal(one(html,'name="project-future-consent"').hidden,false)
 assert.equal(one(html,'data-governance-action="project-confirm-save"').hidden,false)
 assert.equal(one(html,'data-governance-action="project-rebase"').hidden,false)
 assert.match(html,/Configuration changed elsewhere/)
})

test('diagnostic filters are disclosed without hiding Estate policy or preference saves',()=>{
 const html=renderGovernance('estate-settings',{estate:'calm-settings',project:'atlas'})
 assert.equal(one(html,'data-governance-form="log-filter"').hidden,true)
 assert.equal(one(html,'data-governance-form="estate-settings"').hidden,false)
 assert.equal(one(html,'data-governance-form="preferences"').hidden,false)
})
