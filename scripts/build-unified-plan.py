#!/usr/bin/env python3
# #region unified-plan-compiler — docs: docs/reports/2026-10-04-unified-execution/protocol.md#recovery-and-source-change
"""Compile the dated research cut; never infer implementation completion."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / 'docs/reports/2026-10-04-unified-execution'


def load(p):
    return json.loads(p.read_text())


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def array(value):
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def priority(ids, lane):
    if 'P-08' in ids or lane == 2 or 'CO-179' in ids:
        return 0
    if any(x.startswith('N1') for x in ids):
        return 1
    if any(x.startswith(('P-06', 'P-07')) for x in ids):
        return 2
    return 10 + lane


def main():
    text = (ROOT / 'docs/evidence/backlog.md').read_text()
    section = text.split('<!-- general-plan:begin -->')[1].split('<!-- general-plan:end -->')[0]
    lanes = []
    for row in section.splitlines():
        if re.match(r'^\| \d+ ·', row):
            cells = [x.strip() for x in row.split('|')]
            lanes.append({'number': int(cells[1].split()[0]), 'canonical_ids': cells[-2].split(', ')})
    canonical = {x for l in lanes for x in l['canonical_ids']}
    tasks = []
    for name in ['release', 'start-adoption', 'agents-memory', 'reach-horizon']:
        data = load(REPORT / f'packets/{name}.json')
        rows = data.get('tasks', data.get('packets', []))
        if name == 'reach-horizon':
            rows += data['horizon_coverage']
        for raw in rows:
            if name == 'release':
                task = dict(raw)
                if task['dispatch'] == 'done':
                    p = REPORT / 'checks/execution.json'
                    task['evidence'] = {'path': p.relative_to(ROOT).as_posix(), 'sha256': sha(p)}
                tasks.append(task)
                continue
            tid = raw['id']
            cid = raw.get('canonical_id', tid)
            ids = [cid]
            # Child rows inherit an umbrella for coverage only, never its status.
            if cid not in canonical:
                parents = [x for x in canonical if cid.startswith(x + '.') or cid.startswith(x + '-')]
                if parents:
                    ids.append(max(parents, key=len))
            lane = raw['lane']
            sources = raw.get('canonical_sources', raw.get('source_paths', [x['path'] for x in raw.get('source_context', [])]))
            if not sources:
                sources = [re.sub(r':\d+$', '', raw.get('source', 'docs/evidence/backlog.md'))]
            sources = list(dict.fromkeys(sources + ['docs/evidence/backlog.md', 'docs/ux/vision.md']))
            steps = raw.get('implementation_steps', raw.get('steps', []))
            template = data.get('common_context', {}).get('horizon_packet_template', {})
            if name == 'reach-horizon' and raw.get('kind') == 'activation-and-design':
                steps = template['steps'] + steps
            validation = raw.get('validation_commands', raw.get('validation', []))
            acceptance = array(raw.get('definition_of_done', template.get('definition_of_done'))) + array(validation)
            risks = array(raw.get('failure_cases', raw.get('constraints_and_failure_modes', raw.get('failure_and_edge_cases'))))
            risks += array(raw.get('constraints', []))
            if raw.get('theme_contract_ref'):
                risks += array(data['theme_contracts'][raw['theme_contract_ref']])
            scope = raw.get('file_scope', raw.get('implementation_scope', raw.get('scope_files', [])))
            stops = array(raw.get('stop_conditions')) + ['Stop before implementation until a bounded leaf and upstream acceptance/authority are approved; a planning dependency is not a completion receipt.']
            task = {
                'id': tid, 'canonical_ids': list(dict.fromkeys(ids)), 'lane': lane,
                'title': raw.get('title', raw.get('objective', cid)), 'kind': 'activation-design' if lane == 12 else 'design-review',
                'dispatch': 'design-gated', 'priority_group': priority(ids, lane), 'depends_on': [],
                'external_dependencies': raw.get('dependencies', []),
                'context': {
                    'outcome': raw.get('objective', raw.get('title', cid)), 'sources': sources,
                    'scope': scope or ['docs/evidence/specs/2026-08-16-software-fabric-carryover.md'],
                    'steps': steps or ['Read exact canonical row and resolve the bounded remaining outcome before implementation.'],
                    'acceptance': acceptance or ['One source-bound leaf with exact positive/negative check and authority.'],
                    'risks': risks or ['Historical receipts may describe a superseded implementation; remeasure the current subject.'],
                    'stop_conditions': stops, 'resume': raw.get('resume', 'Read this packet and its pinned canonical sources; verify trigger, dependency receipts and authority; produce one bounded follow-on leaf before code.'),
                    'full_research_packet': raw,
                    'module_context': data.get('defaults', data.get('common_context', {})),
                    'research_artifact': f'docs/reports/2026-10-04-unified-execution/packets/{name}.json',
                    'implementation_readiness': 'Design is proposed. Do not infer implementation readiness or canonical completion from this planning record.',
                },
            }
            tasks.append(task)
    # Bounded activation leaves make the large remaining cards executable as design work.
    # The implementation parents remain held. Each leaf owns a separate dossier artifact.
    for parent in list(tasks):
        if parent['dispatch'] != 'design-gated':
            continue
        activation = {
            'id': parent['id'] + '.prepare', 'canonical_ids': parent['canonical_ids'], 'lane': parent['lane'],
            'title': 'Prepare bounded leaf: ' + parent['title'], 'kind': 'activation-design',
            'dispatch': 'candidate' if parent['lane'] != 12 else 'design-gated',
            'priority_group': parent['priority_group'], 'depends_on': [],
            'context': dict(parent['context']),
        }
        activation['context']['scope'] = [f'docs/evidence/plans/unified-leaves/{parent["id"]}.json']
        activation['context']['outcome'] = 'One cold-reader implementation or acceptance leaf for ' + parent['id'] + ', or a precise trigger/authority/dependency refusal.'
        activation['context']['steps'] = [
            'Re-read the pinned sources and exact owning row; compare current implementation and receipts, preserving historic facts.',
            'Walk the attached detailed steps, failure cases and external dependency contracts; check each prerequisite in its owner. Do not build or invoke external effects during design.',
            'Identify the smallest remaining deliverable, its exact writer/reader paths, contracts, sources and source digests; resolve old plan contradictions against accepted ADRs.',
            'Produce the named leaf JSON containing complete inputs/decisions/scope/outputs, exact positive and planted-negative commands, DoD, rollback, stop/resume and required review/authority.',
            'If a prerequisite is missing, retain its canonical id and exact missing receipt/trigger. Send blocking cross-task impact immediately and commit the dossier under the project/resource lease.',
        ]
        activation['context']['acceptance'] = ['Named dossier exists and answers all eight cold-reader questions; source refs resolve and match their hashes.', 'Cold independent reviewer can execute the scoped checks without planning chat; unavailable checks remain NOT_RUN, and unresolved prerequisite prevents implementation dispatch.']
        parent['depends_on'].append({'id': activation['id'], 'carries': 'control: reviewed bounded leaf plus dependency/authority receipt; preparation alone is not implementation acceptance'})
        tasks.append(activation)
    # Explicit preparation receipts settle only the named design leaf. They never
    # promote its implementation parent or change a canonical delivery status.
    prepared_path = REPORT / 'checks/prepared-leaves.json'
    prepared = load(prepared_path) if prepared_path.exists() else []
    for receipt in prepared:
        matches = [t for t in tasks if t['id'] == receipt['id']]
        if len(matches) != 1 or not receipt['id'].endswith('.prepare'):
            raise SystemExit('Invalid preparation receipt target: ' + receipt['id'])
        task = matches[0]
        if task['dispatch'] != 'candidate':
            raise SystemExit('Preparation receipt cannot bypass a held trigger: ' + receipt['id'])
        evidence = ROOT / receipt['path']
        if not evidence.is_file() or sha(evidence) != receipt['sha256']:
            raise SystemExit('Preparation evidence missing or changed: ' + receipt['id'])
        task['dispatch'] = 'done'
        task['evidence'] = {'path': receipt['path'], 'sha256': receipt['sha256']}
    sources = {p.split('#')[0] for t in tasks for p in t['context']['sources']}
    sources |= {t['context']['research_artifact'] for t in tasks if 'research_artifact' in t['context']}
    if prepared_path.exists():
        sources.add(prepared_path.relative_to(ROOT).as_posix())
    missing = [p for p in sorted(sources) if not (ROOT / p).is_file()]
    if missing:
        raise SystemExit('Unresolved input sources: ' + ', '.join(missing))
    plan = {
        'schema': 1, 'as_of': '2026-10-04', 'baseline': '41f994a709990ad72621fa834768a8833e7d93e1',
        'goal': 'Project coherence through sourced observation, accountable work, consent, independent verification and learning; P-08 Now, P-06.1/P-07.1 Next; N1 parallel subject to its own real-provider prerequisites.',
        'constraints': ['ADR-0101 canonical source owns every delivery status; snapshot is dispatch design only.', 'P-08 external owners retain their worktrees; no agent may infer release approval, live migration or cleanup permission from research.', 'Project identity, role, consent, receipts and history survive agent/provider changes; private restored history grants no standing authority.', 'Source hashes checked before dispatch. Prepare leaves are design work; held parents need reviewed leaf and current dependency/authority receipt.', 'One task lease plus exact resource claim per guarded file; isolated worktree; shared generated outputs integrated by one owner.', 'Native/provider/hosted/packaged/product observations remain separate proof tiers; unknown, timeout, source error or partial read never equals success.', 'Public Fabric report excludes private commercial designs, credential values and transcript raw exports.'],
        'lanes': lanes, 'sources': [{'path': p, 'sha256': sha(ROOT / p)} for p in sorted(sources)],
        'tasks': tasks, 'impacts': load(REPORT / 'impacts.json'),
    }
    (REPORT / 'plan.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')
    # Adapter projection for the installed pipeline's cold-reader and collision audit.
    out = REPORT / 'cold-packets'
    out.mkdir(exist_ok=True)
    nodes = []
    node_ids = {t['id']: f'N-{i:03d}' for i, t in enumerate(tasks, 1)}
    edges = []
    for i, t in enumerate(tasks, 1):
        nid = f'N-{i:03d}'
        settled = t['dispatch'] == 'done'
        nodes.append({'id': nid, 'title': t['title'], 'owner': 'coordinator', 'status': 'done' if settled else 'pending', 'serves': 'REQ-003', 'blocked_by': [node_ids[d['id']] for d in t['depends_on']], 'check': 'node scripts/unified-plan.mjs check'})
        for d in t['depends_on']:
            edges.append({'from': node_ids[d['id']], 'to': nid, 'payload': d['carries']})
        if settled:
            nodes[-1]['evidence'] = [t['evidence']['path'] + ' sha256=' + t['evidence']['sha256']]
            prior_packet = out / f'{nid}.json'
            if prior_packet.exists():
                prior_packet.unlink()
            continue
        ctx = t['context']
        unit_path = ctx['scope'][0] if t['id'].endswith('.prepare') or t['kind'] == 'design' else f'docs/evidence/plans/unified-leaves/{t["id"]}.review.json'
        # Broad parents audit as spec-review units, not product edits. Their product
        # scope travels as context; no two parallel design units edit one dossier.
        leaf = {'schema_version': 'execution-packet/1', 'node': nid, 'id': t['id'], 'intent': ctx['outcome'],
                'inputs': [{'address': p, 'sha256': sha(ROOT / p.split('#')[0])} for p in ctx['sources']],
                'decision_refs': [{'address': 'docs/adr/0101-the-general-development-plan.md', 'sha256': sha(ROOT / 'docs/adr/0101-the-general-development-plan.md')}],
                'source_scope': {'edit_targets': [unit_path]},
                'outputs': [{'path': unit_path, 'contract': 'bounded leaf or explicit refusal, not canonical completion'}],
                'acceptance': ctx['acceptance'], 'guards': ctx['stop_conditions'], 'resume': ctx['resume']}
        (out / f'{nid}.json').write_text(json.dumps(leaf, ensure_ascii=False, indent=2) + '\n')
    (REPORT / 'audit-graph.json').write_text(json.dumps({'goal': plan['goal'], 'requirements': ['REQ-003'], 'nodes': nodes, 'edges': edges}, ensure_ascii=False, indent=2) + '\n')
    print(f'Compiled {len(lanes)} lanes, {len(tasks)} dispatch/design records, {len(sources)} source pins')


if __name__ == '__main__':
    main()
# #endregion unified-plan-compiler
