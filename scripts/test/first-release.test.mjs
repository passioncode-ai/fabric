import test from 'node:test'
import assert from 'node:assert/strict'
import {createFirstRelease,firstReleaseAction as act,renderFirstRelease,firstReleaseViews,firstReleaseStore,firstReleaseStores,attachFirstRelease} from '../product/first-release.mjs'
function connected(){const s=createFirstRelease();act(s,'identity');act(s,'probe');act(s,'probe-result');return s}
function project(s,path='/Projects/atlas',outcome='done'){act(s,'picked',path);act(s,'scan');act(s,'scan-result',outcome);return s.projects.at(-1)}
test('first launch has no project name/purpose gate and requires observed readiness',()=>{const s=createFirstRelease();act(s,'picked','/Projects/atlas');assert.equal(act(s,'scan'),'r0-provider');assert.equal(s.projects.length,0);act(s,'probe-result');assert.equal(s.readiness,'unchecked');act(s,'identity');act(s,'probe');act(s,'probe-result');assert.equal(act(s,'scan'),'r0-discovery');assert.equal(act(s,'scan-result'),'r0-project');assert.equal(s.projects[0].name,'atlas');assert.equal(s.projects[0].goal,'');assert.equal(s.projects[0].tasks.length,0)})
test('install/auth/capability failure preserves folder and refuses scan',()=>{for(const failure of ['missing','auth','unsupported','failed']){const s=createFirstRelease();act(s,'picked','/Data');act(s,'probe');act(s,'probe-result',failure);assert.equal(act(s,'scan'),'r0-provider');assert.equal(s.source,'/Data');assert.equal(s.projects.length,0)}})
test('scan cancel invalidates late result, duplicate opens same project',()=>{const s=connected();act(s,'picked','/Data/Website');act(s,'scan');const token=s.scanToken;act(s,'scan-cancel');assert(s.scanToken>token);act(s,'scan-result');assert.equal(s.projects.length,0);act(s,'scan');act(s,'scan-result');assert.equal(act(s,'scan'),'r0-project');assert.equal(s.projects.length,1)})
test('collection requires candidate and negative scan has no fake project',()=>{for(const outcome of ['denied','failed','cancelled']){const s=connected();project(s,'/Projects/atlas',outcome);assert.equal(s.projects.length,0);assert.equal(s.scan,outcome)}const s=connected();act(s,'source-mode','collection');project(s,'/Data');assert.equal(s.scan,'candidates');assert.equal(s.projects.length,0);act(s,'candidate','Website');act(s,'scan-result','partial');assert.equal(s.projects[0].name,'Website');assert.equal(s.projects[0].partial,true)})
test('stop request is distinct from observed stop, timeout forbids resume',()=>{const s=connected();project(s);act(s,'task');act(s,'run');const id=s.run.id;act(s,'stop');assert.equal(s.run.status,'stopping');act(s,'resume','codex');assert.equal(s.run.id,id);act(s,'stop-result','timeout');assert.equal(s.run.status,'unknown');act(s,'resume','codex');assert.equal(s.run.id,id);act(s,'force-stop');assert.equal(s.run.status,'unknown');act(s,'force-confirm');act(s,'stop-result');assert.equal(s.run.status,'stopped');act(s,'resume','codex');assert.equal(s.run.id,id);act(s,'probe');act(s,'probe-result');act(s,'resume','codex');assert.notEqual(s.run.id,id);assert.equal(s.run.previous,id);assert.equal(s.run.provider,'codex')})
test('fresh same-provider differs from native resume; project runs are independent',()=>{const s=connected();const a=project(s);act(s,'task');act(s,'run');let session=s.run.session;act(s,'stop');act(s,'stop-result');act(s,'resume','native');assert.equal(s.run.session,session);act(s,'stop');act(s,'stop-result');act(s,'resume','claude-code');assert.notEqual(s.run.session,session);const run=s.run;const b=project(s,'/Projects/orbit');assert.equal(s.run,null);act(s,'task');act(s,'run');assert.notEqual(s.run.project,run.project);act(s,'select-project',a.id);assert.equal(s.run,run);assert.equal(s.run.status,'running');assert.notEqual(a.id,b.id)})
test('result enters Board review rather than accepted state; acceptance is addressed',()=>{const s=connected();const p=project(s);act(s,'task');act(s,'run');act(s,'deliver');assert.equal(p.tasks[0].state,'review');assert.equal(s.board[0].state,'open');act(s,'defer',s.board[0].id);assert.equal(s.board[0].state,'deferred');act(s,'reopen',s.board[0].id);act(s,'accept',s.board[0].id);assert.equal(p.tasks[0].state,'done')})
test('CEO chat keeps drafts and messages scoped, explicit command card for stop',()=>{const s=connected();const p=project(s);act(s,'task');act(s,'run');s.chatScope=p.id;s.drafts[p.id]='Останови агента';act(s,'send');assert.equal(s.messages[p.id][1].command,'stop');assert.equal(s.run.status,'running');s.chatScope='';s.drafts['']='Создай задачу';act(s,'send');assert.equal(s.messages[''][1].command,null);assert.equal(p.tasks.length,1)})
test('all release routes render, aliases resolve CEO setup, denied does not disclose project',()=>{firstReleaseStores.clear();for(const v of firstReleaseViews)assert.match(renderFirstRelease(v,{}),/data-r0-view=/);assert.match(renderFirstRelease('onboarding',{}),/Познакомьтесь с Fabric/);assert.match(renderFirstRelease('launch-start',{}),/Познакомьтесь с Fabric/);const s=firstReleaseStore({});Object.assign(s,{configured:true,readiness:'ready'});project(s,'/Private/Secret');const denied=renderFirstRelease('r0-project',{state:'denied'});assert.doesNotMatch(denied,/Private|Secret/);assert.match(denied,/Нет доступа/);assert.doesNotMatch(renderFirstRelease('r0-source',{}),/input[^>]+type="text"[^>]+(?:repo|folder)/)})

