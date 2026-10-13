import ast,hashlib,json,os,pathlib,random,types
source=pathlib.Path(os.environ['AGENT_SYNC_SOURCE']); raw=source.read_bytes(); tree=ast.parse(raw)
fn=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='lease_name')
namespace={'_LEASE_SAFE':set('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-')}
exec(compile(ast.Module(body=[fn],type_ignores=[]),'<extracted-installed-lease-name>','exec'),namespace)
rng=random.Random(23013); alphabet='aAzZ09._-:/%éλ中😀';keys=['.a','a.','a..b','x.lock','x/.lock','😀','é','%2E']+[''.join(rng.choice(alphabet) for _ in range(rng.randint(1,12))) for _ in range(500)]
acquire=next(n for n in ast.walk(tree) if isinstance(n,ast.FunctionDef) and n.name=='_git_acquire')
payload=next(n.value.args[0] for n in acquire.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='payload' for t in n.targets))
clock=iter(['2026-10-13T11:59:50Z','2026-10-13T11:59:51Z'])
p=eval(compile(ast.Expression(payload),'<extracted-installed-acquire-payload>','eval'),{'key':'scope','self':types.SimpleNamespace(rid='run',ttl=60),'now_iso':lambda:next(clock),'repo_name':lambda:'fixture','platform':types.SimpleNamespace(node=lambda:'fixture')})
print(json.dumps({'installed_sha256':hashlib.sha256(raw).hexdigest(),'seed':23013,'cases':[{'key':k,'ref':'refs/agent-sync/leases/'+namespace['lease_name'](k)} for k in keys],'cross_second_payload':p},ensure_ascii=True,indent=2))
