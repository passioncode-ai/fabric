/**
 * Fabric graph mockups. Read projections of explicitly fictional Atlas records.
 * No runtime IPC, network, graph store, authority or provider execution.
 *
 * renderGraph(kind, { id?, compact?, fixtures?, state?, project?, created? }) -> HTML.
 * Kinds: plan/history/agent/decisions (also target-plan/project-history/agent-history).
 * state: { run:1|2, revision:'plan-v1'|'plan-v2', selected:'node:ID'|'edge:ID',
 *   mode:'graph'|'list'|'outline', status:'all'|status, type:'all'|type, query:'',
 *   read:'ready'|'empty'|'loading'|'partial'|'stale'|'reconnect'|'error'|'unlinked'|
 *        'truncated'|'missing-source'|'denied-source'|'old-plan'|'cycle-diagnostic',
 *   camera:{x,y,zoom}, limit:12, expanded:false }.
 * attachGraphInteractions(root, { onStateChange(state,{id,kind}),
 *   onNavigate({href,returnHref,state,id,kind},event)? }) -> cleanup function.
 * Navigation defaults to an ordinary anchor; onNavigate may preventDefault.
 * Persist onStateChange by (project, kind, id), then pass state back into renderGraph
 * after route return. graphRouteState / graphReturnHref also round-trip URL params.
 * No global DOM selectors, document listeners, external libraries or shared IDs.
 */