test('partial rescan updates same project and preserves accepted goal',()=>{const s=connected(),p=project(s,'/Projects/atlas','partial');act(s,'task','Keep goal');assert.equal(act(s,'scan-current'),'r0-discovery');act(s,'scan-result');assert.equal(s.projects.length,1);assert.equal(p.partial,false);assert.equal(p.goal,'Keep goal')})
test('task launch addresses chosen task and context question is not a stop command',()=>{const s=connected(),p=project(s);act(s,'task','A');act(s,'task','B');act(s,'run',p.tasks[0].id);assert.equal(s.run.task,p.tasks[0].id);s.chatScope=p.id;s.drafts[p.id]='На чём остановились?';act(s,'send');assert.equal(s.messages[p.id][1].command,null)})

test('explicit continuation on B never consumes pending A; pending button pins its original run',()=>{
 const s=connected(),a=project(s);act(s,'task','A');act(s,'run');act(s,'stop');act(s,'stop-result');const runA=s.run;
 assert.equal(act(s,'resume','codex'),'r0-provider');act(s,'provider','claude-code');const b=project(s,'/Projects/orbit');act(s,'task','B');act(s,'run');act(s,'stop');act(s,'stop-result');const sessionB=s.run.session;
 act(s,'resume','native');assert.equal(s.selected,b.id);assert.equal(s.run.session,sessionB);assert.equal(s.run.provider,'claude-code');assert.equal(s.runsById[runA.id].status,'stopped');assert.equal(s.pendingContinuation,null);
 act(s,'select-project',a.id);act(s,'resume','codex');const pending=s.pendingContinuation;act(s,'select-project',b.id);s.checks.codex='ready';act(s,'resume-pending');assert.equal(s.selected,a.id);assert.equal(s.run.previous,pending.run);assert.equal(s.run.provider,'codex');assert.equal(s.provider,'claude-code');
})
test('stopped task keeps its exact run/context after another task runs; active peer blocks continuation',()=>{
 const s=connected(),p=project(s);act(s,'task','A');act(s,'task','B');const [a,b]=p.tasks;act(s,'run',a.id);const original=s.run;act(s,'stop');act(s,'stop-result');assert.equal(a.state,'stopped');act(s,'run',b.id);const active=s.run;
 assert.equal(s.runsById[original.id],original);assert.equal(original.status,'stopped');act(s,'open-task',a.id);assert.equal(s.run,original);act(s,'resume','claude-code');assert.equal(s.run,original);assert.match(s.notice,/Другой запуск/);assert.equal(active.status,'running');
 act(s,'open-task',b.id);act(s,'stop');act(s,'stop-result');act(s,'open-task',a.id);act(s,'resume','claude-code');assert.equal(s.run.previous,original.id);assert.equal(s.run.task,a.id);assert.equal(a.state,'running');assert.equal(s.runsById[active.id].status,'stopped');
})
test('collection exposes fixture children, preserves partial coverage, rejects invented candidates',()=>{
 const s=connected();act(s,'source-mode','collection');project(s,'/Projects','partial');assert.equal(s.scan,'candidates-partial');assert.deepEqual(s.candidates.map(x=>x.name),['atlas','orbit','empty']);assert.equal(s.projects.length,0);
 act(s,'candidate','Website');assert.match(s.notice,/отсутствует/);assert.equal(s.scan,'candidates-partial');act(s,'candidate','orbit');assert.equal(s.pendingSource,'/Projects/orbit');act(s,'scan-result');assert.equal(s.projects[0].source,'/Projects/orbit');
})
test('empty collection creates neither candidates nor a project',()=>{
 for(const [path,outcome] of [['/Projects/empty','done'],['/Data','empty']]){const s=connected();act(s,'source-mode','collection');project(s,path,outcome);assert.equal(s.scan,'empty');assert.deepEqual(s.candidates,[]);assert.equal(s.projects.length,0)}
})
test('invalid task launch cannot substitute another task or restart accepted work',()=>{
 const s=connected(),p=project(s);act(s,'task','A');act(s,'run','not-a-task');assert.equal(s.run,null);p.tasks[0].state='done';act(s,'run',p.tasks[0].id);assert.equal(s.run,null);
})

