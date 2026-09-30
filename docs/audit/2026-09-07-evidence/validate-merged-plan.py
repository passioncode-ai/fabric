#!/usr/bin/env python3
"""Validate the audit's plan coverage, dependencies and materialised source links.

No product state is written and no future acceptance fixture is executed.
Run: python3 docs/audit/2026-09-07-evidence/validate-merged-plan.py
"""
from pathlib import Path
from collections import Counter, defaultdict, deque
from html.parser import HTMLParser
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'docs/audit'
PREFIX = '2026-09-07-merged-execution-plan'
p = json.loads((OUT / (PREFIX + '.json')).read_text())
errors = []
cards = {x['id']: x for x in p['items']}
nodes = {x['id']: x for x in p['execution_nodes']}
expected_m = {f'M{i}' for i in [195,196,197,97,109,98,102,105,177,178,179,180,181,155,182,183,188,149,151,152,153,154,184,173,157,158,185,186,189,190,191,194]}
attachment = OUT / '2026-09-07-evidence/provided-layered-plan.txt'
assert hashlib.sha256(attachment.read_bytes()).hexdigest() == p['attachment']['sha256']
parsed_m = set()
for first,last in re.findall(r'M(\d+)(?:[–—-](?:M)?(\d+))?',attachment.read_text()):
    parsed_m.update(f'M{i}' for i in range(int(first), int(last or first)+1))
assert parsed_m == expected_m, 'Attachment milestone extraction differs'
assert expected_m == set(p['attachment']['milestone_ids'])
assert expected_m <= set(cards)
assert set(p['previous_plan_map']) == {f'W{i:02d}' for i in range(1,32)}
assert all(p['previous_plan_map'].values())
assert all(set(r['work']) <= set(cards) and r['work'] for r in p['requirements'])
assert len({r['id'] for r in p['requirements']}) == len(p['requirements'])
assert len(cards) == len(p['items']) and len(nodes) == len(p['execution_nodes'])
assert all(all(x[k] for k in ['title','why','work','visible','acceptance']) for x in p['items'])
incoming = {n:0 for n in nodes}
children = defaultdict(list)
for e in p['edges']:
    assert e['from'] in nodes and e['to'] in nodes
    incoming[e['to']] += 1
    children[e['from']].append(e['to'])
queue = deque(n for n,v in incoming.items() if not v)
visited = []
while queue:
    n=queue.popleft(); visited.append(n)
    for child in children[n]:
        incoming[child]-=1
        if not incoming[child]:queue.append(child)
assert len(visited) == len(nodes), 'execution DAG is cyclic'
assert set(cards['M191']['depends_on']) == {'S14'}, 'memory preview acquired artificial full-track dependency'
assert 'M158' in cards['M157']['depends_on'] and 'M168' in cards['M157']['depends_on']
assert 'S15' in cards['M184']['depends_on'], 'retro has no durable cycle foundation'
assert 'M183.local' in nodes and 'M183.upstream' in nodes
assert nodes['M183.upstream']['external_gates']
assert p['brand'] == {'parent':'PassionCode.ai','product':'Fabric','confirmed_by':'user 2026-09-07'}
head = subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
assert head == p['source_head']
assert subprocess.check_output(['git','diff','--name-only'],cwd=ROOT,text=True).strip() == ''
assert subprocess.check_output(['git','diff','--cached','--name-only'],cwd=ROOT,text=True).strip() == ''
mds = [OUT/(PREFIX+'.md')] + sorted(OUT.glob('2026-09-07-merge-*.md'))
source_refs = set()
for file in mds:
    text=file.read_text()
    assert 'PasionCOde' not in text
    for path,line in re.findall(r'\(([^\s)]+):(\d+)\)',text):
        source=Path(path);line=int(line);source_refs.add((path,line))
        if not source.is_file():errors.append(f'{file.name}: missing {source}')
        elif line < 1 or line > len(source.read_text().splitlines()):errors.append(f'{source}: bad line {line}')
    for relative in re.findall(r'\]\((2026-09-07-[^\s)#]+)\)',text):
        if not (OUT/relative).exists():errors.append(f'missing audit artifact {relative}')

class Page(HTMLParser):
    def __init__(self):super().__init__();self.ids=[];self.anchors=[];self.abs_source_links=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if tag=='a':
            href=a.get('href','')
            if href.startswith('#'):self.anchors.append(href[1:])
            if href.startswith('/Users/') and re.search(r':\d+$',href):self.abs_source_links.append(href)
page=Page();page.feed((OUT/(PREFIX+'.html')).read_text())
errors.extend('duplicate HTML id '+x for x,n in Counter(page.ids).items() if n>1)
errors.extend('missing HTML anchor '+x for x in page.anchors if x not in set(page.ids))
errors.extend('HTTP preview source link is not bundled: '+x for x in page.abs_source_links)
assert not errors, '\n'.join(errors)
files=[OUT/(PREFIX+ext) for ext in ['.md','.json','.html']]+mds[1:]
result={'source_head':head,'code_or_canonical_diff':False,'attachment_milestones':len(expected_m),'previous_blocks':len(p['previous_plan_map']),'requirements':len(p['requirements']),'work_cards':len(cards),'execution_nodes':len(nodes),'edges':len(p['edges']),'dag_acyclic':True,'resolved_source_file_line_refs':len(source_refs),'html_internal_links_resolve':True,'semantic_dependency_checks':'passed','future_implementation_tests_executed':False,'artifacts':{str(f.relative_to(ROOT)):{'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in files}}
(OUT/'2026-09-07-evidence/merged-plan-validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='artifacts'},ensure_ascii=False,indent=2))