const html = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const json = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
const yes = value => value === true || value === 'true'
const clamp = (value, low, high) => Math.max(low, Math.min(high, Number(value) || 0))
const finite = (value, fallback=0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const unique = values => [...new Set(values)]
const KINDS = {
  plan: { title:'Целевой план Atlas', route:'project-plan', label:'ПЛАН · КАК ХОТИМ ПРИЙТИ К ЦЕЛИ', summary:'Версия цели, состав задач и необходимые результаты. История исполнения открывается отдельно.' },
  history: { title:'История работы Atlas', route:'project-history', label:'ИСТОРИЯ · ЧТО ЗАПИСАНО', summary:'Задачи, прогоны и появившаяся в работе проверка. Каждая связь ведёт к своему основанию.' },
  agent: { title:'История Builder', route:'agent-history', label:'АГЕНТ · ДЕЙСТВИЯ И ПЕРЕДАЧИ', summary:'Какие задачи получил и создал Builder, что спросил и кому передал дальнейшую работу.' },
  decisions: { title:'История решений Atlas', route:'decisions', label:'РЕШЕНИЯ · ОСНОВАНИЯ И ИЗМЕНЕНИЯ', summary:'Записанные основания и источники. Переданный контекст не равен цитированию и не раскрывает скрытые рассуждения.' }
}
const ALIASES = {'target-plan':'plan','project-history':'history','agent-history':'agent','decision-history':'decisions'}
const STATUS = { planned:'В плане', running:'В работе', done:'Завершено', cancelled:'Отменено', failed:'Проверка не пройдена', blocked:'Заблокировано', open:'Ожидает решения', active:'Актуально', superseded:'Заменено', unknown:'Неизвестно', pending:'Ожидает', skipped:'Пропущено' }
const TYPES = {goal:'Цель',task:'Задача',run:'Прогон',step:'Шаг',question:'Вопрос',decision:'Решение',evidence:'Доказательство',fact:'Факт',pack:'Контекст',agent:'Исполнитель',board:'Доска',action:'Действие'}
const CLAIMS = {declared:'Заявлено',observed:'Записанное событие',verified:'Проверено по источнику',unknown:'Не подтверждено'}
const READS = ['ready','empty','loading','partial','stale','reconnect','error','unlinked','truncated','missing-source','denied-source','old-plan','cycle-diagnostic']
const DEFAULTS = {
  as_of:'2026-09-07T09:42:00+02:00',
  tasks:[
    {id:'AT-38',title:'Зафиксировать границы командного доступа',state:'done',owner:'Оператор',origin:'План проекта',verification:'Контракт проверен',project:'atlas'},
    {id:'AT-42',title:'Не терять приглашение после входа',state:'running',owner:'Builder · Claude Code',origin:'План проекта',verification:'Ожидает повторной проверки',project:'atlas'},
    {id:'AT-47',title:'Проверить отзыв приглашения во время входа',state:'backlog',owner:'Reviewer',origin:'Добавил Builder из AT-42',verification:'Ещё не проверено',project:'atlas'},
    {id:'AT-50',title:'Выпустить командный доступ',state:'backlog',owner:'Product manager',origin:'План проекта',verification:'Зависит от AT-42 и AT-47',project:'atlas'}
  ],
  runs:[
    {id:'run-01',iteration:1,state:'failed',plan_version:'plan-v1',started:'09:08',ended:'09:21',step_states:['done','done','done','failed','blocked'],evidence:'E-14: отрицательный тест не пройден'},
    {id:'run-02',iteration:2,state:'running',plan_version:'plan-v2',started:'09:34',ended:null,step_states:['done','done','active','pending','pending'],evidence:'E-17: воспроизведение; E-18: контракт'}
  ],
  steps:[{id:'understand',label:'Воспроизвести потерю приглашения'},{id:'contract',label:'Зафиксировать контракт возврата'},{id:'implement',label:'Сохранить приглашение до подтверждения'},{id:'verify',label:'Проверить свежий и отозванный invite'},{id:'checkpoint',label:'Чекпоинт: review и доказательства'}]
}
const href = (view, params={}) => '#view-'+view+'?'+new URLSearchParams({project:'atlas',...params})
// Decision provenance is copied from its recorded fields, never inferred from graph
// layout, fixture clock, neighbouring events or the most recent task iteration.
function decisionProvenance(record, fixtures, project, agent='') {
  const raw=Object.hasOwn(record,'context_pack')?record.context_pack:record.pack
  const contextPack=typeof raw==='string'&&raw.trim()&&!['past','next'].includes(raw)?raw:null
  const time=typeof record.created_at==='string'&&record.created_at.trim()?record.created_at:'Не записано в источнике'
  const rows=Array.isArray(fixtures.projectRuns)?fixtures.projectRuns:Object.values(fixtures.projectRuns || {})
  const matches=rows.filter(r=>r.id&&r.project===project&&r.pack===contextPack&&r.task&&(!record.task||r.task===record.task))
  const exact=matches.length&&matches.every(r=>r.id===matches[0].id&&r.task===matches[0].task)?matches[0]:null
  return {time,contextPack,suppliedContext:contextPack || 'Точный пакет не приложен к записи.',
    contextHref:contextPack&&exact?href('context-pack',{project,...(agent?{agent}:{}),task:exact.task,pack:'past',run:exact.id}):null,
    contextNote:contextPack&&!exact?'Точная связь пакета с прогоном не прочитана однозначно. Последний прогон не подставляется.':null}
}
export function graphKind(kind) { const canonical=ALIASES[kind] || kind; if(!KINDS[canonical]) throw new Error('Unknown graph kind: '+kind); return canonical }
export function createGraphState(input={}) {
  const run=Number(input.run)===1?1:2
  return {run,planRevision:typeof input.planRevision==='string'?input.planRevision:'',runId:typeof input.runId==='string'?input.runId:'',agent:typeof input.agent==='string'?input.agent:'',revision:['plan-v1','plan-v2'].includes(input.revision)?input.revision:`plan-v${run}`,
    selected:typeof input.selected==='string'?input.selected:'', mode:['graph','list','outline'].includes(input.mode)?input.mode:'graph',
    status:Object.hasOwn(STATUS,input.status)?input.status:'all',type:Object.hasOwn(TYPES,input.type)?input.type:'all',query:String(input.query || '').slice(0,200),
    read:READS.includes(input.read)?input.read:'ready',limit:clamp(input.limit || 12,1,500),expanded:yes(input.expanded),
    camera:{x:finite(input.camera?.x),y:finite(input.camera?.y),zoom:clamp(input.camera?.zoom || 1,.25,2)},fitted:yes(input.fitted)}
}
/** Each call builds fresh objects. A later run/verified checkpoint never mutates old records. */
/** Local prototype plan revisions. They never update provider runs or canonical ADRs. */
export function projectGraphState(input={}) {
 const source=input.graphPlanEdits || input
 return {version:1,projects:structuredClone(source.projects || {})}
}
const planRows=value=>Array.isArray(value)?value:Object.values(value || {})
const planEdgeId=e=>`${e.from}:${e.type}:${e.to}`
const dependencyKinds=new Set(['needs','follows','blocks','depends-on','dependency'])
function planBase(options={}) {
 const project=options.project || 'atlas',f=options.fixtures || DEFAULTS,state=createGraphState(options.state),tasks=planRows(f.tasks || (project==='atlas'?DEFAULTS.tasks:[])).filter(t=>t.project===project)
 const declared=Object.hasOwn(f,'goals'),goals=declared?planRows(f.goals).filter(g=>g.project===project):project==='atlas'?[{id:'goal-access',project,title:'Запустить командный доступ',revision:state.revision,tasks:tasks.filter(t=>['AT-38','AT-42','AT-50',...(state.revision==='plan-v2'?['AT-47']:[])].includes(t.id)).map(t=>t.id)}]:[]
 const relations=[],put=e=>{if(!relations.some(r=>planEdgeId(r)===planEdgeId(e)))relations.push(e)}
 for(const g of goals)for(const id of g.tasks || [])put({from:g.id,to:id,type:'membership',payload:'Явный tasks reference цели',source:g.revision || g.id})
 for(const t of tasks){if(t.goal_id || t.goalRef)put({from:t.goal_id || t.goalRef,to:t.id,type:'membership',payload:'Явный goal reference задачи',source:t.id});for(const need of t.needs || [])put({from:typeof need==='string'?need:need.task,to:t.id,type:'needs',payload:typeof need==='object'?need.payload:null,source:t.id})}
 for(const l of planRows(f.taskLinks).filter(l=>l.project===project)){
  const rel=l.rel || l.type
  if(dependencyKinds.has(rel))put({from:l.from,to:l.to,type:'needs',payload:l.payload,source:l.source})
  if(rel==='membership')put({from:l.from,to:l.to,type:'membership',payload:l.payload,source:l.source})
  if(rel==='member-of')put({from:l.to,to:l.from,type:'membership',payload:l.payload,source:l.source})
 }
 if(!declared&&project==='atlas')for(const [from,to]of [['AT-38','AT-42'],['AT-42','AT-50'],...(state.revision==='plan-v2'?[['AT-47','AT-50']]:[])])if(tasks.some(t=>t.id===from)&&tasks.some(t=>t.id===to))put({from,to,type:'needs',payload:'Закреплённая связь исходного Atlas fixture',source:state.revision})
 return {project,tasks:structuredClone(tasks),goals:structuredClone(goals),relations,sourceRevision:f.planRevision || goals.map(g=>g.revision).filter(Boolean).join(' + ') || null}
}
// Stable content signature, not a security or integrity hash. Used only to detect stale fixture intent.
const planSignature=base=>JSON.stringify({tasks:base.tasks.map(t=>[t.id,t.title]).sort(),goals:base.goals.map(g=>[g.id,g.title,g.revision||null,g.criteria||null]).sort(),relations:base.relations.map(e=>[e.from,e.to,e.type,e.payload||null,e.source||null]).sort()})
function planCycle(relations){
 const adj=new Map();for(const e of relations.filter(e=>e.type==='needs')){if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from).push(e.to)}
 const seen=new Set(),active=new Set(),path=[];let cycle=null
 function visit(id){if(active.has(id)){cycle=[...path.slice(path.indexOf(id)),id];return true}if(seen.has(id))return false;seen.add(id);active.add(id);path.push(id);for(const next of adj.get(id)||[])if(visit(next))return true;path.pop();active.delete(id);return false}
 for(const id of adj.keys())if(visit(id))return cycle
 return null
}
function applyPlanOperations(base,operations){
 const relations=structuredClone(base.relations)
 for(const op of operations){const key=planEdgeId(op),at=relations.findIndex(e=>planEdgeId(e)===key);if(op.operation==='remove'){if(at>=0)relations.splice(at,1)}else if(at<0)relations.push({from:op.from,to:op.to,type:op.type,payload:op.payload || op.reason,source:op.receipt})}
 return relations
}
const planWritesBlocked=options=>yes(options.created)||options.memberRole==='member'||['loading','partial','stale','reconnect','error','empty','missing-source','denied-source','old-plan','cycle-diagnostic','denied','read-only','conflict'].includes(options.read || options.state?.read)
export function transitionGraphPlan(input,action,options={}) {
 const store=projectGraphState(input),project=options.project || 'atlas',base=planBase(options),prior=store.projects[project] || {project,sequence:0,revisions:[],operations:[]},entry=store.projects[project]=structuredClone(prior),a=action.data || action
 entry.error='';entry.receipt=null;entry.draft={type:a.type,from:a.from || '',to:a.to || '',operation:a.operation || 'add',reason:a.reason || ''}
 const fail=message=>{entry.error=message;return store},current=entry.revisions.at(-1)
 if(planWritesBlocked(options))return fail('Этот снимок или роль не допускает изменение плана. Сохранённые данные не изменены.')
 if(options.planRevision&&options.planRevision!==current?.id)return fail('Историческая версия доступна для чтения. Вернитесь к текущему плану перед изменением.')
 if(!String(a.reason || '').trim())return fail('Укажите причину изменения: она войдёт в новую версию плана.')
 if(current&&current.sourceSignature!==planSignature(base)&&a.type!=='rebase')return fail('Исходные цели или связи изменились. Сначала сверяйте изменения с текущими источниками; старая версия остаётся доступна.')
 if(!['dependency','membership','rebase'].includes(a.type))return fail('Неизвестный тип изменения плана.')
 if(a.type!=='rebase'&&!['add','remove'].includes(a.operation || 'add'))return fail('Допустимы только явные add/remove связи.')
 const operations=structuredClone(entry.operations),relations=applyPlanOperations(base,operations)
 if(a.type!=='rebase'){
  const task=base.tasks.find(t=>t.id===a.from),target=a.type==='membership'?base.goals.find(g=>g.id===a.to):base.tasks.find(t=>t.id===a.to)
  if(!task||!target)return fail('Оба объекта должны существовать в прочитанном Project. Чужой ID и неизвестная цель не подставляются.')
  if(a.type==='dependency'&&a.from===a.to)return fail('Задача не может зависеть сама от себя. Версия не создана.')
  const op={type:a.type==='membership'?'membership':'needs',from:a.type==='membership'?a.to:a.from,to:a.type==='membership'?a.from:a.to,operation:a.operation || 'add',reason:a.reason,payload:a.payload || a.reason,actor:options.actor || 'operator · fixture'}
  const exists=relations.some(e=>planEdgeId(e)===planEdgeId(op))
  if(op.operation==='add'&&exists)return fail('Эта связь уже существует. Дубликат и новая версия не созданы.')
  if(op.operation==='remove'&&!exists)return fail('Удаляемая связь не прочитана. Версия не создана.')
  op.receipt=`fixture-plan-${project}-${entry.sequence+1}`;operations.push(op)
 }
 const proposed=applyPlanOperations(base,operations),taskIds=new Set(base.tasks.map(t=>t.id)),goalIds=new Set(base.goals.map(g=>g.id))
 if(proposed.some(e=>e.type==='membership'?(!goalIds.has(e.from)||!taskIds.has(e.to)):(!taskIds.has(e.from)||!taskIds.has(e.to))))return fail('После сверки осталась связь с отсутствующим объектом. Исправьте источник; не допускаем висячее ребро.')
 const cycle=planCycle(proposed);if(cycle)return fail('Цикл зависимостей: '+cycle.join(' → ')+'. Версия не создана; выполнение не допущено.')
 const sequence=entry.sequence+1,id=`fixture-plan-${project}-${sequence}`,snapshot={id,project,sequence,parent:current?.id || base.sourceRevision,reason:a.reason,actor:options.actor || 'operator · fixture',operation:a.type,sourceSignature:planSignature(base),sourceRevision:base.sourceRevision,relations:proposed,tasks:base.tasks,goals:base.goals,fixture:true}
 // First edit preserves the complete read baseline, not just its revision label.
 entry.baseline ||= {id:'source-baseline',project,tasks:base.tasks,goals:base.goals,relations:base.relations,sourceRevision:base.sourceRevision,fixture:true}
 entry.sequence=sequence;entry.operations=operations;entry.revisions.push(snapshot);entry.receipt=id;entry.draft={...entry.draft,reason:''};return store
}
function graphPlanProjection(options,state){
 const base=planBase(options),entry=projectGraphState(options.graphPlanEdits).projects[base.project],selected=state.planRevision==='source-baseline'?entry?.baseline:entry?.revisions.find(r=>r.id===state.planRevision),current=entry?.revisions.at(-1)
 const snapshot=selected || (state.planRevision?null:current),stale=Boolean(current&&current.sourceSignature!==planSignature(base))
 if(state.planRevision&&!snapshot)return {base,entry,unknownRevision:true,stale}
 const source=snapshot || base
 return {base,entry,stale,snapshot,revision:snapshot?.id || base.sourceRevision,fixtures:{...(options.fixtures || DEFAULTS),tasks:source.tasks.map(t=>{const live=!state.planRevision?base.tasks.find(row=>row.id===t.id):null;return {...t,...(live?{state:live.state,owner:live.owner,verification:live.verification,checked:live.checked}:{}),goal_id:null,goalRef:null,needs:[]}}),goals:source.goals.map(g=>({...g,tasks:[]})),taskLinks:source.relations.map(e=>({project:base.project,from:e.from,to:e.to,rel:e.type,payload:e.payload,source:e.source}))}}
}
function planEditor(model,state,options){
 if(model.kind!=='plan'||options.compact||model.unavailable)return ''
 const p=graphPlanProjection(options,state),entry=p.entry,draft=entry?.draft || {type:'dependency',from:'',to:'',operation:'add',reason:''},current=entry?.revisions.at(-1),disabled=planWritesBlocked({...options,read:state.read})||Boolean(state.planRevision&&state.planRevision!==current?.id),field=(label,name,value)=>`<label class="fg-field"><span>${html(label)}</span><input name="${name}" value="${html(value)}"></label>`,choices=(label,name,rows,current)=>`<label class="fg-field"><span>${html(label)}</span><select name="${name}">${rows.map(([id,title])=>`<option value="${html(id)}" ${id===current?'selected':''}>${html(title)}</option>`).join('')}</select>`
 return `<details class="fg-plan-editor" ${entry?.error||entry?.receipt?'open':''}><summary>Изменить состав и зависимости плана · локальный макет</summary><p>Membership добавляет задачу в цель. Dependency означает: результат первой задачи нужен второй. Это редактирование вымышленных записей, не запуск и не принятие proposed ADR.</p>${entry?.error?`<p class="fg-plan-error" role="alert">${html(entry.error)}</p>`:''}${entry?.receipt?`<p role="status">Записана версия ${html(entry.receipt)}. Уже начатые прогоны сохраняют прежние pins.</p>`:''}${p.stale?'<p class="fg-plan-error">Источник изменился после последней записи. Показана закреплённая версия; текущий source требует явной сверки.</p>':''}<form data-graph-plan-form><div class="fg-plan-fields">${choices('Изменение','type',[['dependency','Dependency · задача → задача'],['membership','Membership · задача → цель']],draft.type)}${choices('Действие','operation',[['add','Добавить связь'],['remove','Убрать связь']],draft.operation)}${choices('Первая задача','from',p.base.tasks.map(t=>[t.id,t.id+' · '+t.title]),draft.from)}${choices('Вторая задача или цель','to',[...p.base.tasks.map(t=>[t.id,t.id+' · '+t.title]),...p.base.goals.map(g=>[g.id,g.id+' · цель: '+g.title])],draft.to)}${field('Причина новой версии','reason',draft.reason)}</div><button type="submit" ${disabled||p.stale?'disabled':''}>Проверить связь и сохранить версию</button></form>${p.stale?`<form data-graph-plan-rebase>${field('Основание сверки с новым source','reason','Сверены текущие цели, задачи и связи')}<button type="submit" ${disabled?'disabled':''}>Сверить и создать successor</button></form>`:''}${entry?`<label class="fg-field"><span>Прочитать сохранённую версию</span><select data-graph-control="planRevision"><option value="">Текущая версия</option>${[entry.baseline,...entry.revisions].filter(Boolean).map(r=>`<option value="${html(r.id)}" ${state.planRevision===r.id?'selected':''}>${html(r.id+' · '+(r.reason || 'Исходный source snapshot'))}</option>`).join('')}</select></label><details><summary>Receipt и неизменяемая история версий</summary><pre>${html(JSON.stringify(entry.revisions.map(({sourceSignature,tasks,goals,...r})=>r),null,2))}</pre></details>`:''}</details>`
}