test('explicit related references preserve Project ID and pinned run context on primary change',()=>{
 const s=connected(),p=project(s,'/Data/Website'),id=p.id;
 p.sources.push({path:'/Data/Notes',name:'Notes',role:'related',summary:'Explicit reference',status:'observed'});
 act(s,'task','Inspect website');act(s,'run');const pack=structuredClone(s.run.context);
 act(s,'primary-source','/Data/Notes');assert.equal(p.id,id);assert.equal(p.source,'/Data/Notes');
 assert.deepEqual(s.run.context,pack);assert.equal(pack.sources[1].access,'reference-only');
})
test('candidate selection rejects absent/empty and retains only deliberate ticks',()=>{
 const s=connected();act(s,'source-mode','collection');project(s,'/Data');act(s,'candidate-import');
 assert.equal(s.projects.length,0);act(s,'candidate-toggle','/not-permitted');assert.equal(s.chosenSources.length,0);
 act(s,'candidate-toggle','/Data/Website');act(s,'candidate-toggle','/Data/Notes');act(s,'candidate-toggle','/Data/Website');
 assert.deepEqual(s.chosenSources,['/Data/Notes']);act(s,'candidate-import');act(s,'scan-result');
 assert.deepEqual(s.projects.map(p=>p.source),['/Data/Notes']);
})
test('Board discussions isolate drafts, do not resolve on read, and apply once',()=>{
 const s=connected(),p=project(s);act(s,'topic','Question A');const a=s.board[0];s.drafts['ticket:'+a.id]='Inspect entry with a keyboard';act(s,'send');assert.equal(a.state,'open');assert.equal(p.tasks.length,0);act(s,'close-chat');act(s,'topic','Question B');const b=s.board[1];assert.equal(s.messages['ticket:'+b.id].length,1);act(s,'open-ticket',a.id);assert.equal(s.messages['ticket:'+a.id].at(-2).text,'Inspect entry with a keyboard');act(s,'outcome-apply',a.id);act(s,'outcome-apply',a.id);assert.equal(p.tasks.length,1);assert.equal(p.tasks[0].sourceTicket,a.id);assert.equal(a.state,'done');assert.equal(s.run,null);act(s,'outcome-run',a.id);assert.equal(s.run.task,p.tasks[0].id);assert.equal(s.run.context.decisions.length,1);act(s,'deliver');assert.equal(s.board.length,2);assert.equal(a.state,'open');assert.equal(a.outcome,null);assert.equal(a.outcomes.length,1);
})
test('ticket scope pins project; stale proposed context cannot be applied',()=>{
 const s=connected(),a=project(s);act(s,'topic','A');const ticket=s.board[0];s.drafts['ticket:'+ticket.id]='Do A';act(s,'send');const b=project(s,'/Projects/orbit');act(s,'open-ticket',ticket.id);assert.equal(s.selected,a.id);assert.equal(s.chatScope,a.id);a.contextRevision++;act(s,'outcome-apply',ticket.id);assert.equal(a.tasks.length,0);assert.equal(b.tasks.length,0);assert.match(s.notice,/Контекст проекта изменился/);
})
test('chat redacts known secret formats before transcripts, history and outcomes',()=>{
 const s=connected();project(s);act(s,'topic');const id=s.activeTicket;s.drafts['ticket:'+id]='Use api_key=abc123 and Bearer abcDEF.123 and sk-example123456';act(s,'send');const stored=JSON.stringify({messages:s.messages,history:s.history,board:s.board});assert.doesNotMatch(stored,/abc123|abcDEF|sk-example/);assert.match(stored,/скрыто/);assert.equal(s.drafts['ticket:'+id],'');
})
test('single avatar opens chat and appearance lives only in Settings; Plan has no manual task form',()=>{
 firstReleaseStores.clear();const s=firstReleaseStore({});act(s,'example');assert.equal(act(s,'profile'),'r0-settings');act(s,'style','detailed');const home=renderFirstRelease('r0-home',{});assert.match(home,/r0-fabric-dock/);assert.doesNotMatch(home,/Стиль общения|data-r0="profile"/);const dock=home.match(/<div class="r0-fabric-dock">(.*?)<\/div>/)[1];assert.equal((dock.match(/<button/g)||[]).length,1);assert.match(dock,/data-r0="reopen-chat"/);act(s,'reopen-chat');assert.equal(s.chat,true);const settings=renderFirstRelease('r0-settings',{});assert.match(settings,/Стиль общения/);assert.match(settings,/data-value="detailed" aria-pressed="true"/);assert.match(settings,/Статистика текущего примера/);assert.doesNotMatch(renderFirstRelease('r0-plan',{}),/data-r0-field="taskDraft"/);assert.match(renderFirstRelease('r0-board',{}),/data-r0="open-ticket"/);
})
test('planning CTA understands arbitrary intent and retains criteria refinements and draft',()=>{const s=connected(),p=project(s);act(s,'plan-chat');const b=s.board[0],key='ticket:'+b.id;s.drafts[key]='Вход с клавиатуры';act(s,'send');s.drafts[key]='Критерий: все действия доступны Tab и Enter';act(s,'send');assert.equal(b.outcome.taskTitle,'Вход с клавиатуры');assert.match(b.outcome.criteria,/Tab и Enter/);s.drafts[key]='pending';act(s,'close-chat');act(s,'plan-chat');assert.equal(s.drafts[key],'pending');assert.equal(s.board.length,1);act(s,'outcome-apply',b.id);assert.match(p.tasks[0].criteria,/Tab и Enter/);})
test('rejecting a result creates linked rework and never accepts the old task',()=>{const s=connected(),p=project(s);act(s,'task','Initial');act(s,'run');act(s,'deliver');const b=s.board[0];act(s,'open-ticket',b.id);s.drafts['ticket:'+b.id]='Не принимаю, исправь ошибку входа';act(s,'send');assert.equal(b.outcome.kind,'rework');act(s,'outcome-apply',b.id);assert.equal(p.tasks[0].state,'review');assert.equal(p.tasks[1].revisesTask,p.tasks[0].id);assert.match(p.tasks[1].title,/исправь/);})
test('a deliberately related folder reopens its owning Project after primary change',()=>{
 const s=connected(),p=project(s,'/Data/Website');p.sources.push({path:'/Data/Notes',name:'Notes',role:'related'});
 act(s,'primary-source','/Data/Notes');act(s,'picked','/Data/Website');assert.equal(act(s,'scan'),'r0-project');
 assert.equal(s.selected,p.id);assert.equal(s.projects.length,1);assert.equal(p.source,'/Data/Notes');
})
test('already imported rows cannot be ticked; new ticks do not merge or alter existing Projects',()=>{
 firstReleaseStores.clear();const s=firstReleaseStore({estate:'co180-existing'});s.readiness='ready';
 const p=project(s,'/Data/Website');act(s,'task','Keep task');const before=structuredClone(p);
 act(s,'source-mode','collection');project(s,'/Data');act(s,'candidate-toggle','/Data/Website');act(s,'candidate-toggle','/Data/Notes');
 assert.deepEqual(s.chosenSources,['/Data/Notes']);const html=renderFirstRelease('r0-discovery',{estate:'co180-existing'});
 assert.match(html,new RegExp('project='+p.id));assert.match(html,/data-value="\/Data\/Website"[^>]*disabled/);
 act(s,'candidate-import');act(s,'scan-result');assert.equal(s.projects.length,2);assert.deepEqual(p,before);
 assert.equal(s.projects[1].source,'/Data/Notes');assert(s.projects.every(p=>p.sources.length===1));
})
test('reload with missing fixture project cannot trap global map or add-project recovery',()=>{firstReleaseStores.clear();for(const view of ['r0-map','r0-home','r0-source','r0-setup']){const html=renderFirstRelease(view,{project:'r0-project-gone',state:'ready'});assert.doesNotMatch(html,/Исход операции пока неизвестен/)}assert.match(renderFirstRelease('r0-project',{project:'r0-project-gone'}),/Исход операции пока неизвестен/);})
test('criteria refinement preserves the rework title after a rejected result',()=>{const s=connected(),p=project(s);act(s,'task','Initial');act(s,'run');act(s,'deliver');const b=s.board[0];act(s,'open-ticket',b.id);s.drafts['ticket:'+b.id]='Не принимаю, исправь ошибку входа';act(s,'send');const title=b.outcome.taskTitle;s.drafts['ticket:'+b.id]='Критерий: вход доступен с клавиатуры';act(s,'send');assert.equal(b.outcome.taskTitle,title);act(s,'outcome-apply',b.id);assert.equal(p.tasks[1].title,title);assert.match(p.tasks[1].criteria,/клавиатуры/);assert.equal(p.tasks[0].state,'review');})


