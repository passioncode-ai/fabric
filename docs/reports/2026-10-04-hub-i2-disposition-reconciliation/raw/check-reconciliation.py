from pathlib import Path
import json,re,collections,subprocess
here=Path(__file__).resolve().parent; root=here.parents[3]
rows=json.loads((here/'dispositions.json').read_text()); originals=json.loads((here/'original-ledger-rows.json').read_text()); context=json.loads((here/'context.json').read_text());text=(here.parent/'README.md').read_text()
assert len(rows)==56 and len(originals)==56
assert [r['canonical_id'] for r in rows]==[f'V2-{n}' for n in range(1,57)]
assert [r['display_id'] for r in rows]==[f'V2-{n:02}' for n in range(1,57)]
assert len({r['source_id'] for r in rows})==56
assert collections.Counter(r['source_id'].split('-')[0] for r in rows)=={'UX':11,'ER':11,'DO':14,'DA':6,'PL':14}
assert re.findall(r'^\| (V2-\d+) / ',text,re.M)==[r['display_id'] for r in rows]
for r,o in zip(rows,originals):
 for key in ['canonical_id','source_id','original_finding']:assert r[key]==o[key]
 assert all(r.get(k) for k in ['owner','state','receipt_and_remaining_action'])
 assert len(r['receipt_and_remaining_action'])>65
for kind,rev in context['i3_reports'].items():
 assert subprocess.run(['git','-C',str(root),'cat-file','-e',f'{rev}:docs/reports/2026-10-04-hub-i3-{kind}/README.md'],capture_output=True).returncode==0
links=re.findall(r'\]\(([^)]+)\)',text);relative=[]
for target in links:
 if re.match(r'^\w+://',target) or target.startswith('#'):continue
 path=target.split('#')[0]; assert (here.parent/path).exists(),target;relative.append(target)
assert context['guarded_edits_by_reporter']==[]
print(f'PASS:56 unique ordered rows (UX11 ER11 DO14 DA6 PL14),original finding retention,all receipts/owners/states,5 immutable report objects,{len(relative)} local links,guarded edits none')
print('Evidence states:',dict(collections.Counter(r['state'] for r in rows)))
