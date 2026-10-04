# #region com-source-capture — docs: docs/reports/2026-10-04-project-communication-architecture/README.md#existing-source-and-exact-reuse-boundaries
"""Read-only source snapshot. Fetches public documentation and selected repository metadata.
No credential values, production databases, providers or Telegram bots are accessed.
"""
import datetime, hashlib, json, pathlib, subprocess, urllib.request
OUT=pathlib.Path(__file__).parent
STAMP=datetime.datetime.now(datetime.timezone.utc).isoformat()
def git(*a,cwd): return subprocess.check_output(['git',*a],cwd=cwd,text=True)
def gh(path): return json.loads(subprocess.check_output(['gh','api',path],text=True))
base='2e06e5013595ec96b52b85cae2c486050632565b'
files={
 'packages/journal/src/index.ts':['append_event','55P03','replay'],
 'apps/desktop/src/shared/scope.ts':['TABLE_SCOPE','private:'],
 'apps/desktop/src/main/scopedStore.ts':['createScopedStore','selectAll'],
 'apps/desktop/src/main/agentSurface.ts':['interface AgentScope','mint','primeCredential','serverFor'],
 'apps/desktop/src/main/accessService.ts':['authenticate','knownCredential','primeCredential'],
 'apps/desktop/src/main/hubCall.ts':['forward','forgetBinding','outcome_unknown'],
 'apps/desktop/src/main/continuationDelivery.ts':['beforeWrite','continuation_dispatch','outcome_unknown'],
 'apps/desktop/src/main/deliveryQueue.ts':['beforeWrite','generation','outcome_unknown'],
 'apps/desktop/src/main/policy.ts':['beginDispatch','spendGrant'],
 'apps/desktop/src/main/authContext.ts':['AuthContext','authRevision'],
 'apps/desktop/src/shared/board.ts':['no dismiss','derive','Board'],
 'apps/desktop/src/shared/readEnvelope.ts':['SourceStatus','freshness','ReadEnvelope'],
 'apps/desktop/src/main/agentRegistry.ts':['RegistryEntry','SERVICE_FIELDS'],
 'apps/desktop/src/shared/providerCapabilityMatrix.ts':['PINNED_BUILDS'],
 'supabase/migrations/20260927000062_managed_stop.sql':['continuation_dispatch','clock_timestamp','claim_id'],
 'supabase/migrations/20260927000064_private_ceo_conversations.sql':['ceo_private_contents','ceo_authorized','revoke all'],
 'supabase/migrations/20260927000065_restore_authority_boundary.sql':['record_estate_restore_boundary','restore_estate_internal'],
 'docs/evidence/plans/2026-10-04-project-communications.md':['COM-12','COM-14','Telegram disabled'],
}
repo=pathlib.Path(__file__).resolve().parents[4]
rows=[]
for f,terms in files.items():
 s=git('show',f'{base}:{f}',cwd=repo)
 rows.append({'repository':'passioncode-ai/fabric','commit':base,'path':f,'sha256':hashlib.sha256(s.encode()).hexdigest(),'matches':[{'line':i,'text':l.strip()} for i,l in enumerate(s.splitlines(),1) if any(t in l for t in terms)]})
others=[('fabric-agent-contract','df55c8c54a23251342a7ee57ba95642b7eb39e61',['src/extensions.ts','schemas/coordination.schema.json','schemas/interop-job-handle.schema.json']),('fabric-agent-adapter','907acb286abe55c627bfeb4500906b76d0284e81',['fabric-contract.lock.json','plugins/fabric-agent-adapter/skills/building-fabric-services/scripts/fabric_interop.py']),('fabric-dashboards','f7e806919c81f88d0fc7129c355c06c7036387ef',['src/core/monitor.ts','packages/service-host/src/links.ts']),('fabric-switchboard','5e275caf50436f6a95eabad9c8e16bedade1ffe5',['crates/switchboard-runtime/src/launch.rs','docs/packets/session-supervisor.md']),('fabric-workspace','fc19159515e23feee3b9b1438ec92775f0c960ed',['knowledge/vision.md','knowledge/principles.md','knowledge/rules.md']),('passioncode-ai.github.io','25e138ff127bb6b7145ce30914f00178c71560e7',['fabric/index.html','fabric/release.json'])]
for name,sha,paths in others:
 for f in paths:
  try:s=git('show',f'{sha}:{f}',cwd=pathlib.Path.home()/'DATA'/name)
  except subprocess.CalledProcessError:continue
  rows.append({'repository':'passioncode-ai/'+name,'commit':sha,'path':f,'sha256':hashlib.sha256(s.encode()).hexdigest(),'lines':len(s.splitlines())})