test('task discussion pins object and owner, preserves draft and has no task effect on open',()=>{
 const s=connected(),a=project(s);act(s,'task','Original');const t=a.tasks[0];const b=project(s,'/Projects/orbit');act(s,'discuss','task:'+t.id);const q=s.board.at(-1),key='ticket:'+q.id;
 assert.equal(s.selected,a.id);assert.equal(q.subject.id,t.id);assert.equal(t.state,'planned');s.drafts[key]='Keep draft';act(s,'close-chat');act(s,'select-project',b.id);act(s,'discuss','task:'+t.id);assert.equal(s.activeTicket,q.id);assert.equal(s.drafts[key],'Keep draft');assert.equal(s.board.length,1);
 act(s,'send');assert.equal(q.messages.at(-2).context.subject.id,t.id);assert.equal(a.tasks.length,1);act(s,'outcome-apply',q.id);assert.equal(a.tasks.length,2);assert.equal(t.state,'planned');assert.equal(a.tasks[1].context.discussionContext.subject.id,t.id);assert.equal(b.tasks.length,0);
})
test('plan and insight discussions are distinct and invalid objects do not silently fall back',()=>{
 const s=connected(),p=project(s);act(s,'plan-chat');const plan=s.activeTicket;act(s,'discuss','insight:'+p.id);const insight=s.activeTicket;s.drafts['ticket:'+insight]='Уточним обзор';act(s,'send');assert.match(s.messages['ticket:'+insight].find(m=>m.role==='user').context.subject.summary,/По README/);assert.notEqual(plan,insight);act(s,'plan-chat');assert.equal(s.activeTicket,plan);act(s,'discuss','task:missing');assert.equal(s.activeTicket,plan);assert.equal(s.board.length,2);assert.match(s.notice,/недоступен/);
})
test('continued discussion archives applied outcome, creates new proposal and preserves prior task',()=>{
 const s=connected(),p=project(s);act(s,'plan-chat');const b=s.board.at(-1),key='ticket:'+b.id;s.drafts[key]='First step';act(s,'send');act(s,'outcome-apply',b.id);const prior=structuredClone(b.outcome);act(s,'plan-chat');assert.equal(s.activeTicket,b.id);s.drafts[key]='Second step';act(s,'send');assert.deepEqual(b.outcomes[0],prior);assert.equal(b.outcome.applied,false);assert.equal(p.tasks.length,1);act(s,'outcome-apply',b.id);act(s,'outcome-apply',b.id);assert.equal(p.tasks.length,2);assert.equal(p.tasks[0].title,'First step');
})
test('first launch personalisation is optional in Settings and all task states remain discussable',()=>{
 firstReleaseStores.clear();const s=firstReleaseStore({});act(s,'example');assert.doesNotMatch(renderFirstRelease('r0-setup',{}),/data-r0-field="name"|data-r0="avatar"/);for(const state of ['planned','running','stopped','review','done']){s.projects[0].tasks[0].state=state;assert.match(renderFirstRelease('r0-plan',{}),/data-r0="discuss" data-value="task:/)}assert.match(renderFirstRelease('r0-project',{}),/data-value="insight:/);
})


test('multiple outcomes retain separately reviewable results; task discussion finds exact review',()=>{
 const s=connected(),p=project(s);act(s,'plan-chat');const b=s.board[0],key='ticket:'+b.id;for(const text of ['First','Second']){s.drafts[key]=text;act(s,'send');act(s,'outcome-apply',b.id)}const [a,z]=p.tasks;
 act(s,'run',a.id);act(s,'deliver');act(s,'run',z.id);act(s,'deliver');assert.equal(s.board.filter(b=>b.task).length,2);
 for(const t of [a,z]){act(s,'discuss','task:'+t.id);const q=s.board.find(b=>b.id===s.activeTicket);assert.equal(q.task,t.id);s.drafts['ticket:'+q.id]='Принимаю результат';act(s,'send');act(s,'outcome-apply',q.id);assert.equal(t.state,'done')}assert.equal(p.tasks.length,2);
})
test('new message resolves current task state while earlier snapshots stay immutable',()=>{
 const s=connected(),p=project(s);act(s,'task','Original');const t=p.tasks[0];act(s,'discuss','task:'+t.id);const q=s.board[0],key='ticket:'+q.id;s.drafts[key]='Обсудим';act(s,'send');const prior=q.messages.find(m=>m.role==='user').context;
 act(s,'close-chat');act(s,'run',t.id);act(s,'reopen-chat');s.drafts[key]='Что сейчас?';act(s,'send');const latest=q.messages.filter(m=>m.role==='user').at(-1).context;assert.equal(latest.subject.state,'running');assert.equal(latest.subject.run,s.run.id);assert.equal(prior.subject.state,'planned');assert.equal(prior.subject.run,null);
})


test('opening pending result never replaces the originating plan or insight conversation identity',()=>{
 for(const kind of ['plan','insight']){const s=connected(),p=project(s);act(s,'discuss',kind+':'+p.id);const b=s.board[0],key='ticket:'+b.id;s.drafts[key]='First';act(s,'send');act(s,'outcome-apply',b.id);act(s,'run',p.tasks[0].id);act(s,'deliver');s.drafts[key]='Keep review draft';act(s,'discuss','task:'+p.tasks[0].id);assert.equal(b.subject.kind,kind);act(s,'discuss',kind+':'+p.id);assert.equal(s.activeTicket,b.id);assert.equal(s.drafts[key],'Keep review draft');assert.equal(s.board.length,1)}
})


test('startup refusal blocks domain actions and chat; retry never invents compatibility',()=>{
 firstReleaseStores.clear();const s=firstReleaseStore({estate:'startup-preview'});s.name='Private fixture name';s.configured=true
 for(const state of ['behind','ahead','unreadable','manifest']){
  act(s,'startup-example',state);const before=JSON.stringify({projects:s.projects,history:s.history,checks:s.checks,messages:s.messages})
  for(const action of ['probe','probe-result','identity','picked','scan','task','run','send','reopen-chat'])act(s,action,'synthetic')
  assert.equal(JSON.stringify({projects:s.projects,history:s.history,checks:s.checks,messages:s.messages}),before)
  const html=renderFirstRelease('r0-home',{estate:'startup-preview'})
  assert.match(html,/Рабочее пространство ещё не запущено/);assert.doesNotMatch(html,/Private fixture name|data-r0="reopen-chat"/)
  act(s,'startup-retry');assert.equal(s.startupExample,state);assert.match(renderFirstRelease('r0-home',{estate:'startup-preview'}),/Проверка пока не пройдена/)
 }
 act(s,'startup-example','invented');assert.equal(s.startupExample,'manifest')
 act(s,'startup-example','ready');assert.match(renderFirstRelease('r0-home',{estate:'startup-preview'}),/data-r0="reopen-chat"/)
})


const fixtureGlobals=new WeakSet()
function attachedFixture(t, estate) {
 const state={estate},s=firstReleaseStore(state),listeners=new Map(),pending=[]
 if(!fixtureGlobals.has(t)){
  fixtureGlobals.add(t)
  const documentBefore=Object.getOwnPropertyDescriptor(globalThis,'document')
  const navigatorBefore=Object.getOwnPropertyDescriptor(globalThis,'navigator')
  t.after(()=>{for(const [key,descriptor] of [['document',documentBefore],['navigator',navigatorBefore]]){
   if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]
  }})
 }
 Object.defineProperty(globalThis,'document',{configurable:true,value:{activeElement:null}})
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))}}})
 const root={querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(event,fn)=>listeners.set(event,fn)}
 let picked
 const view=attachFirstRelease(root,{state:()=>state,rerender:()=>{},navigate:()=>{},pickFolder:callback=>{picked=callback}})
 t.after(()=>{view.dispose();firstReleaseStores.delete(estate)})
 const click=(action,value='')=>listeners.get('click')({target:{closest:()=>({dataset:{r0:action,value},disabled:false})}})
 return {state,s,view,click,listeners,pending,pick:path=>picked(path)}
}
function domainSnapshot(s){const {startupExample,startupRetry,startupEpoch,reviewMode,...domain}=s;return JSON.stringify(domain)}

