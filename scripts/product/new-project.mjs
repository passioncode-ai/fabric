// A newly-created project owns its data; it never borrows Atlas task/run records.
const npEscape = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export const demoProjects = new Map()
export function createDemoProject(draft) {
  const prior=[...demoProjects.values()].find(p=>draft.draftId&&p.draftId===draft.draftId&&p.estate===(draft.estate||'team-estate'));if(prior)return prior
  const id='local-'+(demoProjects.size+1)
  const project={id,estate:draft.estate||'team-estate',draftId:draft.draftId,pmActive:false,startupSpec:{starter:draft.starter,stages:draft.stages||[],roles:draft.starter==='software'?['Product manager','Builder','Reviewer']:['Product manager'],routines:'paused',targets:draft.target?[draft.target]:[],futureConsent:!!draft.futureConsent},name:draft.name,purpose:draft.purpose,repo:draft.repo,provider:draft.provider,admitted:false,context:false,tasks:[],runs:[],events:[],memory:[],draft:{...draft}}
  demoProjects.set(id,project);return project
}
// Known local projects use the same modules as the seeded projects.
export function renderNewProject(view,state,fixtures) {
  if(!String(state.project).startsWith('local-')||fixtures.projects.some(p=>p.id===state.project))return null
  return `<header class="page-title"><h2 tabindex="-1">Локальный пример не найден</h2></header><div class="notice"><p>Данные этого макета живут до перезагрузки страницы. История другого проекта не подставляется вместо вашего проекта.</p><a class="button" href="#view-onboarding?cohort=new&amp;project=atlas">Создать новый пример</a></div>`
}

