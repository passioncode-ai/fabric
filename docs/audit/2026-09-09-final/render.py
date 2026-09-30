import json,re,subprocess,collections,html,shutil,pathlib,hashlib
R=pathlib.Path(__file__).resolve().parents[3]; O=pathlib.Path(__file__).resolve().parent; E=O
SHA='d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d'
def read(p):return subprocess.check_output(['git','show',SHA+':'+p],cwd=R,text=True)
def jread(p):return json.loads(read(p))
def dump(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
catalog=jread('docs/architecture/engineering-specs.json'); old=jread('docs/audit/2026-09-07-deep-audit.json')
nodes=catalog['execution_nodes']; specs={i['id']:i for i in catalog['items']}
parts={p['id']:dict(p,parent=i['id']) for i in catalog['items'] for p in i.get('parts',[])}
backlog=read('docs/evidence/backlog.md'); queue=backlog.split('<!-- priority-nodes:begin -->')[1].split('<!-- priority-nodes:end -->')[0]
queue_rows={}; queue_lines={}
for ln,line in enumerate(backlog.splitlines(),1):
 m=re.search(r'<a id="work-[^"]+"></a>\*\*([^*]+)\*\*',line)
 if m:queue_rows[m[1]]=line;queue_lines[m[1]]=ln
assert len(queue_rows)==65
shipped={k for k,v in queue_rows.items() if '**shipped ' in v};active={k for k,v in queue_rows.items() if '| DONE |' not in v}
assert len(shipped)==44 and len(active)==61
packets=[]; batches=[]
for scope in ['001-027','028-049','050-078','079-080']:
 p=E/f'scenarios-{scope}.json'
 if not p.exists():raise Exception(f'Awaiting {p}')
 d=json.loads(p.read_text());batches.append(d)
 # Batch snapshots are already beside this producer.
scenarios=[s for b in batches for s in b['scenarios']]
scenario_titles=dict(re.findall(r'^### (SCN-\d{3}): (.+)$',read('docs/ux/scenarios.md'),re.M))
for scenario in scenarios:scenario.setdefault('title',scenario_titles[scenario['id']])
assert {s['id'] for s in scenarios}=={f'SCN-{i:03}' for i in range(1,81)} and len(scenarios)==80
tasks=json.loads((E/'core-tasks.json').read_text())
for b in batches:
 for t in b.get('tasks',b.get('task_packets',b.get('task_proposals',[]))):
  if isinstance(t,dict):tasks.append(t)
assert len({t['id'] for t in tasks})==len(tasks)
task_ids={t['id'] for t in tasks}
for t in tasks:
 t.setdefault('disposition','proposed-remediation-not-implemented')
 t.setdefault('source_commit',SHA)
 t.setdefault('evidence_level','source-trace; production incidence not measured')
 t.setdefault('owner',', '.join(t.get('owners',t.get('existing_owners',[]))))
 t.setdefault('context_files',t.get('evidence',t.get('files',[])))
 t.setdefault('solution_steps',t.get('steps',t.get('decomposition',t.get('substeps',[]))))
 t.setdefault('positive_acceptance',t.get('acceptance',t.get('acceptance_positive',t.get('acceptance_and_negative_tests',[]))))
 t.setdefault('exclusions',t.get('do_not',[]))
 t.setdefault('negative_acceptance',t.get('acceptance_negative',t.get('acceptance_and_negative_tests',[])))

# Audit's remediation graph is separate from canonical/external activation gates.
# Merged rows are evidence subparts, never a second competing executor.
execution_dependencies={
 'FA-02':['FA-03','FA-04'],'FA-06':['FA-02'],'FA-09':['FA-02','FA-03','FA-07'],'FA-10':['FA-05'],
 'UXA-C06':['UX28-02'],'UXA-F01':['FA-02'],'UXA-F03':['UXA-F01','UXA-F02'],
 'UXA-F04':['FA-02','UX28-02'],'UXA-F05':['UXA-F01'],'UXA-F06':['UXA-F03'],
 'UXA-F08':['UXA-F05','UXA-F07'],'UXA-F09':['UXA-F02','UXA-F03','UXA-F04','UXA-F07'],
 'UXA-F10':['UXA-F07','FA-02'],'UX28-07':['UX28-06'],'UX28-08':['FA-02','UX28-06'],
 'UX28-09':['UX28-02','UX28-06'],'UX28-11':['UX28-15'],'UX28-13':['UX28-02','UX28-06'],
 'AX-02':['FA-02'],'AX-03':['FA-02','UX28-06'],'AX-04':['FA-02','UX28-06'],
 'AX-07':['UX28-06'],'AX-08':['FA-02','AX-02'],'AX-10':['FA-02','AX-04'],
 'AX-11':['AX-03','AX-04'],'AX-12':['UX28-06'],'AX-13':['FA-02','UX28-08','AX-08'],
 'AX-14':['UX28-06'],'AX-15':['UX28-06'],'AX-16':['AX-07']}
for task in tasks:
 task['execution_dependencies']=execution_dependencies.get(task['id'],[])
 task['dependency_rule']='These IDs order the corrective implementation only. Preserve canonical and external gates in dependencies/depends_on; contract/fixture work may start earlier. No automatic activation from this graph.'

# Explicit cross-batch ruling, never concatenate independent findings as priorities.
merges={'UXA-C01':'UX28-02','UXA-C02':'UX28-02','UXA-C05':'UX28-02','UXA-C06':'UX28-06','AX-01':'FA-02','AX-05':'UX28-06','AX-06':'UX28-08','AX-09':'UX28-12','AX-17':'UX28-15'}
for k,v in merges.items():
 if v in task_ids:
  next(t for t in tasks if t['id']==k)['execution_owner']=v
  next(t for t in tasks if t['id']==k)['disposition']='merged-evidence-subtask'

for amendment in batches[-1].get('packet_amendments',[]):
 target=next(t for t in tasks if t['id']==amendment['packet'])
 target.setdefault('supplemental_scope',[]).append(amendment)
 if target.get('execution_owner'):
  next(t for t in tasks if t['id']==target['execution_owner']).setdefault('supplemental_scope',[]).append(amendment)

mapping={
'RT-01':('closed-subset','S02','Scope filters and projector guards exist; retain new tenant/auth probes, no rewrite.'),
'RT-02':('keep','FA-02','Repeated follower spawn reproduced.'),'RT-03':('keep','FA-03','Malformed quota allows; chain bypass retained.'),
'RT-04':('closed-subset','FA-09','ADR-0050 lifecycle replaces false executed; actual adapters still absent.'),
'RT-05':('closed-subset','S03.boundary','Atomic reserve_authority now exists; native interception remains separate.'),
'RT-06':('closed-subset','S03','Authority ingress redaction exists; do not rebuild M195.'),
'RT-07':('narrow','UX28-02','Board foundation exists; old attention consumer still erases quality/freshness.'),
'RT-08':('closed-subset','M198','config_revision from journal seq; preserve replay invariant.'),
'RT-09':('narrow','FA-10','Target vs current contract drift remains; inspect exact surfaces rather than generic architecture rewrite.'),
'RT-10':('keep','FA-04','RPC error and check/append race remain.'),
'UV-01':('closed-subset','S01','Shell hook floor shipped; do not recreate old crash task.'),
'UV-02':('keep','S01','Saved-work acceptance remains independent of shell hooks.'),
'UV-03':('closed-subset','S01','Empty board door shipped; error/optimistic paths still need probes.'),
'UV-04':('closed-subset','M17','Agent descriptor display corrected; interoperability admission remains distinct.'),
'UV-05':('narrow','UX28-14','Interaction semantics need runtime keyboard/native validation; do not claim freshly reproduced.'),
'UV-06':('closed-subset','S13','Single active surface and destination resolver exist.'),
'UV-07':('keep','S01','Project creation/retry/draft persistence remain.'),
'UV-08':('merge','UX28-02','One read lifecycle task covers incomplete/failed/empty states.'),
'UV-09':('merge','UX28-06','Exact evidence resolver remains; do not equate project navigation with source.'),
'UV-10':('merge','UX28-02','Subject/generation keyed reads.'),
'UV-11':('narrow','FA-02','Durable delivery table+ack exist, but runtime admission integration/fencing incomplete.'),
'UV-12':('merge','FA-02','startExisting has no renderer entry; avoid second launch architecture.'),
'UV-13':('merge','UX28-02','Freshness/source-specific invalidation.'),
'UV-14':('keep','UX28-14','Native terminal/editor light/dark validation remains unmeasured.'),
'UV-15':('merge','UX28-14','Accessibility baseline plus named controls.'),
'UV-16':('merge','UX28-14','Contrast/token roles need measured visual check, not taste.'),
'UV-17':('merge','UX28-14','Narrow/zoom/layout acceptance.'),
'UV-18':('merge','UX28-15','Runtime vs target screen/flow statuses.'),
'UV-19':('narrow','UX28-15','Public narrative is separately hosted; current live deployment unverified.'),
'PLAN-01':('closed-subset','S06','Atomic answer recomputes blocking set; continuation wiring still in FA-02.'),
'PLAN-02':('keep','UX28-03','Real component reproduction marks digest seen on refresh.'),
'PLAN-03':('keep','UX28-01','Real component reproduction writes task A brief into B.'),
'PLAN-04':('keep','UX28-10','Favourite ceiling/replace flow absent.'),
'PLAN-05':('keep','UX28-09','Search stores still narrower than promise.'),
'PLAN-06':('merge','UX28-06','History/evidence exact destination.'),
'PLAN-07':('keep','UX28-05','Project id ignored and failed grant count shown zero.'),
'PLAN-08':('closed-subset','M190','Goal denominator fixed; graph screen not delivered.'),
'PLAN-09':('merge','UX28-02','Wrong-subject stale reads one root cause.'),
'PLAN-10':('narrow','FA-05','Engineering catalog added exact contracts; historical absence rationales need current delta.'),
'PLAN-11':('narrow','M152.commit','Atomic answer exists; all remaining multi-write command paths retain own tasks.'),
'PLAN-12':('closed-subset','M176','Transport trace+corpus exist; real-runner and native coverage not proven.'),
'PLAN-13':('narrow','FA-05','Canonical edges improved; scratchpad alias failure and activation-vs-subset remain.'),
'PLAN-14':('keep','FA-10','Milestone proposal rows and shipped queue rows still coexist.'),
}
assert set(mapping)=={f['id'] for f in old['findings']}
old_disposition=[]
for f in old['findings']:
 state,owner,reason=mapping[f['id']]
 old_disposition.append({'id':f['id'],'title':f['title'],'disposition':state,'owner':owner,'reason':reason,'historical_evidence':f.get('evidence',[]),'current_receipt':'current packets + baseline source; closed-subset is not fresh full-runtime certification'})

history=json.loads((E/'ci-history.json').read_text())
counts={'scenarios':len(scenarios),'scenario_verdicts':dict(collections.Counter(s['verdict'] for s in scenarios)),'queue_nodes':len(active),'claimed_shipped':len(shipped),'queue_open':len(active-shipped),'retained_done':len(queue_rows)-len(active),'old_findings':len(old_disposition),'old_dispositions':dict(collections.Counter(x['disposition'] for x in old_disposition)),'remediation_packets':len(tasks),'ci_runs':len(history),'ci_conclusions':dict(collections.Counter(x['conclusion'] for x in history))}
co=[]
for ln,line in enumerate(read('docs/evidence/specs/2026-08-16-software-fabric-carryover.md').splitlines(),1):
 if not re.match(r'^\| CO-\d+ \|',line):continue
 cells=[x.strip() for x in re.split(r'(?<!\\)\|',line)[1:-1]]
 if cells[0]=='CO-113':continue
 state=cells[-1];text=' '.join(cells).lower()
 lane='retained-history' if not bool(re.match(r'open\b',re.sub(r'^[\s*]+','',state),re.I)) else 'horizon-or-owner-gate'
 candidates=[t['id'] for t in tasks if cells[0] in json.dumps(t,ensure_ascii=False)]
 co.append({'id':cells[0],'subject':cells[2],'status_at_baseline':state,'home':cells[5],'line':ln,'disposition':'linked-current-packet' if candidates else lane,'packets':candidates,'next_action':'Read original owner/activation condition; no broad strategic umbrella may spawn duplicate work. Revalidate the concrete child requirement before activation.'})
assert len(co)==111
counts['carryover_baseline']=len(co);counts['carryover_open_baseline']=sum(bool(re.match(r'open\b',re.sub(r'^[\s*]+','',x['status_at_baseline']),re.I)) for x in co)
milestones=[]
for ln,line in enumerate(backlog.splitlines(),1):
 if re.match(r'^\| M\d+ \|',line):
  c=[v.strip() for v in re.split(r'(?<!\\)\|',line)[1:-1]];milestones.append({'id':c[0],'title':c[1],'status':c[-1],'source_line':ln,'packet':c[0] if c[0] in queue_rows else None,'disposition':'catalog-packet' if c[0] in queue_rows else 'retained-existing-owner-not-reopened','next_action':'Resolve concrete child scope and evidence before activation; this historical row is not an independent duplicate implementation task.'})
assert len(milestones)==196

def source_link(ref):
 m=re.match(r'^(.+?):(\d+)(?:.*)$',ref)
 if m and (R/m[1]).is_file():return f'https://github.com/passioncode-ai/fabric/blob/{SHA}/{m[1]}#L{m[2]}'
 return None
def tree_md(x,level=0):
 if isinstance(x,dict):return '\n'.join(f'\n{"#"*min(6,level+3)} {k}\n'+tree_md(v,level+1) for k,v in x.items())
 if isinstance(x,list):return '\n'.join('- '+(json.dumps(v,ensure_ascii=False) if isinstance(v,(dict,list)) else str(v)) for v in x)
 return str(x)
common='''# Контекст и договор передачи агентам

Аудит исходников `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d`, 2026-09-09. Это план следующей реализации. Он не включает разрешение на платные прогоны, новые credentials, production DB reset или activation внешних effects.

1. Начать с этой страницы, выбранного packet и `docs/architecture/system-contract.md`; подробная целевая спецификация — `docs/architecture/engineering-specs.json`. Статус реализации проверять по коду, а не по `proposed_contract_not_implemented` внутри исторического target catalog.
2. Прочитать `AGENTS.md`, `docs/AGENT_SYNC.md`, `CONTEXT.md`, применимые ADR и сценарий. В отдельной ветке/checkout, уникальная AGENT_SYNC_RUN_ID; shared docs только под lease. Не работать одновременно над main/index.ts в одном checkout.
3. Перепроверить baseline против текущей ветки: `git diff d28c321 -- <affected paths>`. В чужие изменения не писать. Сначала воспроизвести дефект; для audit probes PASS означает подтверждение старого дефекта, не здоровье продукта.
4. Один logical command — одна atomic receipt. Actor/estate/project/lease revision приходят из trusted context. Unknown не равен zero/success; agent claim не равен observation; permission не равен effect.
5. Task, TaskRun, Session, Attempt, WorkflowRun не взаимозаменяемы. Новую схему вводить additive migration; не менять старые journal events. Native session refs opaque. Повтор command key возвращает прежнюю receipt.
6. UI: controlled entity-keyed drafts, generation guard, локальные loading/error/empty/stale; отказы CommandResult должны быть показаны, catch недостаточно. Keyboard/focus/zoom, RU/EN и contrast проверяются отдельно. Mockup — target, не runtime evidence.
7. Перед работой указать точные producer → store/command → query → IPC → renderer → observable. Если consumer отсутствует, задача заканчивается partial, а не shipped-end-to-end.
8. В каждом packet поле paths — существующие точки чтения; future_files каталога — только кандидаты на создание. Не создавать уже существующие TaskRun/trace/answer механизмы повторно. Общие generic envelopes не дублировать.
9. Соседние contract/adapter repositories меняет их владелец: сначала versioned contract и conformance, затем pin потребителя. Repo snapshot hashes перечислены в index JSON; другие ветки автоматически не импортировать.
10. Приёмка: failing baseline → исправление → positive+negative tests → consumer walkthrough → exact command/exit/source receipt. Full DB/role/crash probes — на disposable stack. Native paid pilot ждёт названных runner, resource и бюджета.
11. Исторические документы не переписывать. Новый ADR только для действительной смены архитектуры; предложение в этом аудите не есть принятый ADR. Каждое оставшееся ограничение — в существующем owner/CO-113 subitem. Commit+push, fresh checkout, map and workspace publication по owning repo contract.

## Более поздние изменения

Сначала [последний auto addendum](provider-auto-addendum.md): ADR-0052 заменяет прежнее исключение auto; M199.probe/accounts/auth/binding/resume/usage/auto/ui/acceptance — актуальные девять частей. Затем прочитать [provider addendum](provider-addendum.md) и существующие [PA-01–06](../../evidence/plans/2026-09-09-provider-accounts.md#packets) перед работой с account/quota/session. Срез 25026da — только proposed design. Generic reads остаются UX28-02, quota identity/cache — PA-05, native switch — M199, admission/run — FA-02. Не создавать второй account store или coordinator под другим ID. M199.ui — полная приёмка UI после auto; независимые account/manual read-state fixtures можно делать раньше по готовым контрактам, без утверждения полной поставки M199.ui.

## Параллельная работа и контракты рёбер

Безопасные параллельные lanes: build/CI; UI saved-work; read models; launch/DB; pure manager contracts. Внутри lane общие файлы сериализуются. UI до завершения producer может строить отказ/unknown и fixtures, но не активировать capability.

- FA-03 → FA-02: validated scoped quota + admission reservation.
- FA-04 → FA-02: атомарный ацикличный dependency snapshot.
- FA-02 → run/continuation UI: одна подтверждённая TaskRun/session identity и lifecycle receipt.
- UX28-02 → Inbox/cycles/graphs: freshness, partial sources, scope generation, minimum cursor.
- M153 + M158 → M166: pure hygiene/criticality; M168 остаётся mutation checker.
- M166 → M167 → M169/M171: core snapshot → optional model port → bounded attempts/usage.
- M166 → M194; M169 + M171 + M194 → M175: replaceable binding, cumulative budget, manager lifecycle.
- M183.local → M183.upstream: устойчивый локальный lineage/suppression; outbound дополнительно ждёт endpoint/schema/consent.

Каждый executor перед стартом проверяет payload ребра. Фаза сама по себе не блокирует работу. Один inherited packet и дочерняя коррекция — один owner scope, не две конкурирующие реализации.
'''
(O/'COMMON.md').write_text(common)
(O/'packets').mkdir(exist_ok=True)
for t in tasks:
 text=f"# {t['id']} — {t['title']}\n\n[Общий контекст](../COMMON.md) · [План](../index.md#plan)\n\n"+tree_md(t)
 refs=[(r,source_link(r)) for r in t['context_files'] if isinstance(r,str)]
 text+='\n\n## Исходники исследованной ревизии\n\n'+'\n'.join(f'- [{r}]({u})' for r,u in refs if u)+'\n'
 (O/'packets'/f"{t['id']}.md").write_text(text)

for node in nodes:
 nid=node['id'];p=parts.get(nid);parent=node.get('parent_milestone',nid)
 spec=specs.get(nid) or specs.get(parent) or specs.get(p.get('parent') if p else '')
 assert spec,nid
 overlaps=[t['id'] for t in tasks if re.search(r'(?<![A-Za-z0-9])'+re.escape(nid)+r'(?![A-Za-z0-9])',json.dumps(t,ensure_ascii=False))]
 state='retain-delivered-foundation' if nid in shipped or nid not in active else 'open-canonical-node'
 packet={'id':nid,'title':(p or spec).get('title',nid),'baseline':SHA,'audit_disposition':state,'delivery_receipt':queue_rows[nid],'delivery_source':f'docs/evidence/backlog.md:{queue_lines[nid]}','corrective_packets':overlaps,'dependency_inputs':[e for e in catalog['dependency_edges'] if e['to']==nid],'activation_gates':spec.get('activation_gates',[]),'contract':p or spec,'execution_rule':'Read COMMON and corrective delta first. Existing mechanisms must be reused. This copied target contract is preserved for specificity; its historical status or absent-file rationale is not current delivery proof.'}
 packets.append(packet)
 (O/'packets'/f'{nid}.md').write_text(f"# {nid} — {packet['title']}\n\n[Общий контекст](../COMMON.md) · [Сводный план](../index.md#plan)\n\n"+tree_md(packet)+'\n')

LATE_SHA='8a0e9dbc17ac251e543b26653f64540a24ff0a8a'
late_catalog=json.loads(subprocess.check_output(['git','show',LATE_SHA+':docs/architecture/engineering-specs.json'],cwd=R,text=True))
late_spec=next(x for x in late_catalog['items'] if x['id']=='M199')
late_parts={x['id']:x for x in late_spec['parts']}
for node in late_catalog['execution_nodes']:
 if not node['id'].startswith('M199'):continue
 nid=node['id'];contract=late_parts.get(nid,late_spec)
 packet={'id':nid,'title':contract.get('title',nid),'baseline':LATE_SHA,'audit_disposition':'open-later-canonical-node','corrective_packets':['provider-auto-addendum'],'dependency_inputs':[e for e in late_catalog['dependency_edges'] if e['to']==nid],'contract':contract,'execution_rule':'Use this later M199 contract and provider-auto-addendum. M199 is an aggregate, its nine children are the execution work. Approved opt-in auto requirement supersedes the earlier no-auto exclusion; detailed policy defaults remain proposed. No runtime delivery claimed.'}
 packets.append(packet)
 (O/'packets'/f'{nid}.md').write_text(f"# {nid} — {packet['title']}\n\n[Общий контекст](../COMMON.md) · [Последняя сверка](../provider-auto-addendum.md)\n\n"+tree_md(packet)+'\n')

questions=[
('Auth provider','FA-07','Предлагается Supabase Auth, потому что persons.auth_user/RLS уже проектируют этот seam. Provider choice требует предметного design review; offline contract/fixtures готовы к работе без credentials.'),
('Invite transport','FA-07','Сначала signed/scoped invite + same-invite return; email как adapter после выбора транспорта. Не смешивать token lifecycle с отправкой письма.'),
('Project visibility','FA-07','Сохранить явно estate-wide v1. Per-project ACL — отдельная смена scope/ADR, сейчас не блокирует single-estate pilot.'),
('macOS runner/signing','FA-01','Unsigned reproducible artifact и Linux checks делать сейчас; signing/notarization только на указанном runner с существующими credentials.'),
('Toolchain lock','FA-01','Фиксировать проверяемые tool versions/digests вместе с первой fresh+upgrade матрицей; до этого null честно, но не завершённая поставка.'),
('Second real runner','FA-09','Fixture без платных вызовов сейчас; owner выбирает runner, test resource и budget перед paid activation. Не изобретать сумму.'),
('Manager admission owner','M194','Named accountable operator принимает профиль после независимого eval; сам manager не утверждает свой допуск/повышение.'),
('ModelPort first provider/key','M167','ModelPort nullable; первый provider через существующий capability/account contract. Ключ только на доверенной стороне/gateway по правилам апстрима; OAuth не проксировать вопреки metadata.'),
('Failover budget','M169','Один AttemptBudget на invocation; попытки всех providers, timeouts и unknown usage входят в него. Значение лимита — recorded operator policy, не константа, угаданная агентом.'),
('Recurrence threshold N','M184','Считать unique verified occurrences, сохранить provenance и regression window. Порог policy-configured, не hardcode неподтверждённого N; критерий escalation отдельно от auto-fix.'),
('superseded_by vs MemoryRevisionDTO','M191','Сохранить semantic lineage через superseded_by; revision DTO нужен для точного исторического содержания/pack, одно не заменяет другое. Reuse M182 категории/occurrence IDs.'),
('Rename S11','S11','Отложить механическое переименование до review границ бренда по ADR-0018. Не менять wire IDs, old events и public links массовым replace.'),
('Screen order','UX28-02','Сначала saved work/Board/error states, затем Inbox и cycles, pack provenance, затем graph families по готовности producer. Не ждать весь manager для read-only views.'),
('First effect provider','FA-09','Выбрать одну реальную операцию на ограниченном test target. Общий dispatcher без consumer убрать из ближайшей очереди, контракт и активационный gate оставить.'),
('Backup archive/fencing','FA-06','Отдельный archive manifest, detached restore и generation; место/retention требует policy выбора. Mirror не переименовывать в backup.'),
('Queue script in Git','FA-05','Да: parser/alias/DAG/ready integrity с negative fixtures. Исправление scratchpad не является воспроизводимой поставкой.'),
('Retro on queue failure','FA-10','Да: dated entry с фактическим report/source и тестом alias bug; historical cause не выдавать за наблюдённый в этом run scratchpad.'),
]

provider_delta=json.loads((O/'provider-addendum.json').read_text())
auto_delta=json.loads((O/'provider-auto-addendum.json').read_text())
counts['all_scenarios_with_later_deltas']=89
counts['catalog_packets']=len(packets)
out={'provider_auto_addendum':auto_delta,'later_source_commit':LATE_SHA,'provider_addendum':provider_delta,'schema':'fabric.final-audit.v1','date':'2026-09-09','source_commit':SHA,'status':'audit-and-proposed-plan; no product fixes','counts':counts,'scope':['UX','UI','interfaces','agents','harness','data','interaction','documentation','delivery'],'scenarios':scenarios,'remediation_tasks':tasks,'canonical_packets':[{k:p[k] for k in ['id','title','baseline','audit_disposition','corrective_packets','dependency_inputs']} for p in packets],'old_findings':old_disposition,'carryover':co,'milestones':milestones,'questions':[{'number':i+1,'question':q,'owner':o,'decision_proposal':a} for i,(q,o,a) in enumerate(questions)],'cross_batch':{'merges':merges,'rulings':['UX28-02 owns common freshness/scope; per-query contracts remain child work.','FA-02 owns admission/run/continuation/chain seam; no duplicated task_runs implementation.','Liveness widget HAS multiline renderer caller; initial absence hypothesis withdrawn. memory.preview and tasks.startExisting have no renderer caller in baseline; exact past pack is separately absent.','FAIL on target future flow does not mean regression of a shipped flow. BLOCKED means not executed/not observable.','No blanket PASS from pure tests or mockup completeness.']},'blind_spots':['Production incidence, real-user analytics and financial consequence not measured.','Full DB suite not rerun on operator shared local stack; role/replay/crash safety requires a disposable environment.','Installed native app was not running; audit did not start background routines merely to inspect UI. Native keyboard/screen reader/full viewport suite remains unverified.','No new paid real-runner trial, external effect or auth/invite rollout.','Private report release is verified separately from Fabric runtime; publication does not certify product capability.','claude-mem quota failure in prior report is machine-local historical evidence, not a new Fabric defect; quota not re-read.'],'related_repositories':[{'repository':'fabric-agent-contract','commit':'1eeb5a302518a25af4c3ef82f1942aa3288bc9b9','status':'read-only normative dependency; no branch delivered'},{'repository':'fabric-agent-adapter','commit':'5d2ccd7a124d7052f743529d8dcf0caf294bfdfd','status':'read-only adjacent checkout; no branch delivered'}]}
dump(O/'index.json',out);dump(O/'carryover.json',co);dump(O/'milestones.json',milestones)
for f in ['ci-history.json','ci-baseline-jobs.json','workspace-baseline-jobs.json','registers.log','runtime-probes.mjs','runtime-probes.log','runtime-receipt.json','cold_manifest-receipt.json','cold-manifest.log','scenarios-050-078-reproduction.txt','reader-probes.test.tsx','reader-probes.log','reader-probes-README.md','vitest.config.mjs','reproduce-slice.mjs','signature.txt']:
 if (E/f).exists() and E!=O:shutil.copy2(E/f,O/f)

intro=f'''# Fabric — финальный аудит и пакеты исполнения · 2026-09-09

{(E/'signature.txt').read_text().splitlines()[0]}

**Главный вывод:** основания заметно продвинулись, но завершённость внутренних механизмов опережает их сквозное подключение. Аудит привязан к `{SHA}`. Последний входной отчёт — [очередь 9 сентября](../../reports/2026-09-09-queue-progress-report.html); глубокий исходный снимок — [7 сентября](../2026-09-07-deep-audit.md).

Проверены {counts['scenarios']} сценариев, сопоставлены {counts['old_findings']} прежние находки, {counts['queue_nodes']} узел основной очереди и четыре ранее поставленных основания. В пакете {counts['remediation_packets']} подробных корректирующих/активационных записей и {len(packets)} карточек существующего каталога. Это разные измерения одного плана, их нельзя складывать как число независимых проектов.

По реестру: 44/61 shipped, 17 open; это **статусы записанных подмножеств**, не 72% готовности продукта. Сценарные вердикты: `{json.dumps(counts['scenario_verdicts'],ensure_ascii=False)}`. Итог UX: REFINE для работающих поверхностей и NEW/implementation для отсутствующих целевых потоков; оснований для тотального визуального переписывания нет.

**Начать исполнение:** [COMMON](COMMON.md), затем [FA-01](packets/FA-01.md) в build lane и [UX28-01](packets/UX28-01.md) в независимой lane сохранности. Для unattended activation первыми [FA-03](packets/FA-03.md), [FA-04](packets/FA-04.md), затем [FA-02](packets/FA-02.md). Они защищают Project как долговечную единицу, наблюдаемую историю и явные границы действия — vision principles 1–4; новые agent-chat surfaces не добавляются.

## Последнее уточнение: автоматическая смена аккаунтов

[Аудит новой дельты](provider-auto-addendum.md) закреплён на `8a0e9dbc17ac251e543b26653f64540a24ff0a8a`: ещё SCN-088/089 и девять частей M199. Требование opt-in auto принято оператором в ADR-0052; детали/defaults proposed. Раннее исключение auto больше не действует. В каталоге ниже сохранены M199-агрегат и все девять дочерних контрактов. Новые fixture defects переданы M199.ui/auto/resume с негативными проверками; runtime не изменён. Общий охват: 80 baseline + 7 account + 2 auto = 89 сценариев.

## Более поздний дизайн аккаунтов

После основного среза проверен [provider addendum](provider-addendum.md), source `25026daef6dc1829581ca9fe1f68495761dfd1cf`: ещё семь SCN-081–087, M199/CO-112 и существующие PA-01–06. Runtime не изменился; все семь runtime paths BLOCKED до реализации/наблюдения. ADR-0051 остаётся proposed. Три delta-пакета уточняют контракт, отсутствующие состояния макета и сохранение источников; ADD-PA-03 выполнен интеграцией этого отчёта. Исходный queue report сохранён.

## Что действительно проверено

- Локальный исходный checkout: `bash scripts/ci.sh fast` прошёл; full DB tier не запускался. Свежий isolated checkout reproduces manifest ENOENT; после явной подготовки пустого `apps/desktop/resources` fast прошёл. Подготовка не является исправлением cold-build defect.
- CI: {len(history)} последних runs, `{json.dumps(counts['ci_conclusions'])}`. На baseline [fast](https://github.com/passioncode-ai/fabric/actions/runs/34364871647) падает в build-manifest, full skipped. [workspace](https://github.com/passioncode-ai/fabric/actions/runs/34364871632) падает на stale source receipt. Это не выборка release runs, поэтому release failure rate не вычисляется.
- Без DB/agent effects воспроизведены duplicate chain launch и malformed quota allowance: [проба](runtime-probes.mjs), [вывод](runtime-probes.log).
- На настоящих React-компонентах воспроизведены wrong-task brief save и digest read mark on refresh: [пробы](reader-probes.test.tsx), [вывод](reader-probes.log), [запуск](reader-probes-README.md).
- Liveness: различающиеся caller inputs воспроизведены через фактический pure derivation: [вывод](scenarios-050-078-reproduction.txt). Это доказывает неправильные входные данные, не частоту false alarms у пользователей.
- Реестры: [команда и фактическая арифметика](registers.log). Повторный независимый подсчёт по anchored queue даёт 44 shipped / 61 active; по catalog execution_nodes — 65 включая DONE 4. Независимый разбор CO обнаружил дефект gate: 81 open вместо 79 — cell() делит escaped pipes в CO-050/CO-060; FA-05 включает исправление парсера.
- Ограничения: не запускались production agents, full shared DB suite, реальные paid trials, внешние effects и authentication; native app/screen reader/zoom acceptance не сертифицированы. Их отсутствие измерения вынесено в конкретные activation packets.

## Отсев и уточнение старого отчёта

Не брать заново: исправленные scope predicates, atomic reservation/answer, shell hook floor, replay revisions, sandbox, redaction, transport trace и eval corpus. Их текущие остатки сохраняются отдельно. Не удалять auth, backup, native enforcement и manager лишь потому, что тест pure function зелёный. Не строить абстрактный effect dispatcher без provider, не делать ребрендинг prerequisite для безопасности, не чинить чужой публичный npm `fabric` (наш manifest private).

`closed-subset` ниже означает, что старое конкретное описание отсутствия больше не верно и foundation существует. Это не новая полная runtime certification. Проверяемые current receipts находятся в карточках и сценарных батчах.

| Старый ID | Решение | Owner | Основание |
|---|---|---|---|
'''
for x in old_disposition:intro+=f"| {x['id']} | {x['disposition']} | {x['owner']} | {x['reason']} |\n"
intro+='''
<a id="plan"></a>
## Общий план исполнения

1. **Доказуемость и сохранность сейчас:** FA-01, FA-05, UX28-01/03/04. Независимые lanes, не общий waterfall.
2. **Безопасное исполнение:** FA-03 + FA-04 → FA-02; привязать run/session/ack/close, полное множество blockers и follows. Вернуть типизированные отказы в UI.
3. **Честное чтение и интерфейсы:** UX28-02/05/06/09/11, затем живые Inbox/cycles/pack/graph потребители; minimum cursor и scoped source quality сохраняются на каждой границе.
4. **Менеджер без магии:** M153 + M158 → M157/M184/M166; M183.local отдельно. M166 → M167 → M169 + M171; M194 после core, M175 после router/usage/binding. M176 остаётся обязательной проверкой до activation, а не поводом переписать готовый corpus.
5. **Команда и восстановление:** FA-07 и FA-06 проектируются сейчас; rollout после role/revoke/restore probes. Внешний pilot FA-09 требует выбранного provider, ресурса и бюджета.
6. **Качество и горизонт:** FA-08 и UX28-14 по измеренному bottleneck, RU/EN в каждой UI задаче. S11 только после brand decision. Foundry, external MCP, connectors, support/content и Telegram сохраняют свои existing owners и explicit activation gates, не теряются и не маскируются generic manager.

P0 здесь означает блокер включения соответствующей автономии, а не доказанный production incident. P1 — сохранность/доверие/сквозной путь; P2 — управляемое качество. Оценки длительности не выдуманы: исполнитель оценивает после failing baseline и подтверждения локального delta. Неснятый внешний gate не мешает чистому контракту/fixtures.

## Корректирующие пакеты

Каждая строка открывает context, решение, точные точки чтения, шаги, positive/negative acceptance, зависимости и запреты. Поля на английском оставлены там, где это точная терминология существующих агентных контрактов.

| ID | Приоритет | Задача | Owner |
|---|---|---|---|
'''
for t in tasks:intro+=f"| [{t['id']}](packets/{t['id']}.md) | {t.get('priority','by activation')} | {t['title']} | {str(t.get('owner','')).replace('|','/')} |\n"
intro+='\n## Каждая существующая карточка: сохранить основание или доделать остаток\n\n'
for p in packets:intro+=f"- [{p['id']} — {p['title']}](packets/{p['id']}.md) · {p['audit_disposition']} · delta: {', '.join(p['corrective_packets']) or 'контракт/приёмка в карточке; foundation не переписывать'}\n"
intro+='\n## Все вопросы последнего отчёта\n\n| № | Вопрос | Решение для плана / gate | Owner |\n|---|---|---|---|\n'
for i,(q,o,a) in enumerate(questions,1):intro+=f'| {i} | {q} | {a} | {o} |\n'
intro+='''
## Полнота, границы и передача

- [SCN-001–027](scenarios-001-027.md), [SCN-028–049](scenarios-028-049.md), [SCN-050–078](scenarios-050-078.md): каждый сценарий с verdict и file:line.
- [Carry-over inventory](carryover.json): все 111 исходных CO rows, включая 81 open при корректном разборе escaped pipes; старый gate пишет 79, теряя CO-050/CO-060; historical external estate debts не объявлены новыми дефектами Fabric. [Milestones](milestones.json): все 196, с исходным владельцем и статусом.
- [Машинный индекс](index.json): baseline, зависимости, пакеты, вопросы, ограничения, cross-batch adjudication и owner repositories.
- [COMMON](COMMON.md): инварианты и протокол для каждого агента. [Handoff](../../evidence/plans/2026-09-09-final-audit.md): единственный entry point следующего исполнителя.

Нельзя гарантировать, что агент не ошибётся. Этот пакет делает ошибку обнаруживаемой: baseline, named contract, ограниченный diff, отрицательная проба, независимый consumer check и явный activation gate. Непроверенное не объявлено закрытым.
'''
intro+='\n'+(E/'signature.txt').read_text().split('\n---\n',1)[-1]
(O/'index.md').write_text(intro)

# Self-contained HTML: all findings and packets are readable without JavaScript.
def h(x):return html.escape(str(x))
def render(x):
 if isinstance(x,dict):return ''.join('<h4>'+h(k)+'</h4>'+render(v) for k,v in x.items())
 if isinstance(x,list):return '<ul>'+''.join('<li>'+render(v)+'</li>' for v in x)+'</ul>'
 s=str(x);u=source_link(s)
 return '<p>'+('<a href="'+h(u)+'">'+h(s)+'</a>' if u else h(s))+'</p>'
page='''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fabric — финальный аудит 09.09.2026</title><style>
:root{color-scheme:light;--ink:#202621;--muted:#53605a;--line:#ccd5cd;--paper:#f5f7f4;--accent:#185c3c}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 system-ui,sans-serif}main{max-width:1120px;margin:auto;padding:32px 24px 80px}h1{font-size:clamp(28px,5vw,48px);line-height:1.1;letter-spacing:-.035em}h2{margin-top:48px;padding-top:16px;border-top:2px solid var(--line)}h3,h4{margin-bottom:6px}p{margin:8px 0}a{color:var(--accent);text-underline-offset:3px}nav{display:flex;gap:18px;flex-wrap:wrap;margin:22px 0}summary{cursor:pointer;font-weight:650;padding:14px}details{border:1px solid var(--line);border-radius:8px;background:white;margin:12px 0}details>div{padding:0 20px 22px}input,select{font:inherit;padding:10px;border:1px solid var(--line);border-radius:6px}input{width:min(100%,600px)}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.stat{padding:18px;border:1px solid var(--line);background:white;border-radius:8px}.stat b{display:block;font-size:28px}.muted{color:var(--muted)}.callout{padding:20px;border-left:4px solid var(--accent);background:#e8f0e7}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;vertical-align:top;border-bottom:1px solid var(--line);padding:10px}td{min-width:110px}code,pre{overflow-wrap:anywhere;white-space:pre-wrap}li,p{overflow-wrap:anywhere}a:focus-visible,summary:focus-visible,input:focus-visible{outline:3px solid #a45400;outline-offset:3px}[hidden]{display:none!important}@media(max-width:600px){main{padding:20px 14px}details>div{padding:0 12px 16px}}
</style><main><p class="muted">ssheleg skills · доказательный аудит · 9 сентября 2026</p><h1>Основания построены.<br>Теперь замкнуть пути.</h1><p>Fabric · исходники <code>'''+SHA[:12]+'''</code> · продукт не изменён этим аудитом.</p><nav><a href="#verdict">Вывод</a><a href="#plan">Порядок работы</a><a href="#tasks">Пакеты</a><a href="#scenarios">Сценарии</a><a href="#history">Отсев старого</a><a href="#questions">Решения</a><a href="#limits">Ограничения</a><a href="index.md">Полный Markdown</a></nav>'''
page+='<section class="stats">'+''.join('<div class="stat"><b>'+h(n)+'</b>'+h(s)+'</div>' for n,s in [(counts['all_scenarios_with_later_deltas'],'сценариев: 80 исходных + 9 новых'),(43,'старые находки сопоставлены'),('44 / 61','claimed shipped, не готовность продукта'),(len(tasks),'корректирующих пакетов')])+'</section>'
page+='<h2 id="verdict">Главный вывод</h2><div class="callout">Готовые модели и защитные механизмы не гарантируют работающий пользовательский путь. Сначала сохранить ввод, закрыть обходы admission и вернуть честные результаты чтения. Затем подключать Inbox, циклы, память и manager.</div><p>Воспроизведены: сохранение brief не в ту задачу; преждевременная отметка digest; повторный запуск chain; разрешение unattended по неполной квоте; ложные состояния liveness из неполных входов. Свежий CI падает на manifest ENOENT.</p>'
page+='<h2 id="plan">Порядок и параллельные lanes</h2><ol><li>Build/CI и saved work — независимо: FA-01, UX28-01/03/04. FA-05 чинит проверяемость очереди.</li><li>Authority/DAG → admission/run/ack/closure: FA-03 + FA-04 → FA-02.</li><li>Scoped reads → существующие поверхности → Inbox/cycles/pack → graph families по готовности producer.</li><li>M153 + M158 → M166 → optional ModelPort → router/usage + binding → M175. Local retro не ждёт outbound endpoint.</li><li>Identity, backup и bounded real-runner pilot — каждый со своим activation gate.</li><li>Performance, a11y, RU/EN и disclosure — по измеренному bottleneck; brand rename отдельное решение.</li></ol><p><a href="COMMON.md">Общие контракты и правила исполнения</a> · <a href="../../evidence/plans/2026-09-09-final-audit.md">Handoff следующему агенту</a></p>'
page+='<h2 id="tasks">Пакеты задач</h2><label for="search">Найти ID, проблему, файл или owner</label><br><input id="search" type="search" placeholder="Например: TaskRun, backup, M153"><p id="result" aria-live="polite"></p>'
for t in tasks:page+=f'<details class="packet" id="task-{h(t["id"])}"><summary>{h(t["id"])} · {h(t.get("priority","activation"))} · {h(t["title"])}</summary><div><p><a href="packets/{h(t["id"])}.md">Отдельный packet</a></p>'+render(t)+'</div></details>'
page+='<h3>Все существующие узлы каталога</h3><p>Здесь сохранён точный целевой контракт каждой карточки и текущий delta. Историческое proposed внутри контракта не доказывает отсутствие реализации.</p>'
for p in packets:page+=f'<details class="packet" id="task-{h(p["id"])}"><summary>{h(p["id"])} · {h(p["title"])} · {h(p["audit_disposition"])}</summary><div><a href="packets/{h(p["id"])}.md">Packet</a>'+render(p)+'</div></details>'
page+='<h2 id="scenarios">Каждый сценарий</h2><p>'+h(counts['scenario_verdicts'])+'</p>'
for s in scenarios:page+=f'<details><summary>{h(s["id"])} · {h(s["verdict"])} · {h(s.get("title",""))}</summary><div>'+render(s)+'</div></details>'
page+='<h2 id="history">Что взять, сузить, объединить</h2><p>Исправленные основания не разрабатываем повторно; неустранённые consumer gaps сохраняем. False positive npm fabric и тестовые redaction literals исключены из продуктового плана.</p><div class="scroll"><table><tr><th>ID</th><th>Решение</th><th>Owner</th><th>Почему</th></tr>'
for x in old_disposition:page+='<tr>'+''.join('<td>'+h(x[k])+'</td>' for k in ['id','disposition','owner','reason'])+'</tr>'
page+='</table></div><p><a href="carryover.json">Все исходные carry-over</a> · <a href="milestones.json">Все исходные milestones</a></p><h2 id="questions">17 вопросов последнего отчёта</h2>'
for i,(q,o,a) in enumerate(questions,1):page+=f'<details><summary>{i}. {h(q)} · {h(o)}</summary><div><p>{h(a)}</p></div></details>'
page+='<h2 id="provider-auto-addendum">Последнее уточнение: auto, ещё 2 сценария</h2><p><a href="provider-auto-addendum.md">SCN-088/089: аудит автоматической смены</a>. Требование opt-in auto принято оператором, детали предложены в ADR-0052. M199 и девять частей сохранены выше. Итого охвачены 89 сценариев, без сертификации native runtime. Раннее исключение auto заменено последующим решением.</p>'
page+='<h2 id="provider-addendum">Поздний дизайн аккаунтов: ещё 7 сценариев</h2><p><a href="provider-addendum.md">Детальная проверка SCN-081–087 и delta-пакеты</a> · <a href="../../evidence/plans/2026-09-09-provider-accounts.md#packets">Существующие PA-01–06</a>. M199/CO-112 сохранены, ADR-0051 proposed. Семь runtime paths BLOCKED: дизайн не реализует login/switch. Отдельно воспроизведён пустой selector с активной кнопкой без эффекта в target fixture.</p>'
page+='<h2 id="limits">Доказательства и ограничения</h2>'+render(out['blind_spots'])+'<p>Latest CI sample: '+h(counts['ci_conclusions'])+'. Full shared DB suite в этом аудите не запускалась. Cold manifest failure воспроизведён; fast passed только после явной подготовки resources. Полный native UX/a11y остаётся acceptance work.</p><p><a href="runtime-probes.log">Runtime probes</a> · <a href="reader-probes.log">React probes</a> · <a href="ci-history.json">CI history</a> · <a href="index.json">Машинный индекс</a></p><footer><p>Made with <a href="https://github.com/ssheleg/sshlg-skills">ssheleg skills</a>. Точное применение skills: <a href="signature.txt">полный список</a>. Никакая карточка не обещает отсутствие всех возможных ошибок.</p></footer></main><script>const input=document.querySelector("#search"),packets=[...document.querySelectorAll(".packet")],result=document.querySelector("#result");function filter(){let n=0;const q=input.value.toLocaleLowerCase();for(const p of packets){p.hidden=!p.textContent.toLocaleLowerCase().includes(q);if(!p.hidden)n++}result.textContent=`Показано ${n} из ${packets.length} карточек`}input.addEventListener("input",filter);filter();if(location.hash.startsWith("#task-")){const t=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(t)t.open=true}</script></html>'
(O/'index.html').write_text(page)

# Rebase links embedded in inherited backlog receipts from their original homes.
import os
for packet_file in (O/'packets').glob('*.md'):
 def rebase_link(match):
  target=match[1]
  if target.startswith(('http:','https:','#')):return match[0]
  name,sep,fragment=target.partition('#')
  if (packet_file.parent/name).exists():return match[0]
  candidates={p.resolve() for p in [R/'docs/evidence'/name,R/'docs/architecture'/name,R/name] if p.exists()}
  if len(candidates)==1:
   return ']('+os.path.relpath(candidates.pop(),packet_file.parent.resolve())+(sep+fragment if sep else '')+')'
  return match[0]
 packet_file.write_text(re.sub(r'\]\(([^)]+)\)',rebase_link,packet_file.read_text()))

print(json.dumps(counts,ensure_ascii=False));print('ASSEMBLED',len(packets),'catalog packets +',len(tasks),'remediation packets')