test('attached Stop timer cannot settle behind startup refusal or after returning to ready',t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 for(const returnToReady of [false,true]){
  const f=attachedFixture(t,'stop-startup-'+returnToReady),{s,view}=f
  for(const action of ['identity','probe','probe-result'])act(s,action)
  project(s);act(s,'task');act(s,'run');view.dispatch('stop')
  view.dispatch('startup-example','behind');if(returnToReady)view.dispatch('startup-example','ready')
  const before=domainSnapshot(s);t.mock.timers.tick(800)
  assert.equal(domainSnapshot(s),before);assert.equal(s.run.status,'stopping')
  // A NEW explicit operation in the admitted fixture may obtain a new receipt.
  view.dispatch('startup-example','ready');view.dispatch('check-stop');t.mock.timers.tick(800)
  assert.equal(s.run.status,'stopped')
 }
})

test('attached probe and scan completions are fenced across startup generations',t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 for(const operation of ['probe','scan']){
  const {s,view}=attachedFixture(t,'async-startup-'+operation)
  if(operation==='scan'){for(const a of ['identity','probe','probe-result'])act(s,a);act(s,'picked','/Synthetic/scan')}
  view.dispatch(operation);view.dispatch('startup-example','behind');view.dispatch('startup-example','ready')
  const before=domainSnapshot(s);t.mock.timers.tick(2500);assert.equal(domainSnapshot(s),before)
 }
})