// One page-local creation authority. Both URLs are aliases over these records.
export const creationDrafts = new Map()
const currentCreationByEstate = new Map()
let creationSequence = 1
export function creationRoute(view) { return view === 'onboarding' ? 'launch-start' : view }
export function creationRecord(state = {}, fresh = false) {
  const estate = state.estate || 'team-estate'
  let id = fresh ? null : state.draftId || currentCreationByEstate.get(estate)
  if (!id) { do { id = 'project-draft-' + creationSequence++ } while (creationDrafts.has(estate + '|' + id)) }
  const key = estate + '|' + id
  if (!creationDrafts.has(key)) creationDrafts.set(key, { key, draftId:id, estate, step:0, mode:'single', name:'', purpose:'', repo:'', provider:'later', starter:'software', stages:[], target:'', futureConsent:false, scan:'idle', candidates:[], notice:'', review:null, pending:null, project:null })
  currentCreationByEstate.set(estate, id)
  return creationDrafts.get(key)
}
export function creationList(estate = 'team-estate') { return [...creationDrafts.values()].filter(d => d.estate === estate) }
export function discardCreation(draft) { creationDrafts.delete(draft.key); if(currentCreationByEstate.get(draft.estate)===draft.draftId)currentCreationByEstate.delete(draft.estate) }
export function normalizedCreation(draft) {
  const sourceNone = draft.mode === 'idea' || draft.repoMode === 'none'
  return { estate:draft.estate, draftId:draft.draftId, name:draft.name.trim(), purpose:draft.purpose.trim(), repo:sourceNone?'':String(draft.repo||'').trim(), repoMode:sourceNone?'none':'existing', provider:draft.provider||'later', starter:draft.starter||(draft.mode==='idea'?'idea':'software'), stages:[...(draft.stages||[])].map(x=>x.trim()).filter(Boolean), target:draft.target||'', futureConsent:draft.futureConsent===true }
}
export function updateCreation(draft, field, value) {
  draft[field]=value; draft.notice=''; delete draft.archive; delete draft.duplicate
  if(field==='mode') { draft.repoMode=value==='idea'?'none':'existing'; draft.starter=value==='idea'?'idea':'software'; draft.scan='idle'; draft.candidates=[] }
  draft.review=null
}
export function reviewCreation(draft, projects = []) {
  if(draft.pending) { draft.notice='Создание подтверждается. Проверьте исход того же запроса.'; return {ok:false,kind:'pending'} }
  const payload=normalizedCreation(draft)
  let error=!payload.name||!payload.purpose?'Укажите название и первый полезный результат.':payload.repoMode==='existing'&&!payload.repo?'Укажите основной репозиторий или выберите работу без репозитория.':payload.starter==='observer'&&!payload.target?'Выберите проект наблюдения; доступ ко всему портфелю не выдаётся автоматически.':null
  if(payload.starter==='observer'&&payload.target&&!projects.some(p=>p.id===payload.target&&(p.estate||'team-estate')===draft.estate&&!p.archived&&!p.purged))error='Проект недоступен в текущем пространстве.'
  const prior=payload.repo&&projects.find(p=>(p.estate||'team-estate')===draft.estate&&p.repo===payload.repo&&!p.purged)
  if(prior){draft.archive=prior.archived?prior.id:null;draft.duplicate=prior.id;error=(prior.archived?'Этот проект уже есть в архиве: ':'Этот репозиторий уже добавлен: ')+prior.name}
  if(error){draft.notice=error;draft.review=null;return {ok:false,kind:prior?'duplicate':'invalid',project:prior?.id}}
  draft.review=structuredClone(payload); draft.notice=''; draft.step=2
  return {ok:true,payload:draft.review}
}
function committedCreation(draft) {
  if(!draft.project)return null
  if(JSON.stringify(draft.receipt?.payload)!==JSON.stringify(normalizedCreation(draft))){draft.notice='Проект уже создан с проверенными параметрами. Откройте его или создайте отдельный черновик.';return {ok:false,kind:'accepted-different',project:{id:draft.project}}}
  return {ok:true,project:{id:draft.project},replayed:true}
}
function invokeCreation(draft, payload, create) {
  // Record the exact intent BEFORE calling the boundary: a thrown callback may
  // have committed before losing its response. Reconcile this same request.
  draft.pending??={id:'create-project:'+draft.key,payload:structuredClone(payload)}
  try {
    const project=create(structuredClone(draft.pending.payload))
    if(!project||typeof project.id!=='string'||!project.id.trim())throw new Error('No project receipt')
    draft.project=project.id;draft.receipt={project:project.id,payload:structuredClone(draft.pending.payload)};draft.pending=null
    return {ok:true,project}
  } catch {
    draft.notice='Создание подтверждается. Проверьте исход того же запроса.'
    return {ok:false,kind:'unknown'}
  }
}
export function commitCreation(draft, create, {state='ready',phase=''}={}) {
  if(state!=='ready'||phase==='read-only')return {ok:false,kind:'unavailable'}
  const committed=committedCreation(draft);if(committed)return committed
  if(draft.pending){draft.notice='Создание подтверждается. Проверьте исход того же запроса.';return {ok:false,kind:'pending'}}
  if(!draft.review||JSON.stringify(draft.review)!==JSON.stringify(normalizedCreation(draft))){draft.review=null;draft.notice='Проверьте проект ещё раз. Черновик изменился после проверки.';return {ok:false,kind:'review-required'}}
  return invokeCreation(draft,draft.review,create)
}
export function pendCreation(draft, projects) {
  const result=reviewCreation(draft,projects)
  if(!result.ok)return result
  draft.pending={id:'create-project:'+draft.key,payload:structuredClone(result.payload)}
  return {ok:true,pending:draft.pending}
}
export function reconcileCreation(draft, create, state={}) {
  if((state.state||'ready')!=='ready'||state.phase==='read-only')return {ok:false,kind:'unavailable'}
  const committed=committedCreation(draft);if(committed)return committed
  if(!draft.pending)return {ok:false,kind:'missing'}
  return invokeCreation(draft,draft.pending.payload,create)
}