export function createGraphModel(kind, options={}) {
  kind=graphKind(kind)
  const state=createGraphState(options.state), supplied=options.fixtures || DEFAULTS
  const scope=options.project || options.state?.project || 'atlas'
  const base={kind,...KINDS[kind],scope,agent:options.agent || options.state?.agent || '',asOf:supplied.as_of || DEFAULTS.as_of,revision:state.revision,run:state.run,nodes:[],edges:[],diagnostics:[],bounds:{width:900,height:500},progress:null,fixture:true}
  if(yes(options.created) || yes(options.state?.created)) return {...base,title:'Граф выбранного проекта',label:'ВЫБРАННЫЙ ПРОЕКТ',summary:'Собственный срез без истории других проектов.',asOf:null,unavailable:'Для этого черновика ещё нет записанных отношений. Сохранённые данные другого проекта не подставляются.'}
  if(kind==='plan'&&(Object.hasOwn(supplied,'goals')||state.planRevision||projectGraphState(options.graphPlanEdits).projects[scope])){
    const projected=graphPlanProjection({...options,project:scope},state)
    if(projected.unknownRevision)return {...base,unavailable:'Эта версия плана не прочитана в выбранном Project. Другая версия не подставляется.'}
    const model=scopedGraph(base,{...state,runId:''},projected.fixtures,{...options,project:scope})
    model.revision=projected.revision || 'Source revision неизвестна'
    if(projected.stale)model.diagnostics.push('Внешний source изменился. Показана закреплённая версия плана до явной сверки; running pins сохранены.')
    return model
  }
  if(scope!=='atlas' || (kind==='agent' && base.agent && base.agent!=='builder') || state.runId || (['history','agent'].includes(kind) && (Array.isArray(supplied.projectRuns)?supplied.projectRuns:Object.values(supplied.projectRuns || {})).some(r=>r.project===scope && !['run-01','run-02'].includes(r.id))))return scopedGraph(base,state,supplied,options)
  if(state.read==='empty' || state.read==='loading') return base
  const nodes=[],edges=[]
  const add=(id,type,title,x,y,extra={}) => { const node={id,type,title,x,y,status:'unknown',claim:'observed',creator:'Не указан в источнике',assignee:'Не назначен',source:id,sourceState:'available',sourceHref:href('reports',{source:id}),task:null,run:null,board:null,...extra};nodes.push(node);return node }
  const edge=(from,to,type,label,payload,source) => { const id=`${from}:${type}:${to}`;edges.push({id,from,to,type,label,payload,source,sourceState:'available',sourceHref:href('reports',{source})});return id }
  const tasks=(supplied.tasks || DEFAULTS.tasks).filter(t=>t.project==='atlas')
  const task=(id,x,y) => {const t=tasks.find(t=>t.id===id); if(!t)return null;return add(id,'task',t.title,x,y,{status:t.state==='backlog'?'planned':t.state,claim:id==='AT-38'?'verified':'observed',creator:id==='AT-47'?'Builder':'План проекта',assignee:t.owner,source:t.origin,verification:t.verification,task:id,board:'Atlas · задачи',href:href('task',{task:id}),sourceHref:href('project-plan',{task:id}),...((id==='AT-42')?{runs:(supplied.runs || DEFAULTS.runs).map(r=>({id:r.id,iteration:r.iteration,revision:r.plan_version,status:r.state}))}:{})})}
  const run=(number,x,y) => {const r=(supplied.runs || DEFAULTS.runs).find(r=>r.iteration===number);if(!r)return null;return add(r.id,'run',`Прогон ${number} · ${r.plan_version}`,x,y,{status:r.state,claim:'observed',creator:'Admission · пример квитанции',assignee:'Builder · Claude Code',source:r.evidence,sourceHref:href('run',{run:number,task:'AT-42'}),task:'AT-42',run:number,revision:r.plan_version,time:`${r.started} → ${r.ended || 'нет терминальной квитанции'}`,href:href('run',{run:number,task:'AT-42'}),steps:(supplied.steps || DEFAULTS.steps).map((step,i)=>({id:`${r.id}:${step.id}`,title:step.label,status:r.step_states[i] || 'unknown',claim:'declared'}))})}
  const evidence=(id,title,x,y,number=1) => add(id,'evidence',title,x,y,{status:id==='E-14'?'failed':'done',claim:'verified',task:'AT-42',run:number,creator:'Проверка · fixture',assignee:'Reviewer',source:`${id} · run-0${number}`,href:href('reports',{evidence:id,run:number,task:'AT-42'})})
  const question=(x,y) => add('Q-12','question','Разрешить проверку на staging?',x,y,{status:(supplied.questions || []).find(q=>q.id==='Q-12')?.state==='resolved'?'done':'open',creator:'Builder · run-02',assignee:'Оператор',task:'AT-42',run:2,board:'Atlas · вопросы',source:'question.request · Q-12',href:href('question',{question:'Q-12',task:'AT-42',run:2}),detail:'Только проверка Atlas staging. Ответ, допуск, доставка и подтверждение исполнения — разные события.'})
  const decision=(x,y) => add('D-08','decision','Проверять отзыв в момент входа',x,y,{status:'active',creator:'Автор не указан в fixture',assignee:'Product manager',source:'D-08 · E-14',task:'AT-42',href:href('decisions',{decision:'D-08'}),rationale:'Записанное основание: отрицательный тест показал, что сохранённое приглашение может быть отозвано до входа.',citations:['E-14'],suppliedContext:'CP-01 · plan-v1 (доступность исторического пакета проверяется отдельно)',retrieval:'Отдельная квитанция retrieval отсутствует в примере. Не выводим её из текста решения.'})
  if(kind==='plan') {
    add('goal-access','goal','Запустить командный доступ',40,250,{status:'running',claim:'declared',creator:'Оператор',assignee:'Product manager',source:state.revision,href:href('project'),detail:'Один проверяемый результат: вход продолжает приглашение, отозванное приглашение не выдаёт доступ.'})
    task('AT-38',350,70);task('AT-42',660,70);if(state.revision==='plan-v2')task('AT-47',660,340);task('AT-50',1000,220)
    for(const n of nodes.filter(n=>n.type==='task'))edge('goal-access',n.id,'membership','Входит в цель',`${state.revision}: задача ${n.id} остаётся в составе и после завершения`,state.revision)
    edge('AT-38','AT-42','needs','Нужен контракт','Версия границ доступа для реализации приглашения',state.revision)
    edge('AT-42','AT-50','needs','Нужен результат','Изменения и независимая проверка свежей ссылки',state.revision)
    if(state.revision==='plan-v2')edge('AT-47','AT-50','needs','Нужна проверка','Квитанция проверки отозванного приглашения',state.revision)
    base.progress={done:nodes.filter(n=>n.type==='task'&&n.status==='done').length,total:nodes.filter(n=>n.type==='task').length}
    if(state.revision==='plan-v1')base.diagnostics.push('Исторический plan-v1: AT-47 ещё не включена. Новая работа не переписывает состав старой версии.')
  } else if(kind==='history') {
    task('AT-38',40,90);task('AT-42',350,90);run(1,660,70);evidence('E-14','Отозванное приглашение: отрицательный тест',980,70);decision(1300,70);run(2,1620,70);task('AT-47',980,370);question(1620,370)
    edge('AT-38','AT-42','requirement','Контракт','Границы доступа указаны как вход задачи','AT-42 · needs')
    edge('AT-42','run-01','execution','Допуск прогона 1','Новая попытка AT-42; plan-v1','run-01 · admission')
    edge('run-01','E-14','check','Проверка провалена','Отрицательный тест отозванного приглашения','E-14')
    edge('E-14','D-08','citation','Основание','Явная ссылка D-08 на E-14','D-08')
    edge('AT-42','AT-47','creation','Создал Builder','Новая задача Reviewer; origin_ref=AT-42','AT-47 · origin')
    edge('AT-42','run-02','execution','Новый допуск','Отдельный TaskRun и plan-v2; шаги начинаются заново','run-02 · admission')
    edge('run-02','Q-12','question','Запросил решение','Один запрос проверки staging','Q-12')
  } else if(kind==='agent') {
    task('AT-42',40,180);run(state.run,370,180)
    edge('AT-42',`run-0${state.run}`,'execution',`Прогон ${state.run}`,'AT-42 назначена Builder; отдельная квитанция допуска',`run-0${state.run}`)
    if(state.run===1){evidence('E-14','Проверка первого подхода не пройдена',710,180);edge('run-01','E-14','check','Проверено','Собственный исход первого прогона','E-14')}
    else {
      task('AT-47',740,30);question(740,350)
      add('reviewer','agent','Reviewer · Codex',1090,30,{status:'pending',creator:'Builder · назначение задачи',assignee:'Reviewer',task:'AT-47',board:'Atlas · задачи',source:'AT-47 · assigned_to',href:href('task',{task:'AT-47'}),detail:'Назначен получатель AT-47. Подтверждение потребления результата ещё не записано.'})
      add('board-questions','board','Доска · вопросы оператору',1090,350,{status:'open',creator:'Q-12',assignee:'Оператор',task:'AT-42',board:'Atlas · вопросы',source:'Q-12 · recipient',href:href('board',{boardKind:'questions',question:'Q-12'}),detail:'Вопрос доставляется на доску. Наличие вопроса не означает, что ответ уже получен.'})
      edge('run-02','AT-47','creation','Создал задачу','origin_ref=AT-42; автор Builder','AT-47 · origin')
      edge('AT-47','reviewer','assignment','Назначил Reviewer','assigned_to=reviewer; consumption acknowledgement отсутствует','AT-47 · assignment')
      edge('run-02','Q-12','question','Задал вопрос','kind=approval; scope=Atlas staging','Q-12')
      edge('Q-12','board-questions','routing','Адресовал оператору','recipient=operator; answer ещё не записан','Q-12 · recipient')
    }
  } else {
    add('F-19','fact','Можно хранить invite до конца сессии',40,70,{status:'superseded',claim:'declared',creator:'Builder · run-01',task:'AT-42',run:1,source:'F-19 · run-01',href:href('memory-lineage',{fact:'F-19'}),detail:'Старое утверждение остаётся в истории и прошлом пакете. Это не независимо проверенный результат.'})
    evidence('E-14','Отозванное приглашение не прошло тест',360,70)
    decision(700,70)
    add('F-21','fact','Отзыв проверяется на границе входа',1060,70,{status:'active',claim:'verified',creator:'D-08',task:'AT-42',source:'D-08 · E-14',href:href('memory-lineage',{fact:'F-21'}),detail:'Текущее утверждение с явным источником; старое не удаляется.'})
    for(const number of [1,2])add(`CP-0${number}`,'pack',`Переданный пакет прогона ${number}`,number===1?40:1060,390,{status:'done',creator:'Компиляция контекста',assignee:'Builder',task:'AT-42',run:number,revision:`plan-v${number}`,source:`CP-0${number}`,href:href('context-pack',{run:number,pack:'past',task:'AT-42'}),detail:number===1?'Включает F-19; не содержит поздний F-21.':'Включает F-21 и R-08. Не заменяет пакет первого прогона.'})
    edge('E-14','D-08','citation','Явное основание','В записанном решении есть ссылка E-14','D-08 · citations')
    edge('D-08','F-21','records','Записан факт','Факт F-21 ссылается на D-08 и E-14','F-21 · source')
    edge('F-19','F-21','supersession','Заменено, не удалено','F-19 → F-21; история обоих утверждений сохранена','F-19 · superseded_by')
    edge('F-19','CP-01','included','Передано в прогон 1','Зафиксированный состав CP-01','CP-01 · manifest')
    edge('F-21','CP-02','included','Передано в прогон 2','Зафиксированный состав CP-02','CP-02 · manifest')
  }
  // Optional decisions created by the owning mockup controller are fixture records,
  // not inferred outcomes. A later decision does not replace D-08 without an explicit ref.
  if(kind==='decisions')for(const [index,record] of (supplied.decisions || []).filter(d=>d.project==='atlas').entries()) {
    if(!record.id || !record.title)continue
    let n=nodes.find(n=>n.id===record.id)
    const fields={status:record.state==='superseded'?'superseded':'active',creator:record.author || 'Автор не указан в fixture',source:record.id,task:record.task || null,href:href('decisions',{decision:record.id}),rationale:record.reason || 'Записанное основание не приложено.',citations:Array.isArray(record.evidence)?record.evidence:record.evidence?[String(record.evidence)]:[],...decisionProvenance(record,supplied,scope,base.agent),retrieval:'Отдельная квитанция retrieval не приложена.'}
    if(n)Object.assign(n,fields);else n=add(record.id,'decision',record.title,700+index*320,710,fields)
    if(record.question==='Q-12') {
      if(!nodes.some(x=>x.id==='Q-12'))question(360,710)
      edge('Q-12',record.id,'settlement','Записан ответ','Решение ссылается на точный вопрос. Delivery и acknowledgement остаются отдельными квитанциями.',record.id)
    }
    if(record.supersedes && nodes.some(x=>x.id===record.supersedes))edge(record.supersedes,record.id,'supersession','Новое решение','Явный supersedes в записи; прошлое основание сохраняется.',record.id)
  }
  // Referenced but absent nodes are explicit boundaries, never invented records.
  for(const e of edges)for(const id of [e.from,e.to])if(!nodes.some(n=>n.id===id))add(id,'task','Запись не прочитана',40,nodes.length*160,{sourceState:'missing',source:id,detail:'Связь прочитана, целевой объект недоступен. Поля не восстанавливаются по соседним узлам.'})
  if(state.read==='unlinked') {edges.length=0;base.diagnostics.push('Объекты прочитаны, но подтверждённые отношения отсутствуют. Порядок списка не означает причинную связь.')}
  if(state.read==='missing-source' || state.read==='denied-source') {
    const n=nodes.find(n=>n.id==='E-14') || nodes[0]
    if(n){n.sourceState=state.read==='missing-source'?'missing':'denied';n.sourceHref=null;if(n.sourceState==='denied'){n.source='Защищённый источник';n.detail='Родительская запись доступна. Содержимое защищённого источника не раскрывается.'}}
  }
  if(state.read==='cycle-diagnostic')base.diagnostics.push(kind==='plan'?'Диагностика примера: циклическая зависимость не допускается к исполнению. Это макет ошибки; план не переписан.':'Повторное обращение к узлу не разворачивается бесконечно. История событий остаётся доступна списком; цикл времени не выводится из геометрии.')
  const previewIds=({plan:['goal-access','AT-42','AT-47','AT-50'],history:['AT-42','run-02','AT-47','Q-12'],agent:state.run===1?['AT-42','run-01','E-14']:['AT-42','run-02','AT-47','Q-12'],decisions:['E-14','D-08','F-21','CP-02']})[kind]
  return {...base,nodes,edges,previewIds,bounds:{width:Math.max(900,...nodes.map(n=>n.x+290)),height:Math.max(530,...nodes.map(n=>n.y+175))}}
}
/** Generic fixture projection. Explicit Project + actor + task references only.
 * projectRuns is Object.values(ops.runs); tasks/agents can be the owning ops arrays.
 * Optional goals/taskLinks require explicit IDs; prose/title/time never creates an edge.
 */