test('attached folder and clipboard callbacks cannot mutate a replaced or disposed startup',async t=>{
 for(const dispose of [false,true]){
  const f=attachedFixture(t,'external-startup-'+dispose),{s,view,click}=f
  for(const a of ['identity','probe','probe-result'])act(s,a)
  click('pick-folder');click('copy-context');click('copy-context')
  if(dispose)view.dispose();else{click('startup-example','behind');click('startup-example','ready')}
  const before=domainSnapshot(s)
  f.pick('/Synthetic/stale-selection');f.pending[0].resolve();f.pending[1].reject(new Error('synthetic failure'))
  await Promise.resolve();assert.equal(domainSnapshot(s),before)
 }
})

test('blocked attached events and rendering never reach domain mutations; review controls remain usable',t=>{
 const f=attachedFixture(t,'direct-startup'),{s,view,click,listeners,state}=f
 for(const a of ['identity','probe','probe-result'])act(s,a)
 const p=project(s);act(s,'task');act(s,'run');s.chat=true;s.terminalInput='keep draft'
 click('startup-example','behind');const before=domainSnapshot(s)
 listeners.get('input')({target:{dataset:{r0Field:'name'},value:'mutated'}})
 listeners.get('change')({target:{dataset:{r0Field:'chatScope'},value:'mutated'}})
 listeners.get('keydown')({key:'Escape',target:{},preventDefault:()=>{throw Error('blocked handler')}})
 for(const a of ['terminal-send','chat-prompt','pick-folder','copy-context','chat-command','read-retry','reopen-chat'])click(a,'task')
 // A normal memory renderer initializes its model; blocked rendering must not.
 const html=renderFirstRelease('r0-memory',{...state,project:p.id})
 assert.match(html,/Рабочее пространство ещё не запущено/);assert.equal(domainSnapshot(s),before)
 state.state='error';click('startup-example','ready');assert.equal(s.startupExample,'ready')
 view.dispose()
})