obs='fb0350d081f2af53d5a18fa1dae67836774cf047'
tree=gh(f'repos/passioncode-ai/project-observatory-dashboard/git/trees/{obs}?recursive=1')
obs_paths=[x['path'] for x in tree['tree'] if any(t in x['path'] for t in ['fabric_interop','fabric_service','FABRIC-INTEROP.md','FABRIC-SERVICE.md'])]
rows.append({'repository':'passioncode-ai/project-observatory-dashboard','commit':obs,'relevant_paths':obs_paths})
for f in ['observatory/engine/fabric_service.py','docs/design/FABRIC-INTEROP.md','docs/design/FABRIC-SERVICE.md']:
 import base64
 d=gh(f'repos/passioncode-ai/project-observatory-dashboard/contents/{f}?ref={obs}')
 b=base64.b64decode(d['content']);s=b.decode()
 rows.append({'repository':'passioncode-ai/project-observatory-dashboard','commit':obs,'path':f,'sha256':hashlib.sha256(b).hexdigest(),'lines':len(s.splitlines()),'matches':[{'line':i,'text':line.strip()} for i,line in enumerate(s.splitlines(),1) if any(t in line for t in ['Vendored','PROTOCOL =','EXTENSION_KEY =','MCP','interop','transport','stdio'])][:15]})
(OUT/'repository-sources.json').write_text(json.dumps({'retrieved_at':STAMP,'files':rows},indent=2)+'\n')
urls=[('MCP specification','https://modelcontextprotocol.io/specification/2026-07-28'),('MCP Tasks extension','https://modelcontextprotocol.io/extensions/tasks/overview'),('PostgreSQL17 SELECT','https://www.postgresql.org/docs/17/sql-select.html'),('PostgreSQL17 transaction isolation','https://www.postgresql.org/docs/17/transaction-iso.html'),('PostgreSQL17 NOTIFY','https://www.postgresql.org/docs/17/sql-notify.html'),('Telegram Bot API','https://core.telegram.org/bots/api'),('Telegram features','https://core.telegram.org/bots/features'),('Telegram changelog','https://core.telegram.org/bots/api-changelog')]
web=[]
for name,url in urls:
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Fabric bounded research source verifier'}),timeout=30) as response:
   b=response.read();web.append({'name':name,'url':url,'final_url':response.url,'retrieved_at':STAMP,'status':response.status,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
 except Exception as e:web.append({'name':name,'url':url,'retrieved_at':STAMP,'fetch_error':type(e).__name__+': '+str(e)})
for path in ['repos/timgit/pg-boss/issues/comments/5624267303','repos/timgit/pg-boss/issues/comments/5625222211','repos/tdlib/telegram-bot-api/issues/comments/4141729842']:
 d=gh(path);web.append({'url':d['html_url'],'author':d['user']['login'],'author_association':d['author_association'],'created_at':d['created_at'],'updated_at':d['updated_at'],'retrieved_at':STAMP,'body_sha256':hashlib.sha256(d['body'].encode()).hexdigest()})
(OUT/'online-sources.json').write_text(json.dumps(web,indent=2)+'\n')
print(json.dumps({'repository_file_receipts':len(rows),'online_receipts':len(web),'http_errors':sum('fetch_error'in x for x in web),'observatory_paths':obs_paths}))

# #endregion com-source-capture
