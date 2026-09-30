from pathlib import Path
import json,re,hashlib
from html.parser import HTMLParser
r=Path(__file__).resolve().parents[4];p=json.loads((r/'docs/evidence/plans/2026-09-07-foundation-priorities.json').read_text());a=json.loads((r/p['source_snapshot']).read_text())
assert hashlib.sha256((r/p['source_snapshot']).read_bytes()).hexdigest()==p['source_snapshot_sha256']
n={x['id']:x for x in p['execution_nodes']};assert len(n)==len(p['execution_nodes'])
assert {x['parent_milestone'] for x in n.values()}=={x['id'] for x in a['items']}
seen=set()
while len(seen)<len(n):
 ready={k for k,v in n.items() if k not in seen and set(v['depends_on'])<=seen};assert ready;seen|=ready
b=(r/'docs/evidence/backlog.md').read_text();table=b.split('<!-- priority-nodes:begin -->')[1].split('<!-- priority-nodes:end -->')[0]
assert set(re.findall(r'\*\*((?:M|S)\d+(?:\.\w+)?)\*\*',table))==set(n)
for k,v in n.items():
 line=next(x for x in table.splitlines() if f'**{k}**' in x)
 actual=set(re.findall(r'\[((?:M|S)\d+(?:\.\w+)?)\]\(#work-',line));assert actual==set(v['depends_on']),(k,actual,v['depends_on'])
M=set(re.findall(r'^\| (M\d+) \|',b,re.M));focus={x['id'] for x in a['items'] if x['id'].startswith('M')}
restsection=b.split('### Remaining roadmap: accounted for, not silently dropped')[1].split('## Historical triage')[0]
rest=set(re.findall(r'\bM\d+\b',restsection))-focus
assert focus|rest==M,(M-focus-rest,rest-M)
CO=set(re.findall(r'^\| (CO-\d+) \|',(r/'docs/evidence/specs/2026-08-16-software-fabric-carryover.md').read_text(),re.M))
for x in p['mapping']:
 assert set(x['canonical_milestones'])<=M;assert set(x['existing_carryovers'])<=CO
class H(HTMLParser):
 def __init__(self):super().__init__();self.ids=[];self.links=[]
 def handle_starttag(self,tag,attrs):
  d=dict(attrs)
  if 'id' in d:self.ids.append(d['id'])
  if 'href' in d:self.links.append(d['href'])
mapparser=H();mapparser.feed((r/'docs/reports/map.html').read_text());report=H();report.feed((r/'docs/audit/2026-09-07-merged-execution-plan.html').read_text())
assert len(mapparser.ids)==len(set(mapparser.ids))
assert all('work-'+i.lower().replace('.','-') in mapparser.ids for i in n)
for link in mapparser.links:
 if '2026-09-07-merged-execution-plan.html#' in link:assert link.split('#')[1] in report.ids
for link in re.findall(r'\]\(([^)]+)\)',table):
 if '2026-09-07-merged-execution-plan.html#' in link:assert link.split('#')[1] in report.ids
result={'audit_source_head':a['source_head'],'execution_nodes':len(n),'edges':sum(len(x['depends_on']) for x in n.values()),'acyclic':True,'all_57_original_cards_preserved':len(a['items'])==57,'requirements_preserved':len(a['requirements']),'attachment_milestones_preserved':len(a['attachment']['milestone_ids']),'milestone_rows':len(M),'focus_milestones':len(focus),'remaining_milestones':len(rest),'canonical_owners_resolve':True,'queue_and_json_dependencies_equal':True,'map_work_anchors_resolve':True,'report_card_fragments_resolve':True,'product_implementation_claimed':False}
print(json.dumps(result,ensure_ascii=False,indent=2))