// CO-180: the scanner selects Projects, never implicit related-source authority.
test('each ticked repository creates its own Project and unticked repositories stay out',()=>{
 const s=connected();act(s,'source-mode','collection');project(s,'/Data');
 act(s,'candidate-toggle','/Data/Website');act(s,'candidate-toggle','/Data/Notes');
 act(s,'candidate-import');act(s,'scan-result');
 assert.equal(s.projects.length,2);assert.deepEqual(s.projects.map(p=>p.source),['/Data/Website','/Data/Notes']);
 assert(s.projects.every(p=>p.sources.length===1&&p.sources[0].role==='primary'));
 assert.equal(new Set(s.projects.map(p=>p.id)).size,2);assert.equal(s.selected,s.projects[0].id);
})
test('scan checklist shows independent Projects and no primary selector',()=>{
 firstReleaseStores.clear();const s=firstReleaseStore({estate:'co180'});s.readiness='ready';act(s,'source-mode','collection');project(s,'/Data');
 act(s,'candidate-toggle','/Data/Website');act(s,'candidate-toggle','/Data/Notes');
 const html=renderFirstRelease('r0-discovery',{estate:'co180'});
 assert.doesNotMatch(html,/data-r0="candidate-primary"|общий контекст|связанные источники/);
 assert.match(html,/Каждая выбранная папка станет отдельным проектом/);
})
test('cancelled or refused batch creates no Projects and cannot accept late answers',()=>{
 for(const outcome of ['cancelled','denied','failed']){const s=connected();act(s,'source-mode','collection');project(s,'/Data');act(s,'candidate-toggle','/Data/Website');act(s,'candidate-toggle','/Data/Notes');act(s,'candidate-import');act(s,'scan-result',outcome);act(s,'scan-result','done');assert.equal(s.projects.length,0)}
})

test('batch re-entry and repeated result do not duplicate projects; missing executor starts nothing',()=>{
 const s=connected();act(s,'source-mode','collection');project(s,'/Data');act(s,'candidate-toggle','/Data/Website');act(s,'candidate-toggle','/Data/Notes');
 s.readiness='auth';assert.equal(act(s,'candidate-import'),'r0-provider');assert.equal(s.scan,'candidates');assert.equal(s.projects.length,0);
 s.readiness='ready';act(s,'candidate-import');const token=s.scanToken;act(s,'candidate-import');assert.equal(s.scanToken,token);
 act(s,'scan-result');act(s,'scan-result');act(s,'candidate-import');assert.equal(s.projects.length,2);
})

test('failed or stopped batch retries the same selected repositories through the visible scan action',()=>{
 for(const stop of ['failed','denied','stop']){const s=connected();act(s,'source-mode','collection');project(s,'/Data');act(s,'candidate-toggle','/Data/Website');act(s,'candidate-toggle','/Data/Notes');act(s,'candidate-import');
 if(stop==='stop')act(s,'scan-cancel');else act(s,'scan-result',stop);
 assert.equal(s.projects.length,0);act(s,'scan');act(s,'scan-result');
 assert.deepEqual(s.projects.map(p=>p.source),['/Data/Website','/Data/Notes']);act(s,'scan-result');assert.equal(s.projects.length,2)}
})

