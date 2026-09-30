from pathlib import Path
import json
root=Path('apps/desktop/out/renderer')
out=Path('/tmp/fabric-audit-20260905/renderer-fixture');out.mkdir(exist_ok=True)
if not (out/'assets').exists(): (out/'assets').symlink_to(root/'assets', target_is_directory=True)
(out/'index.html').write_text((root/'index.html').read_text().replace('<head>','<head><script src="fixture.js"></script>').replace('<title>PassionCode</title>','<title>Audit fixture — current PassionCode renderer</title>'))
(out/'fixture.js').write_text(r'''
// Audit-only synthetic IPC. No connection to real data or processes.
const params=new URLSearchParams(location.search), now=new Date().toISOString();
let settings={theme:params.get('theme')||'dark',locale:'en',keepAwake:'while-working'};
const project=(id,name)=>({id,estate_id:'audit',name,purpose:'Synthetic audit fixture — no real operations',repo_path:'/audit/'+id,status:'active',config_revision:1,created_at:now,memory_backend:'local',default_agent:'claude-code'});
const projects=[project('project-a','Project A — Fabric'),project('project-b','Project B — a separate operating context')];
const options=[{id:'claude-code',label:'Claude Code',program:'claude',description:'Fixture',available:true,connectsToSurface:true},{id:'shell',label:'Terminal',program:null,description:'Fixture',available:true,connectsToSurface:false}];
const sessions=[{sessionId:'session-a',projectId:'project-a',cwd:'/audit/project-a',program:'claude',optionId:'claude-code',scrollback:'Audit fixture: checking contracts\r\n',running:true,state:'running',startedAt:now,lastActivityAt:now,tail:'Checking project contracts',exitCode:null}];
const noop=()=>()=>{};
const log=(name,arg)=>{let n=document.querySelector('#audit-actions');if(!n){n=document.createElement('pre');n.id='audit-actions';n.style='position:fixed;bottom:0;right:0;z-index:99999;background:white;color:black;font:12px monospace;max-width:650px;max-height:90px;overflow:auto';document.body.append(n)}n.textContent+=name+' '+JSON.stringify(arg)+'\n';};
window.fabric={
 settings:{read:async()=>settings,write:async s=>(settings=s)},
 meta:{info:async()=>({estateName:'AUDIT FIXTURE',sessionId:params.get('session'),filePath:params.get('editor')?'/audit/example.ts':null})},
 projects:{list:async()=>{if(params.has('offline'))throw Error('audit database unavailable');return projects},stats:async()=>({agentsRunning:1,repos:1,memoryFacts:1,memorySuperseded:0,transcripts:0,transcriptChars:0,retrievals:1,retrievalMisses:0,events:1,lastActivityAt:now}),repoStates:async id=>[{path:'/audit/'+id,branch:'main',ahead:0,behind:0,changed:0,untracked:0,lastCommit:{sha:'fixture',subject:'Audit fixture',at:now},readAt:now,error:null}],create:async input=>{log('create',input);return project('new',input.name)},update:async()=>{},updateSettings:async()=>{}},
 repos:{list:async id=>[{id:'repo-'+id,project_id:id,path:'/audit/'+id,label:id,is_primary:true,attached_at:now}],choose:async()=>['/audit/chosen'],attach:async()=>{},detach:async()=>{}},
 tasks:{list:async()=>[],start:async input=>{log('task.start',input);return {task:{id:'audit-task'},session:sessions[0]}}},
 feed:{replay:async()=>[]},quota:{read:async()=>({fiveHour:{utilization:27,resetsAt:now},sevenDay:{utilization:12,resetsAt:now},byModel:{},readAt:now,ageSeconds:0,problem:null})},
 transcripts:{list:async()=>[],get:async()=>null},
 memory:{search:async id=>[{id:'fact-'+id,project_id:id,claim:'Fixture fact for '+id,source_ref:'audit fixture',kind:'fact',actor_kind:'person',actor_id:'audit',recorded_at:now,valid_from:now,valid_to:null,superseded_by:null}],remember:async(...a)=>log('remember',a)},
 terminal:{options:async()=>options,memoryBackends:async()=>[{id:'local',available:true,reason:null},{id:'cloud',available:false,reason:'hosted-estates-not-built'}],list:async id=>id?sessions.filter(s=>s.projectId===id):sessions,claims:async id=>id==='project-a'?[{sessionId:'session-a',stage:'Reviewing',step:2,ofSteps:5,note:null,reportedAt:now}]:[],get:async id=>sessions.find(s=>s.sessionId===id),onData:noop,onExit:noop,open:async()=>sessions[0],end:async id=>log('terminal.end',id),dismiss:async id=>log('terminal.dismiss',id),write:()=>{},resize:()=>{}},
 windows:{openSession:async id=>log('windows.openSession',id),openFile:async id=>log('windows.openFile',id)},
 files:{list:async()=>[{name:'example.ts',path:'/audit/example.ts',isDirectory:false,size:38}],read:async file=>({path:file,name:'example.ts',content:'// audit fixture\nconst value = 1;\n',hash:'fixture',language:'typescript'}),write:async()=>({ok:true,hash:'saved'}),requestOverwrite:async()=>({grantId:'fixture'}),openExternally:async()=>{}}
};
''')
print(out)
