// Routine design simulator. Every record belongs to the selected fixture project.
const re = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const routineStores = new Map()
export function registerNotifierRoutine(project,notifier){
  const d=routineStore(project),id=notifier.id||'notifier-'+(d.records.length+1)
  if(d.records.some(r=>r.id===id))return id
  d.records.push({...structuredClone(d.records[0]),id,name:notifier.name||'Уведомление',revision:1,trigger:notifier.routine?.trigger||notifier.trigger||'event',cadence:notifier.routine?.expression||notifier.when||notifier.schedule||notifier.event||'notification.eligible',provider:notifier.agent||'fabric',versions:[],runs:[],state:'paused',notifier:structuredClone(notifier)})
  return id
}
export function sharedCycleState(project,cycleId='retro'){
  const d=routineStore(project),id=cycleId==='retro'?'RT-1':cycleId.startsWith('RT-')||d.records.some(r=>r.id===cycleId)?cycleId:'system-'+cycleId
  let r=d.records.find(r=>r.id===id)
  if(!r){r={...structuredClone(d.records[0]),id,name:cycleId==='project'?'Цикл проекта':'Наблюдение портфеля',versions:[],runs:[],runtime:undefined};d.records.push(r)}
  r.runtime??={paused:r.state==='paused',cadence:'30',timezone:r.timezone,ticks:[],phase:'ready',routineId:id}
  r.runtime.paused=r.state==='paused';r.runtime.timezone=r.timezone
  return r.runtime
}
export function syncSharedCycle(project,cycle){
  if(!cycle)return
  const r=routineStore(project).records.find(r=>r.id===cycle.routineId);if(!r)return
  r.state=cycle.paused?'paused':'active';r.timezone=cycle.timezone
  for(const tick of cycle.ticks){const old=r.runs.find(x=>x.id===tick.id),run={id:tick.id,iteration:cycle.ticks.indexOf(tick)+1,revision:old?.revision??tick.revision??r.revision,provider:old?.provider??tick.provider??r.provider,window:tick.window||'09:42',snapshot:'fixture snapshot 09:42',outcome:tick.status,steps:r.nodes.map((n,i)=>({id:n.id,status:tick.status==='completed'?'done':i===0?tick.status:'pending'}))};if(old)Object.assign(old,run);else r.runs.push(run)}
}
export function routineStore(project='atlas') {
  if(!routineStores.has(project))routineStores.set(project,{selected:'RT-1',draft:null,error:'',payload:'fresh',command:null,records:[{id:'RT-1',name:'Проверка уроков',project,revision:1,trigger:'schedule',cadence:'daily 09:00',timezone:'Europe/Warsaw',catchup:'latest',concurrency:'one',bound:3,provider:'fabric',nodes:[{id:'collect',type:'Observation'},{id:'review',type:'Insight'},{id:'propose',type:'Proposal'}],edges:[{from:'collect',to:'review',input:'observations',type:'Observation',missing:'block',empty:'skip',stale:'refresh'},{from:'review',to:'propose',input:'insights',type:'Insight',missing:'block',empty:'skip',stale:'block'}],versions:[],runs:[],state:'paused'}]})
  return routineStores.get(project)
}
export function seedRoutineProposal(project,artifact){
 const d=routineStore(project),prior=d.records.find(r=>r.source===artifact.id);if(prior)return prior.id;
 const r=structuredClone(d.records[0]);Object.assign(r,{id:'RT-'+(d.records.length+1),name:artifact.title,project,revision:1,versions:[],runs:[],state:'paused',runtime:undefined,source:artifact.id,instruction:artifact.prompt});d.records.push(r);return r.id
}
function selectRoutineDraft(d,id){
 d.editorStates??={};if(d.editorId!==id){if(d.editorId)d.editorStates[d.editorId]={draft:d.draft,reason:d.reason,command:d.command,error:d.error};Object.assign(d,{draft:null,reason:'',command:null,error:''},d.editorStates[id]||{});d.editorId=id}
}
export function validateRoutine(record) {
  if(!record.name.trim())return 'Укажите название цикла.'
  if(!record.cadence.trim())return 'Нужен слот расписания или имя события.'
  if(!Number.isInteger(record.bound)||record.bound<1||record.bound>10)return 'Граница цепочки в примере: от 1 до 10 полных прогонов.'
  try{new Intl.DateTimeFormat('ru',{timeZone:record.timezone}).format()}catch{return 'Неизвестная временная зона.'}
  const ids=new Set(record.nodes.map(n=>n.id)),incoming=new Map(record.nodes.map(n=>[n.id,0]))
  for(const edge of record.edges){if(!ids.has(edge.from)||!ids.has(edge.to))return 'У ребра отсутствует исходный или принимающий шаг.';if(record.nodes.find(n=>n.id===edge.from).type!==edge.type)return 'Тип результата не соответствует входу '+edge.input;incoming.set(edge.to,incoming.get(edge.to)+1)}
  const queue=[...incoming].filter(([,n])=>!n).map(([id])=>id);let seen=0
  while(queue.length){const id=queue.shift();seen++;for(const e of record.edges.filter(e=>e.from===id)){incoming.set(e.to,incoming.get(e.to)-1);if(!incoming.get(e.to))queue.push(e.to)}}
  if(seen!==ids.size)return 'Циклическая зависимость запрещена. Повторы задаются границей полных прогонов, а не ребром назад.'
  return ''
}
const rb=(text,action,extra='')=>`<button class="button" type="button" data-routine-action="${action}" ${extra}>${text}</button>`
const rs=(label,name,values,value)=>`<label class="field"><span>${label}</span><select name="${name}">${values.map(([v,l])=>`<option value="${v}" ${String(value)===v?'selected':''}>${l}</option>`).join('')}</select></label>`
const rf=(label,name,value,type='text')=>`<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${re(value)}" required></label>`
export function renderRoutines(view,state,fixtures){
  if(view!=='routine-editor')return null
  const d=routineStore(state.project),r=d.records.find(r=>r.id===(state.routine||d.selected)),p=fixtures.projects.find(p=>p.id===state.project);if(!r)return `<header class="page-title"><h2>Цикл не найден</h2></header><p>Этот ID отсутствует в выбранном проекте.</p><a class="button" href="#view-cycles?project=${re(state.project)}">К циклам</a>`;selectRoutineDraft(d,r.id);const v=d.draft||r
  return `<header class="page-title"><div><h2 tabindex="-1">Редактор цикла</h2><p>${re(p?.name||state.project)} · ${re(r.id)} · версия ${r.revision} · ${r.state==='paused'?'на паузе':'активен'}</p></div><a class="button" href="#view-cycles?project=${re(state.project)}">К обзору циклов</a></header><div class="subnav">${d.records.map(x=>`<a class="button" href="#view-routine-editor?project=${re(state.project)}&routine=${x.id}">${re(x.name)}</a>`).join('')}${rb('Новый цикл','new')}</div>${d.error?`<div class="notice warning" role="alert">${re(d.error)}</div>`:''}<form class="panel form-panel" data-routine-form="edit">${rf('Название','name',v.name)}${rs('Триггер','trigger',[['schedule','По расписанию'],['event','По событию']],v.trigger)}${rf('Слот расписания / имя события','cadence',v.cadence)}<details class="disclosure"><summary>Исполнение и границы</summary>${rf('Временная зона','timezone',v.timezone)}${rs('Пропущенные окна','catchup',[['latest','Только последнее'],['all','Все по порядку'],['none','Не догонять']],v.catchup)}${rs('Одновременные запуски','concurrency',[['one','Один; новое событие в очередь'],['drop','Один; повторное событие пропустить']],v.concurrency)}${rf('Максимум полных прогонов','bound',v.bound,'number')}${rs('Исполнитель будущих прогонов','provider',[['fabric','Fabric loop'],['claude-code','Claude Code'],['codex','Codex']],v.provider)}</details>${rf('Почему меняем цикл','reason',d.reason||'')}<details class="disclosure"><summary>Шаги и обработка входных данных</summary><section><h3>Граф данных цикла</h3><p class="meta">Вход и тип результата подписаны. Повторение относится ко всему графу.</p><div class="funnel-graph">${v.nodes.map((n,i)=>`<div class="funnel-node"><b>${re(n.id)}</b><span>${re(n.type)}</span>${i<v.nodes.length-1?'<span aria-hidden="true">→</span>':''}</div>`).join('')}</div>${v.edges.map((e,i)=>`<fieldset><legend>${re(e.from+' → '+e.to+' / '+e.input+' : '+e.type)}</legend>${rs('Нет входа',`missing-${i}`,[['block','Заблокировать'],['skip','Пропустить шаг']],e.missing)}${rs('Вход пуст',`empty-${i}`,[['skip','Пропустить шаг'],['run','Выполнить с пустым набором'],['block','Заблокировать']],e.empty)}${rs('Вход устарел',`stale-${i}`,[['refresh','Запросить новый снимок'],['block','Заблокировать'],['allow','Передать с отметкой возраста']],e.stale)}</fieldset>`).join('')}${rb('Проверить ребро назад propose → collect','cycle-edge')}${rb('Убрать ошибочное ребро','reset-edges')}</section></details><button type="submit" class="button primary">Проверить новую версию</button></form>${d.command?`<section class="panel"><h3>Последствия версии ${r.revision+1}</h3><p>Изменятся будущие запуски ${re(r.id)}. История и закреплённые версии прежних прогонов сохраняются.</p><p>${re(r.provider)} → ${re(d.command.provider)} · ${re(d.reason)}</p>${rb('Сохранить версию','commit')}</section>`:''}<section class="panel"><h3>Проверить исполнение</h3><p>Выбранный источник: fixture-observations-09:42. Смена расписания не переписывает снимок, переданный прошлому прогону.</p>${rs('Ответ источника','routine-payload',[['fresh','Свежий снимок'],['missing','Вход отсутствует'],['empty','Пустой набор'],['stale','Снимок устарел']],d.payload)}<div class="actions">${rb(r.state==='paused'?'Включить будущие запуски':'Приостановить','toggle')}${rb('Показать новое событие / окно','tick')}${rb('Повторно проверить то же окно','replay')}${rb('Проверить полный цикл до границы','bound')}${rb('Показать 3 пропущенных окна','catchup')}</div><p>${re(d.outcome||'Прогонов ещё не запрашивали.')}</p>${r.runs.map(run=>`<article class="item"><div><strong>${run.id} · полный прогон ${run.iteration}</strong><p>Версия ${run.revision} · ${re(run.provider)} · ${re(run.window)} · ${re(run.outcome)}</p><ol>${run.steps.map(s=>`<li>${re(s.id)} · ${re(s.status)}</li>`).join('')}</ol><small>${re(run.snapshot)}</small></div></article>`).join('')}</section><details class="disclosure"><summary>История версий и точный контракт</summary><pre class="code-block">${re(JSON.stringify({...r,runs:undefined},null,2))}</pre></details>`
}
export function attachRoutineInteractions(root,{state,fixtures,rerender,navigate}){
  const current=()=>{const s=state(),d=routineStore(s.project);return {s,d,r:d.records.find(r=>r.id===(s.routine||d.selected))}}
  root.addEventListener('change',e=>{if(e.target.name==='routine-payload'){current().d.payload=e.target.value;rerender()}})
  root.addEventListener('input',e=>{if(e.target.closest('[data-routine-form]')){const {d,r}=current(),form=e.target.closest('form'),f=new FormData(form);d.draft={...structuredClone(d.draft||r),name:String(f.get('name')),trigger:String(f.get('trigger')),cadence:String(f.get('cadence')),timezone:String(f.get('timezone')),bound:Number(f.get('bound')),provider:String(f.get('provider')),catchup:String(f.get('catchup')),concurrency:String(f.get('concurrency'))};d.reason=String(f.get('reason'));d.draft.edges.forEach((edge,i)=>{for(const k of ['missing','empty','stale'])edge[k]=String(f.get(k+'-'+i)||edge[k])});d.command=null}})
  root.addEventListener('submit',e=>{if(!e.target.dataset.routineForm)return;e.preventDefault();const {s,d,r}=current();if(s.state!=='ready'||!r)return;d.error=validateRoutine(d.draft||r)||(!d.reason?.trim()?'Укажите основание новой версии.':'');d.command=d.error?null:structuredClone(d.draft||r);rerender()})
  root.addEventListener('click',e=>{const b=e.target.closest('[data-routine-action]');if(!b)return;const {s,d,r}=current(),a=b.dataset.routineAction;if(s.state!=='ready'||!r)return
    if(a==='new'){const record=structuredClone(d.records[0]);Object.assign(record,{id:'RT-'+(d.records.length+1),name:'Новый цикл',revision:1,versions:[],runs:[],state:'paused'});d.records.push(record);d.selected=record.id;d.draft=null;d.reason='';navigate('routine-editor',{routine:record.id});return}
    if(a==='cycle-edge'){d.draft??=structuredClone(r);d.draft.edges.push({from:'propose',to:'collect',input:'feedback',type:'Proposal',missing:'block',empty:'skip',stale:'block'});d.error=validateRoutine(d.draft)}
    if(a==='reset-edges'){d.draft??=structuredClone(r);d.draft.edges=d.draft.edges.filter(e=>e.to!=='collect');d.error=''}
    if(a==='commit'&&d.command){const versions=[...r.versions,{revision:r.revision,provider:r.provider,trigger:r.trigger,cadence:r.cadence,reason:d.reason}];Object.assign(r,d.command,{versions,revision:r.revision+1,runs:r.runs});d.command=null;d.draft=null;d.outcome='Новая версия записана. Предыдущие прогоны не изменились.'}
    if(a==='toggle')r.state=r.state==='paused'?'active':'paused'
    if(['tick','replay','bound','catchup'].includes(a)){
      const p=fixtures.projects.find(p=>p.id===s.project)
      if(r.state==='paused'||p?.lifecycle&&p.lifecycle!=='active'){d.outcome='Допуск остановлен: цикл или проект на паузе.';rerender();return}
      if(a==='replay'&&r.runs.length){d.outcome='Найдена прежняя квитанция '+r.runs.at(-1).id+'; повторный прогон не создан.';rerender();return}
      const governance=Object.values(fixtures.governance||{}),quota=governance.filter(x=>x.type==='quota').at(-1)?.value;if(quota&&quota.mode!=='ready'){d.outcome='Допуск удержан: свежая квота недоступна или исчерпана.';rerender();return}
      if(a==='tick'&&r.runs.some(x=>['admitted','inflight'].includes(x.outcome))){d.outcome=r.concurrency==='drop'?'Окно пропущено по concurrency policy.':'Окно поставлено в очередь за активным прогоном.';d.queued=(d.queued||0)+(r.concurrency==='one'?1:0);rerender();return}
      const seriesStart=r.runs.length
      const count=a==='bound'?r.bound:a==='catchup'?(r.catchup==='all'?3:r.catchup==='latest'?1:0):1
      for(let i=0;i<count;i++){
        const steps=r.nodes.map(n=>({id:n.id,status:'pending'}));steps[0].status='done';let outcome='completed'
        for(const edge of r.edges){const step=steps.find(s=>s.id===edge.to),policy=d.payload==='fresh'?'run':edge[d.payload],prior=steps.find(s=>s.id===edge.from);if(prior.status!=='done'){step.status='pending';continue}step.status=policy==='block'?'blocked':policy==='skip'?'skipped':policy==='refresh'?'awaiting-fresh-source':'done';if(step.status!=='done')outcome=step.status}
        const id=r.id+'-run-'+(r.runs.length+1);r.runs.push({id,iteration:r.runs.length+1,revision:r.revision,provider:r.provider,window:'window-'+(r.runs.length+1),snapshot:'fixture-observations-09:42 / '+d.payload,outcome,steps});if(outcome!=='completed')break
      }
      const series=r.runs.slice(seriesStart),completed=series.filter(run=>run.outcome==='completed').length
      if(a==='bound'&&completed===r.bound){const id=r.id+'-proposal-'+r.runs.length;fixtures.proposals??=[];if(!fixtures.proposals.some(p=>p.id===id)){const run=r.runs.at(-1),source={id:run.id,project:s.project,title:'Граница цикла: '+r.name,text:'Проверить результат '+completed+' завершённых прогонов серии ('+series.map(r=>r.id).join(', ')+'); решить, нужна ли следующая серия.',source:r.id+' / version '+run.revision,status:'observed',revision:1,observedAt:fixtures.as_of};fixtures.observations??=[];fixtures.observations.push(source);fixtures.proposals.push({id,project:s.project,sourceProject:s.project,source:source.id,sourceIds:[source.id],snapshot:structuredClone(source),revision:1,title:source.title,outcome:source.text,owner:'Product manager',status:'open',content:source.text})}}

      d.outcome=a==='catchup'?'Catch-up '+r.catchup+': обработано '+count+' из 3 пропущенных окон.':a==='bound'?(completed===r.bound?'Граница цепочки достигнута; Proposal направлен PM на разбор. Новое окно само не запущено.':'Серия удержана источником: '+completed+' из '+r.bound+' завершённых прогонов. Квитанция причины сохранена; Proposal о достигнутой границе не создан.'):'Квитанция текущего окна записана.'
    }
    rerender()
  })
}
