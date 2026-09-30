"""Check the bounded audit deliverable, not Fabric runtime health."""
import json,pathlib,re,subprocess
root=pathlib.Path(__file__).resolve().parents[3]
here=pathlib.Path(__file__).resolve().parent
d=json.loads((here/'index.json').read_text())
assert f"<b>{d['counts']['all_scenarios_with_later_deltas']}</b>сценариев: 80 исходных + 9 новых" in (here/'index.html').read_text()
ids=[x['id'] for x in d['scenarios']]
source_scenarios=subprocess.check_output(['git','show',d['source_commit']+':docs/ux/scenarios.md'],cwd=root,text=True)
assert set(ids)==set(re.findall(r'^### (SCN-\d+):',source_scenarios,re.M)), 'Heading inventory differs from audit'
assert {x['id'] for x in d['provider_addendum']['scenarios']}=={f'SCN-{i:03}' for i in range(81,88)}
assert len(ids)==len(set(ids))==80
assert set(ids)=={f'SCN-{i:03}' for i in range(1,81)}
assert len(d['old_findings'])==43
assert len({x['id'] for x in d['carryover']})==111
assert len({x['id'] for x in d['milestones']})==196
assert len(d['questions'])==17
catalog=json.loads(subprocess.check_output(['git','show',d['source_commit']+':docs/architecture/engineering-specs.json'],cwd=root,text=True))
assert {x['id'] for x in d['canonical_packets'] if x['baseline']==d['source_commit']}=={x['id'] for x in catalog['execution_nodes']}
latest=json.loads(subprocess.check_output(['git','show',d['later_source_commit']+':docs/architecture/engineering-specs.json'],cwd=root,text=True))
assert {x['id'] for x in d['canonical_packets']}=={x['id'] for x in latest['execution_nodes']}
assert {x['id'] for x in d['provider_auto_addendum']['scenarios']}=={'SCN-088','SCN-089'}
all_ids={x['id'] for x in d['canonical_packets']+d['remediation_tasks']}
for item in d['canonical_packets']+d['remediation_tasks']:
 assert (here/'packets'/f"{item['id']}.md").is_file(),item['id']
for item in d['remediation_tasks']:
 assert item['context_files'],('missing files',item['id'])
 assert item['solution_steps'],('missing decomposition',item['id'])
 assert item['positive_acceptance'],('missing acceptance',item['id'])
 if item.get('execution_owner'):assert item['execution_owner'] in all_ids
remediation={x['id']:x for x in d['remediation_tasks']}
seen=set();visiting=set()
def visit(node):
 assert node not in visiting,('dependency cycle',node)
 if node in seen:return
 visiting.add(node)
 for dep in remediation[node]['execution_dependencies']:
  assert dep in remediation,('unknown dependency',node,dep)
  visit(dep)
 visiting.remove(node);seen.add(node)
for node,item in remediation.items():
 assert item['negative_acceptance'],('missing negative acceptance',node)
 visit(node)
print('PASS: corrective execution graph has no cycles or unknown IDs; all 59 packets have negative acceptance.')
links=0
for file in here.rglob('*.md'):
 for target in re.findall(r'\]\(([^)]+)\)',file.read_text()):
  if target.startswith(('http:','https:','#')):continue
  p=target.split('#')[0]
  if not p:continue
  assert (file.parent/p).exists(),(str(file),p)
  links+=1
print(f"PASS: 80 baseline scenarios + 9 later provider scenarios, 43 old findings, 111 CO, 196 M, 17 questions, {len(d['remediation_tasks'])} remediation packets, 75 catalog packets; {links} local links resolve")
print('Limits: structural coverage only; no runtime, semantic source-line or production completeness certification.')
