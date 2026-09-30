// No product IPC or external writes. All commands below mutate fixture state
// in this page only. Route state is shareable; drafts never enter the URL.
const model = JSON.parse(document.getElementById('product-model').textContent)
const fixtures = JSON.parse(document.getElementById('product-fixtures').textContent)
fixtures.events.forEach((event,index)=>{event.id??='fixture-event-'+(index+1)})
const el = id => document.getElementById(id)
const routeKeys = ['conversation','message','release','launchTab','launchLevel','launchMode','project','state','run','pack','cohort','journey','step','scope','inbox','cycle','provider','conflict','viewMode','boardKind','category','search','phase','answer','delivery','taskSaved','managerSwitched','selectedManager','managerSwitchStatus','managerPaused','stopRequested','admitted','answerChoice','question','task','agent','fact','file','episode','item','source','session','revision','selection','decision','graphRun','graphTaskRun','graphPlanRevision','graphRevision','graphSelected','graphMode','graphStatus','graphType','graphQuery','graphRead','graphLimit','graphCamera','opsState','binding','ceo','providerRevision','roleSlot','access','invite','effect','tool','interaction','memberRole','service','url','estate','agentConfig','qualitySet','routine','proposal','draftId','guideProject','factFilter','lease','chatState','phState']
const accountFixture=createProviderAccountsFixture()
const operationsData=createOperationsState(fixtures)
let state = {providerAccounts:accountFixture,ops:operationsData,project:'atlas',state:'ready',cohort:'existing',run:'2'}
let currentView = 'estate'
let currentPage = 'journeys'
let toastTimer
let lastFocused = null
let graphCleanup
let graphReturn
let revealDestination
const scrollPositions = new Map()
const formMemory = new Map()
const scopeMemory = new Map()
const scopedKeys=['created','draft','taskDraft','taskSaved','managerSwitched','selectedManager','managerSwitchStatus','managerPaused','admitted','provider','accessRevoked','reserved','connectionSaved','oauth','recipe','inviteState','invitePrepared','intake','ceoArtifacts']
const formKey=()=>[estateId(),state.project,currentView,state.draftId||'project-draft-1',...['task','question','agent','fact','file','episode','item','session'].map(k=>state[k]||'')].join('|')
const estateId=()=>state.estate||'team-estate'
const currentFixtures=()=>{const id=estateId(),projects=fixtures.projects.filter(p=>(p.estate||'team-estate')===id),ids=new Set(projects.map(p=>p.id));return {...fixtures,estate:id==='personal-estate'?'Личное пространство':fixtures.estate,projects,tasks:fixtures.tasks.filter(t=>ids.has(t.project)),agents:fixtures.agents.filter(a=>ids.has(a.project||fixtures.projects.find(p=>p.name===a.scope)?.id)),questions:fixtures.questions.filter(q=>ids.has(q.project)),events:fixtures.events.filter(e=>ids.has(e.project||'atlas')),decisions:(fixtures.decisions||[]).filter(d=>ids.has(d.project)),proposals:(fixtures.proposals||[]).filter(p=>ids.has(p.project))}}
const assistantStore = createAssistantStore()
const assistantUI = attachAssistant(el('ceo-host'),assistantStore,{
 context:()=>{const anchor=estateId()+'|'+currentView+'|'+state.project;if(assistantStore.scopeAnchor!==anchor)delete assistantStore.scopeOverride;let context=assistantStore.scopeOverride!==undefined?assistantScope(assistantStore.scopeOverride?'project':'launch-home',{...state,project:assistantStore.scopeOverride,cohort:'existing'},currentFixtures()):assistantScope(currentView,state,currentFixtures());if(state.conversation){const entry=[...assistantStore.threads].find(([,t])=>t.id===state.conversation);if(entry&&entry[0].startsWith(estateId()+'|')){const project=entry[0].split('|')[1];context=assistantScope(project==='estate'?'launch-home':'project',{...state,project,cohort:'existing'},currentFixtures());context.message=state.message}}const manager=managerPresentation(context.project||(context.estate==='personal-estate'?'estate:personal':'estate'));return {...context,items:fabricContextItems(currentFixtures()),provider:manager.provider,paused:manager.phase==='paused'}},
 brand:()=>launchAvatar(true,state),
 onScope:project=>{delete state.conversation;delete state.message;assistantStore.scopeOverride=project;assistantStore.scopeAnchor=estateId()+'|'+currentView+'|'+state.project;assistantUI.render();el('ceo-host').querySelector('textarea')?.focus()},
 onRead:(intent,text,context)=>fabricReadResult(intent,text,context,currentFixtures()),
 onMessage:message=>{if(!message.origin.project)return;const d=launchData(state);d.events??=[];d.events.unshift({id:message.id,project:message.origin.project,title:message.role==='user'?'Реплика оператора':'Ответ Fabric',body:message.text,source:message.id})},
 onRelink:(artifact,task)=>{if(!currentFixtures().projects.some(p=>p.id===artifact.project)||task&&!currentFixtures().tasks.some(t=>t.id===task&&t.project===artifact.project)&&!(task==='CTX-AT-42'&&artifact.project==='atlas'))return {ok:false,error:'Задача не найдена в выбранном проекте.'};return relinkLaunchArtifact(state,artifact,task)},
 onArtifact:artifact=>{
  if(!currentFixtures().projects.some(p=>p.id===artifact.project&&!p.archived&&!p.purged))return {ok:false,error:'Проект недоступен в текущем пространстве.'};
  if(artifact.task&&!currentFixtures().tasks.some(t=>t.id===artifact.task&&t.project===artifact.project)&&!(artifact.task==='CTX-AT-42'&&artifact.project==='atlas'))return {ok:false,error:'Задача не найдена в выбранном проекте. Исправьте связь или оставьте поле пустым.'};
  if(artifact.kind==='agent-config'){const scoped={...state,project:artifact.project},id=seedAgentConfiguration(scoped,artifact);if(!id)return {ok:false,error:'Черновик не сохранён: область или права не подтверждены.'};state.integrations=scoped.integrations;return {ok:true,receipt:'draft:'+id,entityRef:{view:'providers',params:{project:artifact.project,estate:estateId(),agentConfig:id}}}}
  if(artifact.kind==='workflow-config'){const id=seedRoutineProposal(artifact.project,artifact);return {ok:true,receipt:'draft:'+id,entityRef:{view:'routine-editor',params:{project:artifact.project,routine:id}}}}
  if(artifact.kind==='task'){const result=createFabricTask(state,fixtures,artifact);if(result.ok){tell('Задача записана. Запуск не начат.');renderRoute(false)}return result}
  const result=addLaunchArtifact(state,artifact);if(result.ok){state.ceoArtifacts??=[];if(!state.ceoArtifacts.some(a=>a.id===artifact.id))state.ceoArtifacts.push(artifact);tell('Поручение записано на доску выбранного проекта.');renderRoute(false)}return result
 }
})
attachFolderPickers(el('product-screen'),{onPick:(id,path,button)=>{
 if(id==='r0-folder'){if(state.state!=='ready')return;const s=firstReleaseStore(state);firstReleaseAction(s,'picked',path);r0UI.dispatch('scan');return}
 const input=button.closest('[data-folder-control]')?.querySelector('input');if(input){input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))}
}})
const r0UI=attachFirstRelease(el('product-screen'),{state:()=>state,rerender:()=>renderRoute(false),navigate:openView})
attachCalmAtlas(el('product-screen'))
attachGuided(el('product-screen'),{state:()=>({...state,guideView:currentView}),fixtures:currentFixtures,rerender:()=>renderRoute(false),navigate:openView,create:commitProjectDraft,task:artifact=>createFabricTask(state,fixtures,artifact),topic:artifact=>addLaunchArtifact(state,artifact),chat:prompt=>{assistantStore.open=true;const context=assistantScope(currentView,state,currentFixtures()),t=assistantThread(assistantStore,context.key);t.draft=prompt;assistantUI.render();el('ceo-host').querySelector('textarea')?.focus()}})
attachPulseInteractions(el('product-screen'),{state:()=>state,rerender:()=>put({},true),navigate:openView})
attachLaunchInteractions(el('product-screen'),{state:()=>state,rerender:()=>put({},true),navigate:openView})
attachProviderAccountInteractions(el('product-screen'),{state:()=>state,rerender:()=>put({},true)})
attachRoutineInteractions(el('product-screen'),{state:()=>state,fixtures,rerender:()=>put({},true),navigate:openView})
attachWorkbenchInteractions(el('product-screen'),{state:()=>state,navigate:openView,rerender:()=>put({},true),fixtures})
attachGovernanceInteractions(el('product-screen'),{navigate:openView,onRecordsChange:records=>{const allowed=new Set(currentFixtures().projects.map(p=>p.id));for(const [key,rows] of Object.entries(records)){fixtures[key]??=[];for(const row of rows){if(!allowed.has(row.project))continue;const index=fixtures[key].findIndex(r=>r.id===row.id&&r.project===row.project);if(index<0)fixtures[key].push(row);else fixtures[key][index]=row}}},onProjectChange:(id,patch)=>{const local=demoProjects.get(id);if(local)Object.assign(local,patch);if(patch.repos)setOperationsRepositories(state,fixtures,id,patch.repos);renderChrome()},onPreferences:prefs=>{document.documentElement.dataset.theme=prefs.theme;document.documentElement.lang=prefs.locale;document.querySelector('[data-action=toggle-theme]').textContent=prefs.theme==='dark'?'Светлый вид':'Тёмный вид'},onGovernanceChange:event=>{if(event.type==='proposal.resolved'&&event.value.status==='accepted')importAcceptedProposal(state,fixtures,{...event.value,targetProject:event.value.project,content:event.value.snapshot?.text||event.value.title,evidence:event.value.sourceIds,acceptanceReceipt:event.value.decision});if(event.type==='estate.settings'){fixtures.estate=event.value.name;const project=fixtures.projects.find(p=>p.id===event.project);if(project)project.tier=event.value.project?.tier||'active';fixtures.rankPolicy=event.value.rankWeights;fixtures.ceoTrust=event.value.trust;for(const q of fixtures.questions){const old=q.priority_components||{},w=event.value.rankWeights||{};q.priority_components={blocking:old.blocking?Number(w.blocking??40):0,breadth:old.breadth?Number(w.breadth??10):0,age:old.age?Number(w.age??3):0,kind_weight:Number(w.kind??10),goal_proximity:old.goal_proximity?Number(w.goal??20):0,project_weight:({critical:40,active:25,steady:10,paused:0})[fixtures.projects.find(p=>p.id===q.project)?.tier||'active']};q.priority_source='fixture CEO policy recomputation / '+event.type}}if(event.type==='goal.changed'){const goal={...event.value,project:event.project};fixtures.goals??=[];const i=fixtures.goals.findIndex(g=>g.id===goal.id&&g.project===goal.project);if(i<0)fixtures.goals.push(goal);else fixtures.goals[i]=goal}if(event.type==='notifier.created')registerNotifierRoutine(event.project,event.value);const record={id:'governance-event-'+(fixtures.events.length+1),time:'09:42',project:event.project,title:'Настройка обновлена: '+event.type,detail:'Сохранена ревизия демонстрационного источника',kind:'Настройки',view:event.type.startsWith('notification')?'notifications':event.type.startsWith('quota')?'usage':'project-settings'};fixtures.events.unshift(record)}})
attachOperationsInteractions(el('product-screen'),{state:()=>state,navigate:openView,onRepositoriesChange:({project,repositories,primary})=>{syncGovernanceRepositories(state,fixtures,project,repositories,primary);for(const [key,values] of formMemory)if(key.startsWith(estateId()+'|'+project+'|project-settings|')){delete values['project-repos'];formMemory.set(key,values)}},onModuleProposal:artifact=>{fixtures.observations??=[];const observation={id:artifact.id,project:artifact.sourceProject,title:artifact.title,text:artifact.requestedOutcome||artifact.title,source:artifact.observation.join(', '),status:'observed',revision:1,observedAt:fixtures.as_of};if(!fixtures.observations.some(o=>o.id===observation.id))fixtures.observations.push(observation);openView('cross-project-proposal',{source:artifact.sourceProject,item:artifact.id,project:artifact.sourceProject==='atlas'?'orbit':'atlas'})},rerender:()=>{if(currentView==='search'&&!state.search)formMemory.delete(formKey());put({},true)},fixtures})
attachIntegrationsInteractions(el('product-screen'),{state:()=>state,navigate:openView,rerender:()=>{for(const binding of getIntegrationBindings(state)){if(!binding.futureEligible)continue;const agent=operationsData.agents.find(a=>a.project===binding.project&&a.role===binding.role);if(binding.role==='product-manager'){const project=fixtures.projects.find(p=>p.id===binding.project);if(project)project.pmBinding=binding}if(agent){Object.assign(agent,{binding:binding.binding,provider:binding.provider,revision:binding.revision,certified:true});const fixture=fixtures.agents.find(a=>a.id===agent.id);if(fixture)Object.assign(fixture,{binding:binding.binding,provider:binding.provider})}}put({},true)}})
const viewByScreen = id => model.screens.find(x=>x.id===id)?.view
const screenForView = id => model.screens.find(x=>x.id===model.views.find(v=>v.id===id)?.screen_id)
function tell(message) {
 el('toast').textContent=message;el('toast').hidden=false
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>el('toast').hidden=true,6500)
}
function put(patch, replace=false) {
 Object.assign(state,patch)
 const params=Object.fromEntries(routeKeys.filter(k=>state[k]!==undefined && state[k]!=='' && state[k]!==null).map(k=>[k,String(state[k])]))
 const url=viewHref(currentView,params)
 if(replace){history.replaceState(null,'',url);renderRoute(false)}else if(location.hash===url)renderRoute(false);else location.hash=url
}
function openView(view,patch={}) { if(['support','release','content'].includes(view)&&view!==currentView&&patch.item===undefined)delete state.item; if(patch.estate&&patch.estate!==estateId()){assistantStore.open=false;state.graphStates={};delete state.draft;delete state.created;patch.cohort='existing';if(!patch.project)patch.project=patch.estate==='personal-estate'?'personal-empty':'atlas'} if((patch.task!==undefined&&patch.task!==state.task)||(patch.project!==undefined&&patch.project!==state.project)){if(patch.run===undefined)delete state.run;if(patch.pack===undefined)delete state.pack} currentView=view;put(patch) }
function journeyLink(j,index) {
 const step=j.steps[index],v=step.view || viewByScreen(step.screen)
 return viewHref(v,{...step.fixture_state,...(creationRoute(v)==='launch-start'?{draftId:j.id}:{}),journey:j.id,step:index,cohort:j.cohort_key || 'existing',project:step.fixture_state?.project || 'atlas'})
}
function startJourney(id) {
 const j=model.journeys.find(x=>x.id===id)
 if(!j)throw new Error('Unknown journey '+id)
 state={providerAccounts:accountFixture,ops:operationsData,integrations:state.integrations,project:'atlas',state:'ready',run:'2',cohort:j.cohort_key || 'existing'}
 state.draftId=j.id;state.draft=creationRecord({estate:estateId(),draftId:j.id})
 location.hash=journeyLink(j,0)
}
function showPage(page) {
 currentPage=page
 el('ceo-host').hidden=page!=='prototype'||currentView==='landing'
 if(page!=='prototype'){document.documentElement.classList.remove('presentation','r0-active','r0-review','r0-onboarding');el('presentation-exit').hidden=true}
 for(const section of document.querySelectorAll('[data-report-page]'))section.hidden=section.dataset.reportPage!==page
 for(const a of document.querySelectorAll('.report-nav a')){
  if(a.dataset.page===page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')
 }
}
function renderWalkthrough() {
 const j=model.journeys.find(x=>x.id===state.journey)
 if(!j){el('walkthrough').hidden=true;return}
 el('walkthrough').hidden=false
 const n=Number(state.step || 0),step=j.steps[n]||j.steps[0]
 const inStep=(step.view || viewByScreen(step.screen))===currentView
 el('walkthrough').innerHTML=`<div class="walk-head"><div><h3>${escapeHtml(j.title)}</h3><p class="meta">${escapeHtml(inStep?'Шаг '+(n+1)+' из '+j.steps.length+' · '+step.action:'Свободный просмотр из выбранного сценария')}</p></div><div class="actions">${n>0?`<a class="button" href="${journeyLink(j,n-1)}">← Назад</a>`:''}${n<j.steps.length-1?`<a class="button" href="${journeyLink(j,n+1)}">Следующий экран →</a>`:'<a class="button" href="#journeys">Другие сценарии</a>'}</div></div><details class="walk-details"><summary>Все шаги, ожидаемый результат и ветвления</summary><p>${escapeHtml(step.result)}</p><ol class="walk-steps">${j.steps.map((s,i)=>`<li><a href="${journeyLink(j,i)}" ${i===n&&inStep?'aria-current="step"':''}>${i+1}. ${escapeHtml(s.title)}</a></li>`).join('')}</ol>${j.branches.map(b=>`<div class="item"><div><strong>${escapeHtml(b.condition)}</strong><p class="meta">${escapeHtml(b.recovery)}</p></div><a class="button" href="${viewHref(b.view || viewByScreen(b.destination_screen),{...b.fixture_state,journey:j.id,step:n})}">Посмотреть ветку</a></div>`).join('')}<p class="meta">Навигация показывает дизайн, а не отмечает реальную работу выполненной.</p><button class="button" data-action="restart-journey">Начать заново</button></details>`
}
function renderChrome() {
 const fresh=state.cohort==='new'&&!state.created||estateId()==='personal-estate'&&!currentFixtures().projects.length
 const project=demoProjects.get(state.project)||fixtures.projects.find(x=>x.id===state.project)||fixtures.projects[0]
 el('window-tabs').innerHTML=`<a class="button ${currentView==='estate'?'selected':''}" href="${viewHref('estate')}">Обзор</a>${fresh?'':(state.created?[{...project,name:state.draft?.name||project.name}]:currentFixtures().projects.filter(p=>!p.archived&&!p.purged).slice(0,2)).map(p=>`<a class="button ${state.project===p.id?'selected':''}" href="${viewHref('project',{project:p.id})}">${escapeHtml(p.name)}</a>`).join('')}<a class="button" href="${viewHref('onboarding')}">+ Проект</a><span class="meta">Дизайн продукта · демонстрационные данные</span>`
 const items=fresh?[['estate','Обзор'],['onboarding','Новый проект']]:[['estate','Обзор'],['inbox','Inbox'],['board','Доска'],['estate-agents','Агенты'],['cycles','Циклы']]
 const scoped=fresh?[]:[['project','Проект'],['goals','Цели'],['project-plan','План к цели'],['project-history','История задач'],['decisions','Решения'],['agents','Команда'],['memory','Память'],['harness','Harness'],['pipeline','Пайплайн'],['project-settings','Настройки']]
 const nav=entries=>entries.map(([id,label])=>`<a href="${viewHref(id,id.startsWith('r0-')?{estate:estateId(),...(firstReleaseStore(state).selected?{project:firstReleaseStore(state).selected}:{})}:{})}" class="${id===currentView?'current':''}" ${id===currentView?'aria-current="page"':''}>${escapeHtml(label)}</a>`).join('')
 el('app-nav').innerHTML=currentView.startsWith('launch-')?`<a href="#view-launch-home">Fabric</a><a href="#view-launch-board?scope=estate">Доска</a><a href="#view-launch-plan">Планирование</a><a href="#view-launch-pulse">Пульс</a><details class="disclosure"><summary>Настройки и команда</summary>${nav([['agents','Команда проекта'],['providers','Конфигурации агентов'],['routine-editor','Циклы проекта'],['project-settings','Настройки проекта'],['provider-accounts','Аккаунты ИИ'],['usage','Квоты'],['notifications','Уведомления']])}</details>`:`<a href="#view-launch-home">Fabric</a>`+nav(items)+(scoped.length?`<p class="app-nav-label">${escapeHtml(state.created?state.draft?.name||project.name:project.name)}</p>`+nav(scoped):'')+`<details class="disclosure"><summary>Рабочее пространство</summary>${nav([['estate-settings','Настройки'],['provider-accounts','Аккаунты ИИ'],['usage','Квоты и использование'],['notifications','Уведомления'],['diagnostics','Диагностика']])}</details>`
 el('app-nav').insertAdjacentHTML('afterbegin',`<label class="mobile-app-nav field"><span>Перейти к разделу</span><select id="mobile-app-view">${model.views.map(v=>`<option value="${v.id}" ${v.id===currentView?'selected':''}>${escapeHtml(v.title)}</option>`).join('')}</select></label>`)
 el('scope-label').textContent=estateId()==='personal-estate'?'Личное пространство / '+(fresh?'без проекта':project.name):fresh?'Рабочее пространство / без проекта':['estate','estate-agents','inbox','profile','settings','estate-settings','provider-accounts','usage','notifications','diagnostics'].includes(currentView)?'Design studio / все проекты':`Design studio / ${state.created?state.draft?.name||project.name:project.name}`
 if(currentView.startsWith('launch-')){
  const name=currentFixtures().projects.find(p=>p.id===state.project)?.name||launchData(state).projects.find(p=>p.id===state.project)?.name||'Проект не выбран'
  el('window-tabs').innerHTML=`<a class="button" href="#view-launch-home">Fabric</a><a class="button" href="#view-launch-project?project=${encodeURIComponent(state.project)}">${escapeHtml(name)}</a><span class="meta">Целевой дизайн запуска · демонстрационные данные</span>`
  el('app-nav').innerHTML=nav([['launch-home','Fabric'],['launch-board','Доска'],['launch-pulse','Пульс'],['launch-releases','Релизы'],['launch-plan','Планирование'],['launch-persona','Мой Fabric']])+`<p class="app-nav-label">Проект</p>`+nav([['launch-project',name],['launch-agent','Агент / IDE'],['cycles','Циклы']])+`<details class="disclosure"><summary>Настройки и команда</summary>${nav([['agents','Команда'],['providers','Конфигурации агентов'],['routine-editor','Настроить цикл'],['project-settings','Настройки проекта'],['provider-accounts','Аккаунты ИИ'],['usage','Квоты'],['notifications','Уведомления']])}</details><p class="app-nav-label">Дизайн</p>`+nav([['launch-start','Добавить проект'],['launch-help','Руководство Fabric'],['launch-map','Карта экранов'],['estate','Все возможности']])
  el('app-nav').insertAdjacentHTML('afterbegin',`<label class="mobile-app-nav field"><span>Раздел</span><select id="mobile-app-view">${model.views.filter(v=>v.id.startsWith('launch-')||['onboarding','agents','providers','routine-editor','project-settings','provider-accounts','usage','notifications'].includes(v.id)).map(v=>`<option value="${v.id}" ${v.id===currentView?'selected':''}>${escapeHtml(v.title)}</option>`).join('')}</select></label>`)
  el('scope-label').textContent=['launch-home','launch-board','launch-plan','launch-map','launch-persona','launch-pulse','launch-releases'].includes(currentView)?'Моё пространство / Fabric':'Моё пространство / '+name
 }
 el('app-nav').innerHTML=renderCalmNav(currentView,state,model,currentFixtures());
 if(currentView.startsWith('r0-')||['launch-start','onboarding'].includes(currentView)){
  const s=firstReleaseStore(state),p=state.state==='denied'?null:s.projects.find(p=>p.id===s.selected);
  el('app-nav').innerHTML=`<p class="app-nav-label">Первый релиз</p>`+nav([['r0-home','Fabric'],['r0-board','Доска'],['r0-plan','План'],['r0-work','Исполнитель'],['r0-memory','Память']])+`<details class="disclosure"><summary>Ещё</summary>`+nav([['r0-source','Добавить проект'],['r0-settings','Настройки'],['r0-guide','Как пользоваться'],['r0-map','Карта экранов'],['r0-setup','Первый запуск']])+`</details>`;
  el('window-tabs').innerHTML=`<a class="button" href="${viewHref('r0-home',{estate:estateId()})}">Fabric</a>${state.state!=='denied'?s.projects.map(x=>`<a class="button ${x.id===s.selected?'current':''}" href="${viewHref('r0-project',{estate:estateId(),project:x.id})}">${escapeHtml(x.name)}</a>`).join(''):''}<a class="button" href="${viewHref('r0-source',{estate:estateId()})}" aria-label="Добавить проект">＋</a><span class="meta">Первый релиз · целевой макет</span>`;
  document.documentElement.classList.toggle('r0-review',s.reviewMode);
  el('scope-label').textContent='Моё пространство'+(p?' / '+p.name:'');el('ceo-host').hidden=true;
 }

 el('current-view').value=currentView
 el('state-select').value=state.state||'ready'
}
function renderInspector() {
 const v=model.views.find(v=>v.id===currentView),scr=screenForView(currentView)
 const findings=model.findings.filter(f=>f.screen_ids?.some(id=>v.screen_ids.includes(id)))
 const taskIds=[...new Set([...(scr?.task_ids || []),...(v.task_ids||[])])]
 const taskLink=id=>model.active_task_ids.includes(id)?`<a href="system.html#task-${id.replaceAll('.','-')}">${id}</a>`:`<a href="../evidence/backlog.md">${id} · общий backlog</a>`
 const refs=(scr?.current_evidence||[]).map(e=>`<li><a href="${escapeHtml(e.url)}" target="_blank" rel="noreferrer">${escapeHtml(e.file+' · '+e.symbol)}</a></li>`).join('')
 el('view-caption').textContent=`${v.screen_ids.join(' / ')} · ${v.horizon==='later'?'Дальний горизонт':v.horizon==='external'?'Внешний сайт / концепт':'Целевой дизайн'} · ${v.title}`
 el('context-inspector').innerHTML=`<summary>Контекст экрана, источники и задания ${v.screen_ids.join(' / ')}</summary><div class="context-grid"><div><h3>Для чего этот экран</h3><p>${escapeHtml(scr?.purpose||v.purpose)}</p><h3>Что есть сейчас</h3><p>${escapeHtml(scr?.current_status||'Новый целевой экран; production coverage отсутствует.')}</p><p class="meta">Интерактивный макет не является реализацией функции.</p><h3>Сценарии и пути</h3><p>${(scr?.scenario_ids||[]).map(id=>`<a href="#scenario-${id}">${id}</a>`).join(' · ')}</p><p>${(scr?.flow_ids||[]).map(id=>`<a href="#flow-${id}">${id}</a>`).join(' · ')}</p><h3>Задачи реализации</h3><p>${taskIds.map(taskLink).join(' · ')||'Контекст находится в общем плане.'}</p><a class="button" href="#handoff-${taskIds[0]||'S13'}">Открыть пакет разработчику</a></div><div><h3>Что проверить</h3><ul>${(scr?.agent_handoff?.acceptance||v.acceptance||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul><h3>Найденные пробелы</h3><p>${findings.length?findings.map(f=>`<a href="#finding-${f.id}">${f.id} · ${escapeHtml(f.title)}</a>`).join('<br>'):'В этом срезе отдельная находка не заведена. Это не заключение об отсутствии дефектов.'}</p><h3>Кодовая основа</h3><ul>${refs||'<li>Новый target: опора на инженерную спецификацию выше.</li>'}</ul></div></div>`
}
function renderRoute(focus=true) {
 const hash=location.hash.slice(1)||'journeys',split=hash.indexOf('?'),base=split<0?hash:hash.slice(0,split)
 const params=new URLSearchParams(split<0?'':hash.slice(split+1))
 if(params.get('demoReset')==='1'){state={providerAccounts:accountFixture,ops:operationsData,integrations:state.integrations,project:'atlas',state:'ready',run:'2',cohort:'existing'};formMemory.clear()}
 if(base.startsWith('journey-')&&!base.startsWith('journey-spec-')){startJourney(base.slice(8));return}
 if(base.startsWith('screen-')){const view=viewByScreen(base.slice(7));if(view){state={providerAccounts:accountFixture,ops:operationsData,integrations:state.integrations,project:'atlas',state:'ready',run:'2',cohort:'existing'};currentView=view;put({},true);return}}
 if(base.startsWith('view-')) {
  const v=base.slice(5)
  if(!model.views.some(x=>x.id===v)){location.hash='screens';return}
  if(['support','release','content'].includes(v)&&v!==currentView&&!params.has('item'))delete state.item
  if(currentView==='project'&&(v!=='project'||params.get('project')&&params.get('project')!==state.project)&&state.opsState!=='digest-unavailable'&&operationsData.ui['digest-read:'+state.project]!=='unavailable')operationsData.marks[state.project]=operationsData.history.filter(e=>e.project===state.project).length
  if(v!==currentView&&!params.has('conversation')){delete state.conversation;delete state.message}
  if(v!==currentView&&!params.has('item')&&v.startsWith('launch-'))delete state.item;
  if(v!=='launch-releases'||!params.has('release'))delete state.release;
  currentView=v
  // Scope must be resolved before looking up an addressed creation draft.
  if(params.has('estate'))state.estate=params.get('estate')
  state.scope=params.get('scope')||(['estate','estate-agents','inbox','profile','usage','estate-settings','notifications','diagnostics','launch-home','launch-board','launch-plan','launch-map','launch-persona','launch-pulse','launch-releases'].includes(v)?'estate':'project')
  const hasJourney=params.has('journey')
  if(params.has('provider')&&params.get('provider')!==state.provider)delete state.admitted
  if(params.has('project')&&params.get('project')!==state.project){scopeMemory.set(state.project,Object.fromEntries(scopedKeys.filter(k=>state[k]!==undefined).map(k=>[k,state[k]])));for(const key of [...scopedKeys,'answer','delivery','phase','stopRequested','task','question','agent','fact','file','episode','item','session','run','pack','graphTaskRun','answerChoice','graphStates'])delete state[key];Object.assign(state,scopeMemory.get(params.get('project'))||{})}
  if(params.has('task')&&params.get('task')!==state.task){if(!params.has('run'))delete state.run;if(!params.has('pack'))delete state.pack}
  if(hasJourney){for(const key of ['phase','answer','delivery','managerSwitched','taskSaved','stopRequested','admitted'])delete state[key]}
  for(const key of routeKeys)if(params.has(key))state[key]=params.get(key)
  if(creationRoute(v)==='launch-start'){const draft=creationRecord({estate:estateId(),draftId:params.get('draftId')||undefined});state.draftId=draft.draftId;state.draft=draft;state.projectDrafts=creationList(estateId()).map(d=>({id:d.draftId,name:d.name||'Без названия'}))}
  if(v==='authority'){const q=fixtures.questions.find(q=>q.id===(state.question||'Q-12')&&q.project===state.project);if(q?.state==='resolved'&&q.answer_choice){state.answer='committed';state.answerChoice=q.answer_choice}}
  const localProject=demoProjects.get(state.project)
  if(localProject&&creationRoute(v)!=='launch-start'){state.created=false;state.draft={...localProject.draft,name:localProject.name,purpose:localProject.purpose}}
  if(!params.has('state'))state.state='ready'
  if(hasJourney){const j=model.journeys.find(j=>j.id===state.journey),step=j?.steps[Number(state.step||0)];if(step?.fixture_state && (step.view||viewByScreen(step.screen))===v)Object.assign(state,step.fixture_state,Object.fromEntries(params))}
  for(const key of ['taskSaved','managerSwitched','managerPaused','stopRequested','admitted'])if(typeof state[key]==='string')state[key]=state[key]==='true'
  showPage('prototype');renderWalkthrough();renderChrome();document.documentElement.classList.toggle('r0-active',currentView.startsWith('r0-')||['launch-start','onboarding'].includes(currentView));document.documentElement.classList.toggle('r0-onboarding',['r0-setup','r0-provider','r0-source','r0-discovery','launch-start','onboarding'].includes(currentView))
  graphCleanup?.()
  state._opsView=currentView
  const viewFixtures=currentFixtures();syncLaunchWorkspace(state,viewFixtures);const obligations=readObligations(state,viewFixtures);viewFixtures.taskBlockers=Object.fromEntries(viewFixtures.tasks.map(t=>[t.id,obligations.filter(o=>o.task===t.id||o.params.task===t.id)]))
  const emptyEstate=estateId()==='personal-estate'&&!viewFixtures.projects.length
  el('product-screen').innerHTML=emptyEstate&&!currentView.startsWith('r0-')&&!['launch-start','launch-guide','launch-help','launch-design','membership','onboarding','landing','estate-settings','provider-accounts','usage','notifications','diagnostics'].includes(currentView)?`<header class="page-title"><h2 tabindex="-1">Личное пространство</h2></header><section class="panel"><h3>Пока без проектов</h3><p>Командные проекты не перенесены. Создайте свой проект или переключите Estate.</p><a class="button" href="#view-launch-start?estate=personal-estate&project=personal-empty&cohort=new">Создать первый проект</a><a class="button" href="#view-membership?estate=personal-estate">Переключить Estate</a></section>`:renderProduct(currentView,state,model,emptyEstate?{...viewFixtures,projects:[{id:'personal-empty',name:'Личное пространство',purpose:'Свой первый проект'}]}:viewFixtures)
  if(['launch-home','launch-project'].includes(currentView)&&state.state!=='denied'&&!emptyEstate&&!guideRecord({...state,guideView:'launch-guide'}).dismissed)el('product-screen').insertAdjacentHTML('beforeend',`<aside class="guide-resume"><span>Осваивайтесь в своём темпе</span><a class="button" href="#view-launch-guide?project=${encodeURIComponent(state.project)}&estate=${encodeURIComponent(estateId())}">Продолжить знакомство</a><a class="button" href="#view-launch-help?project=${encodeURIComponent(state.project)}&estate=${encodeURIComponent(estateId())}">Примеры для Fabric</a></aside>`);
  if(currentView==='harness'){const rows=(fixtures.leases||[]).filter(l=>l.project===state.project&&(!state.lease||state.lease===l.id));el('product-screen').insertAdjacentHTML('beforeend',`<section class="panel"><h3>Владельцы работы · lease</h3>${rows.length?rows.map(l=>`<article class="item"><div><strong>${escapeHtml(l.id+' / '+l.task)}</strong><p>${escapeHtml(l.owner+' · '+l.scope+' · '+l.status)}</p><p>Создана ${escapeHtml(l.created_at)} · TTL до ${escapeHtml(l.expires_at)}. Истечение не доказывает остановку процесса.</p><button class="button" data-action="lease-reconcile" data-lease="${l.id}">Сверить и подтвердить fencing в примере</button><button class="button" data-action="lease-release" data-lease="${l.id}" ${!l.fenced||l.status==='released'?'disabled':''}>Освободить lease</button></div></article>`).join(''):'<p>Точных lease в выбранной области нет.</p>'}</section>`)}
  if(currentView==='project'&&localProject){const p=fixtures.projects.find(p=>p.id===state.project);el('product-screen').insertAdjacentHTML('afterbegin',`<section class="panel" data-startup-review><h3>Начальная конфигурация и активация</h3><p>${escapeHtml(p.startupSpec?.starter||'idea')} · роли: ${escapeHtml((p.startupSpec?.roles||[]).join(', '))} · автоматические циклы на паузе.</p><p>Цель: ${escapeHtml(p.purpose)}. Репозитории: ${escapeHtml((p.repos||[]).map(r=>typeof r==='string'?r:r.path).join(', ')||'нет')}.</p><p>Наблюдаемые проекты: ${escapeHtml((p.startupSpec?.targets||[]).join(', ')||'нет')}; будущие: ${p.startupSpec?.futureConsent?'разрешены отдельной настройкой':'не добавляются'}.</p><p>PM: ${p.pmActive?'активирован · '+escapeHtml(p.pmReceipt):p.pmBinding?.futureEligible?'Проверен и привязан; ожидает активации':'Активация удержана: роль ещё не допущена и не привязана'}.</p><a class="button" href="#view-project-settings?project=${p.id}">Изменить конфигурацию</a><a class="button" href="#view-pipeline?project=${p.id}">Начальный маршрут</a><a class="button" href="#view-providers?project=${p.id}&roleSlot=product-manager">Проверить Product manager</a><button class="button" data-action="activate-pm" ${!p.pmBinding?.futureEligible||p.pmActive?'disabled':''}>Активировать Product manager</button></section>`)}
  if(graphReturn&&!['project-plan','project-history','agent-history','decisions'].includes(currentView))el('product-screen').insertAdjacentHTML('afterbegin',`<a class="button" href="${escapeHtml(graphReturn)}">← Вернуться к выбранному узлу графа</a>`)
  graphCleanup=attachGraphInteractions(el('product-screen'),{onPlanChange:(next)=>{state.graphPlanEdits=next},onStateChange:(value,{id})=>{state.graphStates??={};state.graphStates[id]=value},onNavigate:({returnHref})=>{graphReturn=returnHref}})
  const artifacts=(state.ceoArtifacts||[]).filter(a=>a.project===state.project)
  if(['project','board'].includes(currentView)&&artifacts.length)el('product-screen').insertAdjacentHTML('beforeend',`<section class="panel"><h3>Предложения CEO</h3>${artifacts.map(a=>`<div class="item"><div><strong>${escapeHtml(a.id+' · '+a.title)}</strong><p>${escapeHtml(a.result)}</p><small>${escapeHtml(a.scope+' / Product manager / '+a.source)}</small></div><span class="chip">К разбору</span></div>`).join('')}</section>`)
  const attachable=fabricContextItems(currentFixtures()),visibleTask=state.task||(state.project==='atlas'?'AT-42':currentFixtures().tasks.find(t=>t.project===state.project)?.id),contextItem=attachable.find(x=>['task','launch','run','context-pack'].includes(currentView)&&visibleTask&&x.params.task===visibleTask&&x.project===state.project)||attachable.find(x=>currentView==='decisions'&&state.decision&&x.params.decision===state.decision&&x.project===state.project)||attachable.find(x=>x.id==='project:'+state.project);
  if(contextItem&&!currentView.startsWith('r0-')&&!['onboarding','launch-home','launch-start','launch-help','launch-design','landing'].includes(currentView)&&state.state!=='denied')el('product-screen').insertAdjacentHTML('afterbegin',`<div class="calm-context-action"><button class="button" data-action="discuss-context" data-context-id="${escapeHtml(contextItem.id)}">Обсудить с Fabric ↗</button></div>`);
  if(params.get('ceo')==='open')assistantStore.open=true
  if(currentView.startsWith('launch-'))assistantStore.name='Fabric'
  assistantUI.render()
  if(currentView.startsWith('r0-')||['onboarding','launch-start'].includes(currentView))el('ceo-host').hidden=true
  const saved=formMemory.get(formKey())
  if(saved)for(const input of el('product-screen').querySelectorAll('input[name],textarea[name],select[name]')){
   const v=saved[input.name+(input.type==='radio'||input.type==='checkbox'?'|'+input.value:'')]
   if(v!==undefined){if(input.type==='radio'||input.type==='checkbox')input.checked=v;else input.value=v}
  }
  if(state.viewMode==='list')for(const e of el('product-screen').querySelectorAll('.graph-frame'))e.hidden=true
  if(state.viewMode==='canvas')for(const e of el('product-screen').querySelectorAll('.graph-list'))e.hidden=true
  renderInspector()
  document.title=model.views.find(v=>v.id===currentView).title+' · Fabric · Product review'
  if(focus){el('product-screen').querySelector('h2')?.focus({preventScroll:true});window.scrollTo({top:scrollPositions.get(location.hash)||0,behavior:'instant'})}
  return
 }
 const page=base.startsWith('finding-')?'findings':base.startsWith('handoff-')?'handoff':base.startsWith('scenario-')||base.startsWith('flow-')||base.startsWith('journey-spec-')?'coverage':['journeys','screens','findings','handoff','coverage','review'].includes(base)?base:'journeys'
 showPage(page);document.title='Fabric · Продуктовые сценарии и дизайн'
 const target=document.getElementById(base)
 if(target&&base!==page){target.closest('details')?.setAttribute('open','');target.scrollIntoView({block:'start'})}
 else if(focus)window.scrollTo({top:scrollPositions.get(location.hash)||0,behavior:'instant'})
}
function commitProjectDraft(draft){const project=createDemoProject({...draft,estate:estateId(),draftId:draft.draftId||state.draftId||'project-draft-1',repo:draft.repoMode==='none'?'':draft.repo});registerIntegrationProject(state,project);const registered=registerOperationsProject(state,fixtures,project);Object.assign(registered.project,{estate:estateId(),startupSpec:structuredClone(project.startupSpec),pmActive:false});return project}
document.addEventListener('input',e=>{
 rememberForm(e.target)
 const form=e.target.closest('form')
 if(e.target.name==='file-buffer'){state.fileBuffer=e.target.value;state.fileSaved=false}
 if(e.target.id==='screen-search')filterScreens()
 if(e.target.id==='finding-search')filterFindings()
})
document.addEventListener('change',e=>{
 rememberForm(e.target)
 const t=e.target
 if(t.id==='current-view'){state={estate:estateId(),providerAccounts:accountFixture,ops:operationsData,integrations:state.integrations,project:state.project||'atlas',state:'ready',run:'2',cohort:'existing'};openView(t.value)}
 else if(t.id==='mobile-app-view')openView(t.value)
 else if(t.id==='state-select')put({state:t.value})
 else if(t.name==='board-scope')put({scope:t.value})
 else if(t.name==='board-kind')put({boardKind:t.value})
 else if(t.name==='retro-category')put({category:t.value})
 else if(t.id==='finding-severity'||t.id==='finding-kind')filterFindings()
 else if(t.id==='screen-horizon')filterScreens()
 else if(t.dataset.setting==='intake'){state.intake=t.checked;tell(t.checked?'Локальный сбор включён в примере.':'Локальный сбор выключен в примере; исходящей отправки нет.')}
 else if(t.dataset.setting)tell('Настройка изменена только в этом примере.')
})
document.addEventListener('submit',e=>{
 const form=e.target,kind=form.dataset.form;if(!kind)return
 e.preventDefault();if(state.phase==='read-only'){tell('Снимок доступен только для чтения.');return}const vals=new FormData(form)
 if(kind==='create-task') {
  if(!String(vals.get('task-title')||'').trim()){tell('Назовите задачу, чтобы сохранить её.');return}
  state.taskDraft={title:String(vals.get('task-title')),result:String(vals.get('task-result')||''),check:String(vals.get('task-check')||''),owner:String(vals.get('task-owner')||'unassigned'),goal:String(vals.get('task-goal')||''),context:String(vals.get('task-context')||'')};state.taskSaved=true;openView('task',{phase:'no-context'})
 } else if(kind==='answer-question'){
  state.answerChoice=String(vals.get('answer-choice'));state.answer='committed';state.delivery='pending';put({});tell('Решение записано в примере. Продолжение ещё не подтверждено.')
 } else if(kind==='manager-switch'){
  state.selectedManager=String(vals.get('manager-provider'));state.managerSwitchStatus='pending-validation';state.managerSwitched=false;put({});tell('Подготовлен план смены. Действующая привязка ещё не изменена.')
 } else if(kind==='bootstrap'){state.recipe=true;put({})}
 else if(kind==='project-settings'){state.settingsSaved=true;tell('Настройки сохранены в примере по ожидаемой версии.')}
 else if(kind==='save-access'){tell('Доступ сохранён в примере. Секрет не создавался.')}
 else if(kind==='invite'){state.invitePrepared=true;put({});tell('Приглашение подготовлено. Письмо не отправлялось.')}
 else if(kind==='search')put({search:String(vals.get('search-query')||'')})
 else throw new Error('Unimplemented prototype form '+kind)
})
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-action]');if(!b)return
 const name=b.dataset.action
 if(name==='discuss-context'){const item=fabricContextItems(currentFixtures()).find(x=>x.id===b.dataset.contextId);if(!item)return;delete state.conversation;delete state.message;delete assistantStore.scopeOverride;assistantStore.open=true;assistantUI.render();const t=assistantThread(assistantStore,assistantStore.context.key);t.attachments??=[];if(!t.attachments.some(x=>x.id===item.id)&&t.attachments.length<8)t.attachments.push(item);assistantUI.render();el('ceo-host').querySelector('textarea')?.focus();return}
 if(name==='lease-reconcile'||name==='lease-release'){const l=fixtures.leases.find(l=>l.id===b.dataset.lease&&l.project===state.project);if(!l)return;if(name==='lease-reconcile'){l.fenced=true;l.receipt='fixture-fence:'+l.id}else if(l.fenced){l.status='released';l.releaseReceipt='fixture-release:'+l.id}put({},true)}
 else if(name==='activate-pm'){const project=fixtures.projects.find(p=>p.id===state.project);if(!project?.pmBinding?.futureEligible){tell('Активация удержана: нужен допуск и binding роли Product manager.');return}project.pmActive=true;project.pmReceipt='pm-activation:'+project.id+':'+project.pmBinding.revision;put({},true)}
 else if(name==='state-ready')put({state:'ready'})
 else if(name==='stay-reveal'){el('reveal-guard').close();revealDestination=null}
 else if(name==='leave-reveal'){state.integrations.reveal=null;el('reveal-guard').close();const destination=revealDestination;revealDestination=null;if(destination)location.href=destination}
 else if(name==='state-partial')put({state:'partial'})
 else if(name==='restart-journey')startJourney(state.journey)
 else if(name==='start-run'){if(['no-context','read-only'].includes(state.phase)){tell('Запуск недоступен: сначала разрешённый контекст и допуск.');return}state.taskSaved=false;state.created=false;openView('task',{run:2,state:'ready',phase:'running',stopRequested:false,answer:'',delivery:''});tell('В примере допущен новый TaskRun, затем подтверждена доставка задания.')}
 else if(name==='launch-unknown'){if(['no-context','read-only'].includes(state.phase)){tell('Запрос не допущен: запуск не отправлялся.');return}if(el('launch-reconciliation'))return;el('product-screen').insertAdjacentHTML('beforeend',`<div class="notice warning" id="launch-reconciliation"><strong>Запуск подтверждается</strong><p>Исход запроса неизвестен. Проверяем тот же request_id, второй запуск не создаём.</p><button class="button primary" data-action="reconcile-launch">Проверить исход</button></div>`);el('launch-reconciliation').scrollIntoView({block:'nearest'})}
 else if(name==='reconcile-launch'){state.taskSaved=false;openView('task',{run:2});tell('Найдена квитанция того же допуска. Второго запуска нет.')}
 else if(name==='stop-run'){state.stopRequested=true;tell('Остановка запрошена в примере. Частичные результаты сохранены; task done не выставлен.');put({})}
 else if(name==='check-delivery'){state.delivery='acknowledged';put({})}
 else if(name==='read-events'){state.eventsRead=true;put({inbox:'happened'});tell('События прочитаны в примере. Открытые вопросы остаются на доске.')}
 else if(name==='clear-filters')put({scope:'project',boardKind:'all'})
 else if(name==='clear-search')put({search:'',state:'ready'})
 else if(name==='graph-list')put({viewMode:'list'})
 else if(name==='graph-canvas')put({viewMode:'canvas'})
 else if(name==='review-retro')tell('Сбор выполнен в примере. У R-08 ещё нет проверки результата; он не закрыт.')
 else if(name==='restore-check')tell('В примере нет доверенного текущего control plane: восстановление остаётся read-only, исходящие действия выключены.')
 else if(name==='pause-manager'){state.managerPaused=true;put({});tell('Расписание manager приостановлено в примере; история и открытые обязательства сохранены.')}
 else if(name==='validate-manager'){state.managerSwitchStatus='validated';put({});tell('Проверки в демонстрационном профиле пройдены. Привязка ещё не изменена.')}
 else if(name==='apply-manager'){if(state.managerSwitchStatus!=='validated'){tell('Сначала проверьте план смены.');return}state.managerSwitched=true;put({});tell('В примере старый epoch отозван, новый binding ждёт допуска и подтверждения передачи.')}
 else if(name==='accept-result'){openView('task',{phase:'verified',taskSaved:false,task:'AT-42',run:2});tell('В примере результат принят по квитанциям проверки.')}
 else if(name==='admit-provider'){state.admitted=true;put({})}
 else if(name==='oauth-return'){state.oauth='returned';put({})}
 else if(name==='oauth-cancel'){state.oauth='cancelled';put({})}
 else if(name==='save-connection'){state.connectionSaved=true;put({})}
 else if(name==='reserve-grant'){state.reserved=true;put({})}
 else if(name==='revoke-access'){state.accessRevoked=true;put({})}
 else if(name==='toggle-cycle'){state.cyclePaused=!state.cyclePaused;put({});tell(state.cyclePaused?'Будущие пробуждения приостановлены.':'Расписание возобновлено; текущий запуск отдельно.')}
 else if(name==='accept-invite'){state.inviteState='accepted';put({})}
 else if(name==='expired-invite'){state.inviteState='revoked';put({})}
 else if(name==='add-tile'){state.tileAdded=true;put({})}
 else if(name==='save-layout')tell('Размещение сохранено в примере. Scope панелей не расширен.')
 else if(name==='save-file'){state.fileSaved=true;tell('Буфер сохранён только в памяти отчёта. Файл проекта не изменялся.');put({})}
 else if(name==='editor-conflict')put({conflict:'yes'})
 else if(name==='resolve-file'){put({conflict:'no'});tell('В примере сохранена выбранная версия буфера.')}
 else if(name==='show-conflict'){openView('editor',{conflict:'yes'})}
 else if(name==='toggle-theme'){const next=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=next;b.textContent=next==='dark'?'Светлый вид':'Тёмный вид'}
 else if(name==='presentation'){document.documentElement.classList.add('presentation');el('presentation-exit').hidden=false;el('product-screen').querySelector('h2')?.focus();window.scrollTo(0,0)}
 else if(name==='exit-presentation'){document.documentElement.classList.remove('presentation');el('presentation-exit').hidden=true;document.querySelector('[data-action="presentation"]')?.focus()}
 else if(name==='show-context'){el('context-inspector').open=!el('context-inspector').open;if(el('context-inspector').open)el('context-inspector').scrollIntoView({block:'start'})}
 else if(name==='export-review'){
  const result={report:model.schema,source_commit:model.source_commit,route:location.hash,notes:el('review-notes').value,decisions:model.review_choices.map(c=>({id:c.id,choice:document.querySelector(`[name="review-${c.id}"]`)?.value||'not_reviewed'}))}
  const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='fabric-product-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);tell('Локальный JSON подготовлен. Ответы никуда не отправлялись.')
 }else throw new Error('Unimplemented prototype action '+name)
})
function filterScreens() {
 const q=el('screen-search').value.toLocaleLowerCase(),kind=el('screen-horizon').value
 let shown=0
 for(const card of document.querySelectorAll('[data-screen-card]')){const match=card.textContent.toLocaleLowerCase().includes(q)&&(kind==='all'||card.dataset.horizon===kind);card.hidden=!match;if(match)shown++}
 el('screen-count').textContent=`Показано ${shown} из ${model.screens.length} записей`
}
function rememberForm(target){
 if(!target.closest('#product-screen')||!target.name)return
 const key=formKey(),values=formMemory.get(key)||{}
 values[target.name+(target.type==='radio'||target.type==='checkbox'?'|'+target.value:'')]=(target.type==='radio'||target.type==='checkbox')?target.checked:target.value
 formMemory.set(key,values)
}
function filterFindings() {
 const q=el('finding-search').value.toLocaleLowerCase(),severity=el('finding-severity').value,kind=el('finding-kind').value
 let shown=0
 for(const card of document.querySelectorAll('[data-finding]')){const match=card.textContent.toLocaleLowerCase().includes(q)&&(severity==='all'||card.dataset.severity===severity)&&(kind==='all'||card.dataset.kind===kind);card.hidden=!match;if(match)shown++}
 el('finding-count').textContent=`Показано ${shown} из ${model.findings.length} находок`
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.documentElement.classList.contains('presentation')){document.documentElement.classList.remove('presentation');el('presentation-exit').hidden=true;document.querySelector('[data-action="presentation"]')?.focus()}})
window.addEventListener('scroll',()=>scrollPositions.set(location.hash,window.scrollY),{passive:true})
window.addEventListener('hashchange',()=>renderRoute())
document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a||a.dataset.integrationsView||!state.integrations?.reveal||a.closest('#reveal-guard'))return;e.preventDefault();e.stopPropagation();revealDestination=a.href;let dialog=el('reveal-guard');if(!dialog){dialog=document.createElement('dialog');dialog.id='reveal-guard';dialog.className='panel';dialog.innerHTML='<h3>Закрыть одноразовый показ?</h3><p>После перехода это демонстрационное значение не будет показано снова. Реальные секреты в отчёте отсутствуют.</p><div class="actions"><button class="button" data-action="stay-reveal">Остаться</button><button class="button" data-action="leave-reveal">Закрыть и перейти</button></div>';document.body.append(dialog)}dialog.showModal()},true)
document.documentElement.classList.add('js')
el('no-js-message').hidden=true
el('no-js-screens').hidden=true
renderRoute(false)