function scopedGraph(base,state,f,options) {
  const project=(f.projects || []).find(p=>p.id===base.scope),agents=(f.agents || []).filter(a=>a.project===base.scope || (project&&a.scope===project.name))
  const requested=options.agent || state.agent || (base.kind==='agent'?agents.find(a=>a.role==='builder')?.id:'')
  const actor=requested?agents.find(a=>a.id===requested):null
  const display=project?.name || base.scope
  const model={...base,generic:true,agent:requested || '',revision:null,title:base.kind==='agent'?`История ${actor?.name || requested || 'выбранного агента'} · ${display}`:({plan:`Целевой план ${display}`,history:`История работы ${display}`,decisions:`История решений ${display}`})[base.kind],summary:'Проекция переданных записей выбранного scope. Отсутствующий Run или связь не восстанавливаются по соседним проектам.',nodes:[],edges:[],diagnostics:[],runOptions:[]}
  if(base.kind==='agent'&&(!requested||!actor))return {...model,asOf:null,unavailable:'В этом Project выбранный агент не найден. История другого агента не подставляется.'}
  if(['loading','empty'].includes(state.read))return model
  const allTasks=(Array.isArray(f.tasks)?f.tasks:Object.values(f.tasks || {})).filter(t=>t.project===base.scope)
  const uniqueName=actor&&agents.filter(a=>a.name===actor.name).length===1
  const actorMatches=value=>Boolean(actor)&&(value===actor.id || value===actor.binding || (uniqueName&&(value===actor.name || value===`${actor.name} · ${actor.provider}`)))
  const actorOwns=t=>actorMatches(t.runner)||actorMatches(t.assignee)||actorMatches(t.owner)||actorMatches(t.created_by)||actorMatches(t.creator)||(uniqueName&&String(t.origin || '').startsWith('Добавил '+actor.name+' '))
  if(!project&&!allTasks.length)return {...model,asOf:null,unavailable:'Нет переданных записей этого Project. Данные Atlas не подставляются.'}
  const rawRuns=(Array.isArray(f.projectRuns)?f.projectRuns:Object.values(f.projectRuns || {})).filter(r=>r.project===base.scope&&allTasks.some(t=>t.id===r.task))
  const actorRun=r=>actorMatches(r.agent)||actorMatches(r.binding)||(actor?.session&&r.session===actor.session)
  const taskIds=new Set((base.kind==='agent'?allTasks.filter(t=>actorOwns(t)||rawRuns.some(r=>r.task===t.id&&actorRun(r))):allTasks).map(t=>t.id))
  const runs=rawRuns.filter(r=>taskIds.has(r.task)&&(base.kind!=='agent'||actorRun(r)))
  model.runOptions=runs.map(r=>[r.id,`${r.task} · ${r.id} · ${r.plan_version || 'версия плана неизвестна'}`])
  if(state.runId&&!runs.some(r=>r.id===state.runId))model.diagnostics.push('Выбранный TaskRun не прочитан в этом scope. Другой прогон не подставляется.')
  const visibleRuns=state.runId?runs.filter(r=>r.id===state.runId):runs
  const tasks=allTasks.filter(t=>taskIds.has(t.id)&&(!state.runId||visibleRuns.some(r=>r.task===t.id)))
  const target=(view,params={})=>href(view,{project:base.scope,...(requested?{agent:requested}:{}),...params})
  const node=(id,type,title,x,y,extra={})=>{if(model.nodes.some(n=>n.id===id))return model.nodes.find(n=>n.id===id);const n={id,type,title,x,y,status:'unknown',claim:'observed',creator:'Не указан в источнике',assignee:'Не назначен',source:id,sourceState:'available',sourceHref:target('reports',{source:id}),task:null,run:null,board:null,...extra};model.nodes.push(n);return n}
  const relation=(from,to,type,label,payload,source)=>{
    if(!model.nodes.some(n=>n.id===from)||!model.nodes.some(n=>n.id===to)){model.diagnostics.push(`Связь ${type}: один из объектов отсутствует в прочитанном scope. Ребро не нарисовано.`);return}
    if(model.edges.some(e=>e.id===`${from}:${type}:${to}`))return
    model.edges.push({id:`${from}:${type}:${to}`,from,to,type,label,payload:payload || 'Payload не приложен к источнику',source:source || 'Источник не приложен',sourceState:source?'available':'missing',sourceHref:source?target('reports',{source}):null})
  }
  const status=t=>({backlog:'planned',review:'pending',admitted:'pending','waiting-ack':'pending',listening:'pending','dispatch-unknown':'unknown','stop-requested':'blocked'})[t] || (Object.hasOwn(STATUS,t)?t:'unknown')
  if(base.kind!=='decisions')for(const [i,t]of tasks.entries())node(t.id,'task',t.title,40+(i%3)*340,70+Math.floor(i/3)*250,{status:status(t.state),claim:t.checked?'verified':'observed',creator:t.created_by || t.creator || t.origin || 'Не указан в источнике',assignee:t.owner || t.assignee || 'Не назначен',source:t.origin_ref || t.origin || t.receipts?.[0]?.id || t.id,verification:t.verification || 'Независимая проверка не прочитана',task:t.id,board:display+' · задачи',href:target('task',{task:t.id}),runs:visibleRuns.filter(r=>r.task===t.id).map(r=>({id:r.id,runId:r.id,iteration:r.iteration,revision:r.plan_version,status:r.phase || r.state}))})
  if(base.kind==='plan') {
    const goals=(Array.isArray(f.goals)?f.goals:Object.values(f.goals || {})).filter(g=>g.project===base.scope)
    for(const [i,g]of goals.entries())node(g.id,'goal',g.title,40,600+i*230,{status:status(g.state || 'running'),claim:'declared',creator:g.author || 'Не указан',source:g.revision || g.id,href:target('goals',{goal:g.id})})
    for(const g of goals)for(const id of g.tasks || [])relation(g.id,id,'membership','Входит в цель','Явный tasks reference цели',g.revision || g.id)
    for(const l of (f.taskLinks || []))if(l.project===base.scope&&l.rel==='membership')relation(l.from,l.to,'membership','Входит в цель',l.payload,l.source)
    for(const t of tasks)if(t.goal_id || t.goalRef)relation(t.goal_id || t.goalRef,t.id,'membership','Входит в цель','Явный goal reference задачи',t.id)
    const membership=unique(model.edges.filter(e=>e.type==='membership').map(e=>e.to))
    model.progress={done:tasks.filter(t=>membership.includes(t.id)&&t.state==='done').length,total:membership.length}
    const orphan=tasks.filter(t=>!membership.includes(t.id));if(orphan.length)model.diagnostics.push(`Без прочитанной принадлежности цели: ${orphan.map(t=>t.id).join(', ')}. Это backlog, а не подтверждённая декомпозиция.`)
    if(!goals.length)model.diagnostics.push('Декларация цели и её revision не переданы. Не присваиваем plan-v2 другого проекта.')
  } else if(base.kind==='history'||base.kind==='agent') {
    const taskRows=Math.ceil(tasks.length/3)
    for(const [i,r]of visibleRuns.entries()) {
      const steps=Array.isArray(r.steps)?r.steps.map((s,index)=>({id:s.id || `${r.id}:step-${index}`,title:s.title || s.label || 'Название не прочитано',status:status(s.status),claim:'declared'})):Array.isArray(r.step_states)?r.step_states.map((s,index)=>({id:`${r.id}:step-${index}`,title:(f.steps || [])[index]?.label || `Шаг ${index+1}`,status:s,claim:'declared'})):[]
      node(r.id,'run',`${r.task} · прогон ${r.iteration || '?'}`,40+(i%3)*340,100+taskRows*250+Math.floor(i/3)*250,{status:status(r.phase || r.state),claim:r.checked?'verified':'observed',creator:r.agent || r.binding || 'Агент не прочитан',assignee:agents.find(a=>a.id===r.agent || a.binding===r.binding)?.name || 'Автор запуска неизвестен',task:r.task,run:r.iteration || '?',runId:r.id,revision:r.plan_version || 'Версия плана не прочитана',source:r.command || r.receipts?.[0]?.id || r.id,time:[r.started,r.ended].filter(Boolean).join(' → ') || 'Время не прочитано',href:target('run',{task:r.task,run:r.id}),sourceHref:target('run',{task:r.task,run:r.id}),steps,detail:`${steps.length?'Шаги относятся только к этому прогону.':'План шагов не передан; статусы другого прогона не подставляются.'} ${r.evidence || ''} Delivery: ${r.delivery || 'не прочитана'}. Provider session ${r.session || 'не прочитана'} не заменяет TaskRun ${r.id}.`})
      relation(r.task,r.id,'execution','Допущенный прогон',`Явный TaskRun ${r.id}; command ${r.command || 'не прочитан'}; plan ${r.plan_version || 'не прочитан'}`,r.command || r.id)
    }
    if(!visibleRuns.length&&tasks.length)model.diagnostics.push('Прочитаны задачи, но TaskRun выбранного агента/проекта не переданы. История прогонов неизвестна; это не утверждение, что запусков не было.')
    for(const [i,q]of (f.questions || []).filter(q=>q.project===base.scope&&taskIds.has(q.task)).entries()) {
      const authored=actorMatches(q.agent)||actorMatches(q.created_by)||(uniqueName&&String(q.origin || '').startsWith(actor.name+' · '))
      if(base.kind==='agent'&&!authored)continue
      node(q.id,'question',q.title,1120,70+i*240,{status:q.state==='resolved'?'done':'open',creator:q.created_by || q.origin || 'Не указан',assignee:q.owner || 'Не указан',task:q.task,source:q.id,board:display+' · вопросы',href:target('question',{task:q.task,question:q.id})})
      relation(q.task,q.id,'question','Вопрос задачи','Явный task reference вопроса',q.id)
    }
  } else {
    for(const [i,d]of (f.decisions || []).filter(d=>d.project===base.scope).entries())node(d.id,'decision',d.title,40+(i%3)*350,70+Math.floor(i/3)*250,{status:d.state==='superseded'?'superseded':'active',creator:d.author || 'Автор не указан в fixture',task:d.task || null,source:d.id,href:target('decisions',{decision:d.id}),rationale:d.reason || 'Записанное основание не приложено.',citations:Array.isArray(d.evidence)?d.evidence:d.evidence?[String(d.evidence)]:[],...decisionProvenance(d,f,base.scope,base.agent),retrieval:'Отдельная квитанция retrieval не передана.'})
    for(const d of (f.decisions || []).filter(d=>d.project===base.scope))if(d.supersedes)relation(d.supersedes,d.id,'supersession','Новое решение','Явный supersedes, без удаления старого основания',d.id)
  }
  for(const link of (f.taskLinks || []))if(link.project===base.scope && (base.kind!=='plan'||dependencyKinds.has(link.rel || link.type)))relation(link.from,link.to,link.rel || link.type,'Связь: '+(link.rel || link.type),link.payload,link.source)
  for(const t of tasks){
    if(base.kind==='plan')for(const need of t.needs || [])relation(typeof need==='string'?need:need.task,t.id,'needs','Необходимый результат',typeof need==='object'?need.payload:null,t.id)
    else if(base.kind!=='decisions' && t.origin_ref && allTasks.some(p=>p.id===t.origin_ref))relation(t.origin_ref,t.id,'creation','Создано из задачи','Явный origin_ref',t.id)
  }
  if(base.kind==='plan') {
    const deps=model.edges.filter(e=>dependencyKinds.has(e.type)),degree=new Map(model.nodes.map(n=>[n.id,0]))
    for(const e of deps)degree.set(e.to,degree.get(e.to)+1)
    const queue=[...degree].filter(([,d])=>d===0).map(([id])=>id);let visited=0
    while(queue.length){const id=queue.shift();visited++;for(const e of deps.filter(e=>e.from===id)){degree.set(e.to,degree.get(e.to)-1);if(degree.get(e.to)===0)queue.push(e.to)}}
    if(visited<model.nodes.length)model.diagnostics.push('Цикл зависимостей в прочитанном target плане. Нельзя считать такую версию исполнимым DAG; источники сохранены для исправления.')
  }
  if(state.read==='unlinked') {model.edges=[];model.diagnostics.push('Срез без записанных отношений: объекты доступны списком, ребра не выдуманы.')}
  if(!model.nodes.length)model.diagnostics.push('Нет прочитанных объектов выбранного scope. Это не подтверждение отсутствия работы во всех источниках.')
  if(['missing-source','denied-source'].includes(state.read)&&model.nodes.length){const n=model.nodes[0];n.sourceState=state.read==='denied-source'?'denied':'missing';n.sourceHref=null;if(n.sourceState==='denied')n.source='Защищённый источник'}
  model.previewIds=[...model.nodes.filter(n=>n.type==='run').slice(-1),...model.nodes.filter(n=>n.type!=='run')].slice(0,4).map(n=>n.id)
  model.bounds={width:Math.max(900,...model.nodes.map(n=>n.x+290)),height:Math.max(530,...model.nodes.map(n=>n.y+190))}
  return model
}
export function visibleGraph(model,state) {
  const query=state.query.toLocaleLowerCase('ru')
  const filtered=model.nodes.filter(n=>(state.status==='all'||n.status===state.status)&&(state.type==='all'||n.type===state.type)&&(!query||[n.id,n.title,n.creator,n.assignee,n.source].join(' ').toLocaleLowerCase('ru').includes(query)))
  const compact=state.compact
  const candidates=compact?filtered.filter(n=>(model.previewIds || model.nodes.map(x=>x.id)).includes(n.id)):filtered
  const allowed=candidates.slice(0,compact?4:state.limit), ids=new Set(allowed.map(n=>n.id))
  return {nodes:allowed,edges:model.edges.filter(e=>ids.has(e.from)&&ids.has(e.to)),total:model.nodes.length,matched:filtered.length,hidden:model.nodes.length-allowed.length,remaining:filtered.length-allowed.length}
}
export function reduceGraphState(previous,action,model) {
  const s=createGraphState(previous)
  if(action.type==='select')s.selected=(model.nodes.some(n=>'node:'+n.id===action.value)||model.edges.some(e=>'edge:'+e.id===action.value))?action.value:''
  if(action.type==='mode'&&['graph','list','outline'].includes(action.value))s.mode=action.value
  if(action.type==='filter') {if(['status','type','query'].includes(action.key))s[action.key]=String(action.value);s.limit=12;s.fitted=false}
  if(action.type==='clear'){s.query='';s.type='all';s.status='all';s.limit=12;s.selected='';s.fitted=false}
  if(action.type==='more')s.limit=Math.min(500,s.limit+12)
  if(action.type==='run'){s.run=Number(action.value)===1?1:2;s.revision=`plan-v${s.run}`;s.selected='';s.fitted=false}
  if(action.type==='planRevision'){s.planRevision=String(action.value || '');s.selected='';s.fitted=false}
  if(action.type==='runId'){s.runId=String(action.value || '');s.selected='';s.fitted=false}
  if(action.type==='revision'){s.revision=action.value==='plan-v1'?'plan-v1':'plan-v2';s.selected='';s.fitted=false}
  if(action.type==='expand')s.expanded=!s.expanded
  if(action.type==='pan'){s.camera.x=clamp(s.camera.x+finite(action.x),-10000,10000);s.camera.y=clamp(s.camera.y+finite(action.y),-10000,10000);s.fitted=true}
  if(action.type==='zoom') {
    const old=s.camera.zoom,zoom=clamp(old*finite(action.factor,1),.25,2),x=finite(action.x),y=finite(action.y)
    s.camera={zoom,x:x-(x-s.camera.x)*zoom/old,y:y-(y-s.camera.y)*zoom/old};s.fitted=true
  }
  if(action.type==='fit') {
    const vis=visibleGraph(model,{...s,compact:action.compact}),x=Math.min(0,...vis.nodes.map(n=>n.x-30)),y=Math.min(0,...vis.nodes.map(n=>n.y-30))
    const width=Math.max(300,...vis.nodes.map(n=>n.x+280))-x,height=Math.max(180,...vis.nodes.map(n=>n.y+175))-y
    const zoom=clamp(Math.min((finite(action.width,900)-40)/width,(finite(action.height,530)-40)/height),.25,1)
    s.camera={zoom,x:(finite(action.width,900)-width*zoom)/2-x*zoom,y:(finite(action.height,530)-height*zoom)/2-y*zoom};s.fitted=true
  }
  const result=createGraphState(s)
  if(action.type==='filter'||action.type==='clear') {
    const vis=visibleGraph(model,result)
    if(![...vis.nodes.map(n=>'node:'+n.id),...vis.edges.map(e=>'edge:'+e.id)].includes(result.selected))result.selected=''
  }
  return result
}
const PARAMS={planRevision:'graphPlanRevision',run:'graphRun',runId:'graphTaskRun',agent:'agent',revision:'graphRevision',selected:'graphSelected',mode:'graphMode',status:'graphStatus',type:'graphType',query:'graphQuery',read:'graphRead',limit:'graphLimit'}
export function graphRouteState(input) {
  const p=input instanceof URLSearchParams?input:new URLSearchParams(String(input || '').split('?').slice(1).join('?') || String(input || ''))
  const values=Object.fromEntries(Object.entries(PARAMS).flatMap(([key,param])=>p.has(param)?[[key,p.get(param)]]:[]))
  if(p.has('graphCamera')){const [x,y,zoom]=p.get('graphCamera').split(',').map(Number);values.camera={x,y,zoom};values.fitted=true}
  return createGraphState(values)
}
export function graphReturnHref(kind,state,project='atlas',agent='') {
  const s=createGraphState(state),params={project}
  for(const [key,param]of Object.entries(PARAMS))params[param]=s[key]
  if(agent)params.agent=agent
  params.graphCamera=[s.camera.x,s.camera.y,s.camera.zoom].join(',')
  return href(KINDS[graphKind(kind)].route,params)
}
const statusBadge=n=>`<span class="fg-status fg-status-${html(n.status)}"><i aria-hidden="true"></i>${html(n.claim==='declared'&&n.status==='active'?'В работе':STATUS[n.status] || n.status)}</span>`
const button=(label,act,value='',extra='')=>`<button type="button" class="fg-button" data-graph-action="${html(act)}" data-graph-value="${html(value)}" ${extra}>${html(label)}</button>`
const select=(label,key,values,current)=>`<label class="fg-field"><span>${html(label)}</span><select data-graph-control="${html(key)}">${values.map(([id,name])=>`<option value="${html(id)}" ${String(current)===String(id)?'selected':''}>${html(name)}</option>`).join('')}</select></label>`
const targetLink=(label,url)=>url?`<a class="fg-button" data-graph-navigate href="${html(url)}">${html(label)}</a>`:''
const safeTarget=value=>typeof value==='string'&&value.startsWith('#view-')?value:null
function inspector(model,state) {
  const node=model.nodes.find(n=>'node:'+n.id===state.selected),edge=model.edges.find(e=>'edge:'+e.id===state.selected)
  if(!node&&!edge)return `<h3>Разобрать связь</h3><p>Выберите узел или подпись ребра. Сначала откроются его источник, автор и адрес назначения.</p><p class="fg-meta">Enter — выбрать. Tab — перейти к управлению. На холсте стрелки перемещают обзор; + / − меняют масштаб.</p>`
  if(edge)return `<div class="fg-inspector-head"><h3>${html(edge.label)}</h3>${button('Закрыть','select')}</div><p class="fg-eyebrow">${html(edge.type)}</p><p>${html(edge.payload)}</p><dl><dt>Откуда</dt><dd>${button(edge.from,'select','node:'+edge.from)}</dd><dt>Куда</dt><dd>${button(edge.to,'select','node:'+edge.to)}</dd><dt>Источник отношения</dt><dd>${html(edge.source)}</dd></dl>${targetLink('Открыть источник отношения',safeTarget(edge.sourceHref))}<p class="fg-meta">Это записанное отношение примера. Близкое время событий само по себе не создаёт ребро.</p>`
  const related=model.edges.filter(e=>e.from===node.id||e.to===node.id)
  return `<div class="fg-inspector-head"><h3>${html(node.id)}</h3>${button('Закрыть','select')}</div><p class="fg-node-title">${html(node.title)}</p>${statusBadge(node)}<p class="fg-meta">${html(CLAIMS[node.claim])} · ${html(TYPES[node.type])}</p><dl>${[['Автор / происхождение',node.creator],['Назначен',node.assignee],['Доска назначения',node.board],['Задача',node.task],['Прогон',node.run?`${node.run} · ${node.revision || 'отдельная запись'}`:null],['Время записи',node.time],['Источник',node.source],['Проверка',node.verification]].filter(([,v])=>v).map(([label,v])=>`<dt>${html(label)}</dt><dd>${html(v)}</dd>`).join('')}</dl>${node.detail?`<p>${html(node.detail)}</p>`:''}${node.rationale?`<h4>Записанное основание</h4><p>${html(node.rationale)}</p><h4>Явные цитаты</h4><p>${html(node.citations.join(', '))}</p><h4>Переданный контекст</h4><p>${html(node.suppliedContext)}</p>${node.sourceState==='available'?targetLink('Открыть точный контекст '+node.contextPack,safeTarget(node.contextHref)):node.contextHref?'<p class="fg-notice">Источник пакета недоступен в этом срезе.</p>':''}${node.contextNote?`<p class="fg-meta">${html(node.contextNote)}</p>`:''}<h4>Последующие retrieval</h4><p>${html(node.retrieval)}</p>`:''}${node.steps?`<h4>Шаги этого прогона</h4><p class="fg-meta">Статус шага — заявление агента. Проверка результата указана отдельно.</p><ol class="fg-step-list">${node.steps.map(step=>`<li>${html(step.title)} ${statusBadge(step)}</li>`).join('')}</ol>`:''}${node.runs?`<h4>Независимые прогоны</h4>${node.runs.map(r=>targetLink(`Прогон ${r.iteration} · ${r.revision}`,href('run',{project:model.scope,agent:model.agent,run:r.runId || r.id || r.iteration,task:node.id}))).join('')}`:''}<h4>Связи</h4>${related.length?related.map(e=>button(`${e.from} → ${e.to} · ${e.label}`,'select','edge:'+e.id)).join(''):'<p>Подтверждённых отношений нет.</p>'}<div class="fg-owner-links">${node.sourceState==='available'?targetLink('Открыть объект',safeTarget(node.href))+targetLink('Открыть источник',safeTarget(node.sourceHref)):`<p class="fg-notice">${node.sourceState==='denied'?'Нет доступа к источнику. Защищённое содержимое не показано.':'Источник не найден. Старый объект сохранён; новый источник не подставлен.'}</p>`}${node.task?targetLink(`К задаче ${node.task}`,href('task',{project:model.scope,agent:model.agent,task:node.task})):''}${node.run?targetLink(`К прогону ${node.run}`,href('run',{project:model.scope,agent:model.agent,task:node.task,run:node.runId || node.run})):''}</div>`
}
function line(model,e) {
  const a=model.nodes.find(n=>n.id===e.from),b=model.nodes.find(n=>n.id===e.to),x1=a.x+250,y1=a.y+66,x2=b.x,y2=b.y+66
  // Returns through different events are legal in factual history. Use a loop lane.
  if(x2<=x1)return {d:`M${x1},${y1} C${x1+55},${y1+180} ${x2-55},${y2+180} ${x2},${y2}`,x:(x1+x2)/2,y:Math.max(y1,y2)+125}
  return {d:`M${x1},${y1} C${x1+55},${y1} ${x2-55},${y2} ${x2},${y2}`,x:(x1+x2)/2,y:(y1+y2)/2}
}
function readNotice(state) {
  const texts={partial:'Прочитана часть источников. Видимые записи не означают полную историю.',stale:'Сохранён снимок на 09:42. Более новые события не заменяют выбранную версию.',reconnect:'Связь восстанавливается. Последний прочитанный снимок остаётся доступен.',error:'Не удалось обновить граф. Сохранённый снимок доступен; итоговые количества относятся к нему.',truncated:'Показана первая часть снимка. Откройте следующие записи; скрытые объекты не считаются отсутствующими.', 'old-plan':'Выбрана историческая версия. Текущие изменения не переписывают её состав.'}
  return texts[state.read]?`<p class="fg-notice" role="status">${html(texts[state.read])}</p>`:''
}
function body(model,state,{compact,id}) {
  const vis=visibleGraph(model,{...state,compact}), selected=state.selected
  if(model.unavailable)return `<div class="fg-empty"><h3>Нет графа для выбранного проекта</h3><p>${html(model.unavailable)}</p><p>Переход к Atlas должен явно сменить проект и очистить черновик.</p></div>`
  if(state.read==='loading')return `<div class="fg-empty" role="status"><h3>Читаем историю ${html(model.scope)}</h3><p>Журнал и связи ещё не прочитаны. Количество задач неизвестно.</p></div>`
  if(!model.nodes.length)return `<div class="fg-empty"><h3>В этом срезе нет доступных объектов</h3><p>${html(model.generic?model.diagnostics.join(' ') || 'В переданном срезе нет объектов выбранного scope.':'Источники прочитаны. Первая задача и её отношения появятся после записи работы.')}</p></div>`
  if(compact) {
    const focus=vis.nodes.find(n=>'node:'+n.id===state.selected) || vis.nodes.find(n=>n.type==='run') || vis.nodes.find(n=>n.id==='AT-42') || vis.nodes[0]
    return `${readNotice(state)}<div class="fg-preview-strip" role="group" aria-label="Текущий фрагмент: выберите объект">${vis.nodes.map(n=>`<button type="button" class="fg-preview-card" data-graph-action="select" data-graph-value="${html('node:'+n.id)}" aria-pressed="${n.id===focus?.id}"><span>${html(n.id)}</span>${statusBadge(n)}</button>`).join('')}</div>${focus?`<div class="fg-preview-detail"><strong>${html(focus.title)}</strong><p>${html(focus.assignee)} · ${html(CLAIMS[focus.claim])}${focus.revision?' · '+html(focus.revision):''}</p>${focus.steps?`<p>${focus.steps.filter(s=>s.status==='done').length} / ${focus.steps.length} шагов заявлено завершёнными · независимая приёмка отдельно</p>`:''}${vis.nodes.some(n=>n.id==='Q-12')?'<p>Открыт Q-12 · решение по проверке staging ещё не получено.</p>':''}</div>`:''}<div class="fg-coverage"><span>Текущий фрагмент: ${vis.nodes.length} из ${vis.total} · записанных связей ${vis.edges.length}</span>${targetLink('Открыть полный '+(model.kind==='plan'?'план':'граф'),graphReturnHref(model.kind,{...state,limit:12},model.scope,model.agent))}</div>`
  }
  const mode=state.read==='unlinked'&&state.mode==='graph'?'list':state.mode
  const nodes=vis.nodes.map(n=>`<button type="button" class="fg-node ${selected==='node:'+n.id?'is-selected':''}" style="left:${n.x}px;top:${n.y}px" data-graph-action="select" data-graph-value="${html('node:'+n.id)}" aria-pressed="${selected==='node:'+n.id}"><span class="fg-node-kicker">${html(TYPES[n.type])} · ${html(n.id)}</span><strong>${html(n.title)}</strong>${statusBadge(n)}<span class="fg-meta">${html(n.assignee)} · ${html(CLAIMS[n.claim])}</span></button>`).join('')
  const edges=vis.edges.map(e=>{const p=line(model,e);return `<path class="fg-edge ${selected==='edge:'+e.id?'is-selected':''}" d="${p.d}" marker-end="url(#${html(id)}-arrow)"/>`}).join('')
  const labels=vis.edges.map(e=>{const p=line(model,e);return `<button class="fg-edge-label" type="button" style="left:${p.x}px;top:${p.y}px" data-graph-action="select" data-graph-value="${html('edge:'+e.id)}" aria-label="${html(e.from+' → '+e.to+': '+e.label)}" aria-pressed="${selected==='edge:'+e.id}">${html(e.label)}</button>`}).join('')
  const list=`<div class="fg-data-list" ${mode==='graph'?'hidden':''}>${vis.nodes.map(n=>`<article class="fg-list-row"><div>${button(n.id+' · '+n.title,'select','node:'+n.id,`aria-pressed="${selected==='node:'+n.id}"`)}<p class="fg-meta">${html(n.creator)} → ${html(n.assignee)} · ${html(n.source)}</p></div>${statusBadge(n)}${mode==='outline'?`<ul>${vis.edges.filter(e=>e.from===n.id).map(e=>`<li>${button(`${e.label} → ${e.to}`,'select','edge:'+e.id)}</li>`).join('')||'<li>Нет исходящих связей в выбранном срезе.</li>'}</ul>`:''}</article>`).join('')}</div>`
  return `${readNotice(state)}${model.diagnostics.map(d=>`<p class="fg-notice">${html(d)}</p>`).join('')}<div class="fg-workspace"><div class="fg-main">${!compact?`<div class="fg-camera-tools">${button('−','zoom','out','aria-label="Уменьшить масштаб"')}<output data-graph-zoom>${Math.round(state.camera.zoom*100)}%</output>${button('+','zoom','in','aria-label="Увеличить масштаб"')}${button('Вместить граф','fit')}${button(state.expanded?'Свернуть обзор':'Развернуть обзор','expand')}<span class="fg-meta">Перетаскивайте фон · Ctrl/⌘ + колесо — масштаб</span></div>`:''}<div class="fg-viewport" data-graph-viewport tabindex="0" role="region" aria-label="${html(model.title)}. Стрелки перемещают обзор, плюс и минус меняют масштаб, 0 вмещает граф." ${mode!=='graph'?'hidden':''}><div class="fg-world" style="width:${model.bounds.width}px;height:${model.bounds.height}px;transform:translate(${state.camera.x}px,${state.camera.y}px) scale(${state.camera.zoom})"><svg class="fg-wires" width="${model.bounds.width}" height="${model.bounds.height}" aria-hidden="true"><defs><marker id="${html(id)}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z"/></marker></defs>${edges}</svg>${nodes}${labels}</div></div>${list}${!vis.nodes.length?`<p class="fg-empty">В выбранном фильтре нет объектов. ${button('Сбросить фильтры','clear')}</p>`:''}<div class="fg-coverage" aria-live="polite"><span>Показано ${vis.nodes.length} из ${vis.total} · связей ${vis.edges.length} · скрыто ${vis.hidden}</span>${vis.remaining&&!compact?button(`Показать ещё · осталось ${vis.remaining}`,'more'):''}</div>${compact?targetLink('Открыть полный '+(model.kind==='plan'?'план':'граф'),graphReturnHref(model.kind,{...state,limit:12,selected:''},model.scope,model.agent)):''}</div>${compact?'':`<aside class="fg-inspector" data-graph-inspector aria-label="Инспектор выбранного объекта" tabindex="-1">${inspector(model,state)}</aside>`}</div>`
}
export function renderGraph(kind,options={}) {
  kind=graphKind(kind)
  const id=String(options.id || `fg-${kind}-${options.compact?'preview':'full'}`).replace(/[^a-zA-Z0-9_-]/g,'-')
  const state=createGraphState({...options.state,agent:options.agent || options.state?.agent || ''}),scope=options.project || options.state?.project || 'atlas',created=yes(options.created)||yes(options.state?.created),model=createGraphModel(kind,{...options,project:scope,created,state}),compact=yes(options.compact)
  const config={kind,options:{id,compact,graphPlanEdits:projectGraphState(options.graphPlanEdits),memberRole:options.memberRole || 'owner',actor:options.actor || 'operator · fixture',agent:options.agent || state.agent,project:options.project || options.state?.project || 'atlas',created:yes(options.created)||yes(options.state?.created),fixtures:model.unavailable?{tasks:[],runs:[],steps:[]}:options.fixtures || DEFAULTS},state}
  return `<section class="fg-explorer ${compact?'fg-compact':''} ${state.expanded?'fg-expanded':''}" data-graph-id="${html(id)}" data-graph-kind="${kind}"><script type="application/json" data-graph-config>${json(config)}</script><header class="fg-header"><div><p class="fg-eyebrow">${html(model.label)}</p><h3>${html(model.title)}</h3><p class="fg-meta">${html(model.summary)}</p></div><span class="fg-fixture">Макет · вымышленные данные</span></header><div class="fg-snapshot"><span>${html(model.scope)} · ${model.asOf?html(model.asOf):'нет снимка'} · ${kind==='plan'?html(model.revision || 'Версия декларации не прочитана'):'записанные события'}</span>${model.progress?`<span class="fg-progress"><progress value="${model.progress.done}" max="${model.progress.total || 1}" aria-label="Завершённые задачи в составе версии плана"></progress>${model.progress.done} / ${model.progress.total} задач · завершённые остаются в плане</span>`:''}</div>${compact?'':`<div class="fg-toolbar"><div class="fg-mode" role="group" aria-label="Представление тех же данных">${['graph','list','outline'].map((mode,i)=>button(['Граф','Список','Структура'][i],'mode',mode,`aria-pressed="${state.mode===mode}"`)).join('')}</div>${kind==='plan'&&!model.generic?select('Версия плана','revision',[['plan-v1','plan-v1 · до проверки'],['plan-v2','plan-v2 · текущая']],state.revision):kind!=='plan'&&model.generic&&model.runOptions?.length?select('Записанные прогоны','runId',[['','Все прочитанные'],...model.runOptions],state.runId):kind==='agent'&&!model.generic?select('Прогон Builder','run',[[1,'1 · plan-v1'],[2,'2 · plan-v2']],state.run):''}<details class="fg-filters"><summary>Фильтры${state.query||state.type!=='all'||state.status!=='all'?' · применены':''}</summary><div>${select('Статус','status',[['all','Все статусы'],...Object.entries(STATUS)],state.status)}${select('Тип объекта','type',[['all','Все объекты'],...Object.entries(TYPES)],state.type)}<label class="fg-field"><span>Найти объект или автора</span><input data-graph-control="query" type="search" value="${html(state.query)}"></label>${button('Сбросить фильтры','clear')}</div></details></div>`}<div data-graph-plan-editor>${planEditor(model,state,{...options,project:scope,compact})}</div><div data-graph-body>${body(model,state,{compact,id})}</div><details class="fg-legend"><summary>Статусы, отношения и границы снимка</summary><div class="fg-status-legend">${['running','done','failed','blocked','planned','unknown'].map(status=>statusBadge({status})).join('')}</div><p>Цвет сопровождается словом. «Заявлено» — сообщение агента; «Записанное событие» — наблюдаемая запись; «Проверено по источнику» — отдельная квитанция проверки в примере.</p><p>${html(unique(model.edges.map(e=>e.label)).join(' · ') || 'Подтверждённых отношений нет.')}</p><p>Все даты и записи вымышлены. Граф — представление источников; фильтр, масштаб и раскладка не меняют работу или полномочия.</p></details><noscript><p>Интерактивный инспектор требует JavaScript. Ниже тот же набор объектов и записанных отношений.</p><ul>${model.nodes.map(n=>`<li>${html(n.id+' · '+n.title+' · '+(STATUS[n.status]||n.status))}${targetLink('Открыть объект',safeTarget(n.href))}</li>`).join('')}</ul><ul>${model.edges.map(e=>`<li>${html(e.from+' → '+e.to+' · '+e.label+' · '+e.source)}</li>`).join('')}</ul></noscript></section>`
}
const attached=new WeakMap()
/** Hydrate any number of independently scoped graph widgets. Safe to call again. */
export function attachGraphInteractions(root,options={}) {
  const widgets=[...(root.matches?.('.fg-explorer')?[root]:[]),...root.querySelectorAll('.fg-explorer')]
  const cleanups=[]
  for(const widget of widgets) {
    if(attached.has(widget)){cleanups.push(attached.get(widget));continue}
    const config=JSON.parse(widget.querySelector('[data-graph-config]').textContent),id=config.options.id,kind=config.kind
    let state=createGraphState(config.state),model=createGraphModel(kind,{...config.options,state}),drag=null,disposed=false
    const listeners=[]
    const listen=(event,fn,opts)=>{widget.addEventListener(event,fn,opts);listeners.push(()=>widget.removeEventListener(event,fn,opts))}
    const emit=()=>options.onStateChange?.(structuredClone(state),{id,kind,project:model.scope})
    const camera=()=>{const world=widget.querySelector('.fg-world');if(world)world.style.transform=`translate(${state.camera.x}px,${state.camera.y}px) scale(${state.camera.zoom})`;const out=widget.querySelector('[data-graph-zoom]');if(out)out.textContent=Math.round(state.camera.zoom*100)+'%'}
    const dimensions=()=>{const viewport=widget.querySelector('[data-graph-viewport]');return {width:viewport?.clientWidth || 900,height:viewport?.clientHeight || 530}}
    const fit=()=>{state=reduceGraphState(state,{type:'fit',...dimensions(),compact:config.options.compact},model);camera()}
    const draw=(focus='')=>{
      model=createGraphModel(kind,{...config.options,state});widget.querySelector('[data-graph-body]').innerHTML=body(model,state,config.options)
      widget.querySelector('[data-graph-plan-editor]').innerHTML=planEditor(model,state,config.options)
      widget.classList.toggle('fg-expanded',state.expanded)
      for(const b of widget.querySelectorAll('[data-graph-action="mode"]'))b.setAttribute('aria-pressed',String(b.dataset.graphValue===state.mode))
      for(const input of widget.querySelectorAll('[data-graph-control]'))if(input.value!==String(state[input.dataset.graphControl]))input.value=state[input.dataset.graphControl]
      const snapshot=widget.querySelector('.fg-snapshot');if(kind==='plan'&&!model.unavailable)snapshot.innerHTML=`<span>${html(model.scope)} · ${html(model.asOf)} · ${html(model.revision || 'Версия декларации не прочитана')}</span><span class="fg-progress"><progress value="${model.progress?.done || 0}" max="${model.progress?.total || 1}" aria-label="Завершённые задачи версии"></progress>${model.progress?.done || 0} / ${model.progress?.total || 0} задач · завершённые остаются в плане</span>`
      if(!state.fitted)fit();else camera()
      if(focus==='inspector')widget.querySelector('[data-graph-inspector]')?.focus({preventScroll:true})
      else if(focus){const el=[...widget.querySelectorAll('[data-graph-action]')].find(b=>b.dataset.graphAction===focus);el?.focus({preventScroll:true})}
    }
    const dispatch=(action,focus='')=>{state=reduceGraphState(state,action,model);if(['pan','zoom','fit'].includes(action.type))camera();else draw(focus);emit()}
    listen('click',event=>{
      const link=event.target.closest?.('[data-graph-navigate]');if(link&&widget.contains(link)){options.onNavigate?.({href:link.getAttribute('href'),returnHref:graphReturnHref(kind,state,model.scope,model.agent),state:structuredClone(state),id,kind},event);return}
      const control=event.target.closest?.('[data-graph-action]');if(!control||!widget.contains(control))return
      event.preventDefault();event.stopPropagation();const act=control.dataset.graphAction,value=control.dataset.graphValue
      if(act==='zoom')dispatch({type:'zoom',factor:value==='in'?1.2:1/1.2,x:dimensions().width/2,y:dimensions().height/2})
      else if(act==='fit')dispatch({type:'fit',...dimensions(),compact:config.options.compact})
      else if(act==='select'&&config.options.compact){const s=reduceGraphState(state,{type:'select',value},model);state=s;draw();emit();const full=widget.querySelector('[data-graph-navigate]');if(full){full.href=graphReturnHref(kind,s,model.scope,model.agent);full.textContent='Разобрать выбранное в полном графе';full.focus()}}
      else dispatch({type:act,value},act==='select'?(value?'inspector':'fit'):act)
    })
    listen('submit',event=>{
      const form=event.target;if(!form.matches('[data-graph-plan-form],[data-graph-plan-rebase]'))return
      event.preventDefault();event.stopPropagation();if(form.querySelector('button[type="submit"],button')?.disabled)return
      const values=Object.fromEntries(new FormData(form)),action=form.matches('[data-graph-plan-rebase]')?{...values,type:'rebase'}:values
      config.options.graphPlanEdits=transitionGraphPlan(config.options.graphPlanEdits,action,{...config.options,state,read:state.read,planRevision:state.planRevision})
      const entry=config.options.graphPlanEdits.projects[model.scope];state.fitted=false;if(!entry.error)state.planRevision=''
      draw();options.onPlanChange?.(structuredClone(config.options.graphPlanEdits),{project:model.scope,revision:entry.receipt,operation:action.type,error:entry.error});emit()
    })
    listen('change',event=>{const key=event.target.dataset.graphControl;if(!key||key==='query')return;event.stopPropagation();dispatch(['run','runId','revision','planRevision'].includes(key)?{type:key,value:event.target.value}:{type:'filter',key,value:event.target.value})})
    listen('input',event=>{if(event.target.dataset.graphControl==='query'){event.stopPropagation();dispatch({type:'filter',key:'query',value:event.target.value})}})
    listen('keydown',event=>{
      if(event.target.matches('input,select,textarea'))return
      if(event.key==='Escape'){if(state.expanded){dispatch({type:'expand'},'expand');event.preventDefault();event.stopPropagation()}else if(state.selected){dispatch({type:'select',value:''},'fit');event.preventDefault();event.stopPropagation()}return}
      if(!event.target.matches('[data-graph-viewport]'))return
      const moves={ArrowLeft:[55,0],ArrowRight:[-55,0],ArrowUp:[0,55],ArrowDown:[0,-55]}
      if(moves[event.key])dispatch({type:'pan',x:moves[event.key][0],y:moves[event.key][1]})
      else if(['+','=','-'].includes(event.key))dispatch({type:'zoom',factor:event.key==='-'?1/1.2:1.2,x:dimensions().width/2,y:dimensions().height/2})
      else if(event.key==='0')dispatch({type:'fit',...dimensions(),compact:config.options.compact});else return
      event.preventDefault();event.stopPropagation()
    })
    listen('wheel',event=>{if(!(event.ctrlKey||event.metaKey)||!event.target.closest('[data-graph-viewport]'))return;event.preventDefault();event.stopPropagation();const rect=widget.querySelector('[data-graph-viewport]').getBoundingClientRect();dispatch({type:'zoom',factor:event.deltaY<0?1.1:1/1.1,x:event.clientX-rect.left,y:event.clientY-rect.top})},{passive:false})
    listen('pointerdown',event=>{if(event.button!==0||event.target.closest('button,a')||!event.target.closest('[data-graph-viewport]'))return;const viewport=widget.querySelector('[data-graph-viewport]');drag={id:event.pointerId,x:event.clientX,y:event.clientY,viewport};viewport.setPointerCapture?.(event.pointerId);event.preventDefault()})
    listen('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;dispatch({type:'pan',x:event.clientX-drag.x,y:event.clientY-drag.y});drag.x=event.clientX;drag.y=event.clientY})
    const end=event=>{if(drag?.id===event.pointerId){drag.viewport.releasePointerCapture?.(event.pointerId);drag=null}}
    listen('pointerup',end);listen('pointercancel',end);listen('lostpointercapture',()=>{drag=null})
    if(!state.fitted)fit();emit()
    const cleanup=()=>{if(disposed)return;disposed=true;for(const off of listeners)off();attached.delete(widget);drag=null}
    attached.set(widget,cleanup);cleanups.push(cleanup)
  }
  return ()=>cleanups.forEach(fn=>fn())
}