test('failed batch retry retains an independently imported repository and adds the remaining tick',()=>{
 const s=connected();act(s,'source-mode','collection');project(s,'/Data');act(s,'candidate-toggle','/Data/Website');act(s,'candidate-toggle','/Data/Notes');act(s,'candidate-import');act(s,'scan-result','failed');
 const existing={id:'concurrent-existing',source:'/Data/Website',name:'Website',sources:[{path:'/Data/Website',role:'primary'}],tasks:[{id:'keep'}],contextRevision:9};
 s.projects.push(existing);const before=structuredClone(existing);act(s,'scan');act(s,'scan-result');
 assert.equal(s.projects.length,2);assert.equal(s.selected,existing.id);assert.deepEqual(existing,before);assert.equal(s.projects[1].source,'/Data/Notes');
 assert.deepEqual(s.importResults.map(r=>r.status),['existing','added']);
})
test('explicit rescan and single candidate drop failed batch identity',()=>{
 const s=connected(),p=project(s,'/Projects/atlas','partial');act(s,'source-mode','collection');project(s,'/Data');act(s,'candidate-toggle','/Data/Website');act(s,'candidate-toggle','/Data/Notes');act(s,'candidate-import');act(s,'scan-result','failed');
 s.selected=p.id;act(s,'scan-current');act(s,'scan-result');assert.equal(s.projects.length,1);assert.equal(p.partial,false);assert.equal(s.pendingImports,null);
 act(s,'source-mode','collection');project(s,'/Data');act(s,'candidate-toggle','/Data/Website');act(s,'candidate-import');act(s,'scan-result','failed');act(s,'candidate','/Data/Notes');act(s,'scan-result');
 assert.deepEqual(s.projects.map(p=>p.source),['/Projects/atlas','/Data/Notes']);
})

test('batch summary preserves each result and retries only failed rows',()=>{
 firstReleaseStores.clear();const s=firstReleaseStore({estate:'batch-summary'});s.readiness='ready';act(s,'source-mode','collection');project(s,'/Data');act(s,'candidate-all');s.importOutcomes={'/Data/Notes':'failed'};act(s,'candidate-import');assert.equal(act(s,'scan-result'),'r0-discovery');
 assert.equal(s.projects.length,1);const existing=structuredClone(s.projects[0]);assert.deepEqual(s.pendingImports,['/Data/Notes']);assert.deepEqual(s.chosenSources,['/Data/Website','/Data/Notes']);
 const html=renderFirstRelease('r0-discovery',{estate:'batch-summary'});assert.match(html,/Повторить для оставшихся/);assert.match(html,/Выбор сохранён/);assert.match(html,/Открыть первый проект/);
 s.importOutcomes={};act(s,'scan');act(s,'scan-result');assert.equal(s.projects.length,2);assert.deepEqual(s.projects[0],existing);assert.equal(s.pendingImports,null);assert.deepEqual(s.importResults.map(r=>r.status),['added','added']);act(s,'scan-result');assert.equal(s.projects.length,2);
})
test('select all excludes nested/worktree parts and imported heads; manual parts warn and stay separate',()=>{
 firstReleaseStores.clear();const s=firstReleaseStore({estate:'scan-parts'});s.readiness='ready';project(s,'/Data/Website');act(s,'source-mode','collection');project(s,'/Data');s.candidates.push({name:'Website tools',path:'/Data/Website/tools',kind:'nested'},{name:'Website worktree',path:'/Data/Website-wt',kind:'worktree'});
 act(s,'candidate-all');assert.deepEqual(s.chosenSources,['/Data/Notes']);const html=renderFirstRelease('r0-discovery',{estate:'scan-parts'});assert.match(html,/Выбирайте вручную/);act(s,'candidate-toggle','/Data/Website/tools');act(s,'candidate-toggle','/Data/Website-wt');act(s,'candidate-import');act(s,'scan-result');assert.equal(s.projects.length,4);assert(s.projects.every(p=>p.sources.length===1));
})

test('import summary retains collection and per-project gaps; kept checklist remains reachable',()=>{
 firstReleaseStores.clear();const state={estate:'scan-gaps'},s=firstReleaseStore(state);s.readiness='ready';act(s,'source-mode','collection');project(s,'/Data','partial');act(s,'candidate-toggle','/Data/Website');act(s,'candidate-import');act(s,'scan-result','partial');
 assert.equal(s.projects[0].partial,true);assert.equal(s.importResults[0].observation,'partial');const summary=renderFirstRelease('r0-discovery',state).split('<div class="r0-demo-tools">')[0];assert.match(summary,/Список найденных проектов неполный/);assert.match(summary,/Обзор неполный/);assert.match(summary,/Выбрать оставшиеся проекты/);
 act(s,'candidates-return');assert.equal(s.scan,'candidates-partial');assert.equal(s.projects.length,1);assert.deepEqual(s.chosenSources,[]);act(s,'candidate-toggle','/Data/Notes');act(s,'candidate-import');act(s,'scan-result');assert.equal(s.projects.length,2);assert.equal(s.projects[0].source,'/Data/Website');
})

test('unknown scan or row outcome is not a successful project observation',()=>{
 const s=connected();act(s,'source-mode','collection');act(s,'picked','/Data');act(s,'scan');act(s,'scan-result','unknown');assert.equal(s.scan,'failed');assert.equal(s.projects.length,0);
 act(s,'scan');act(s,'scan-result');act(s,'candidate-all');s.importOutcomes={'/Data/Notes':'unknown'};act(s,'candidate-import');act(s,'scan-result');assert.equal(s.projects.length,1);assert.deepEqual(s.pendingImports,['/Data/Notes']);assert.equal(s.importResults[1].status,'failed');
})
