#!/usr/bin/env python3
# #region unified-plan-compiler — docs: docs/reports/2026-10-04-unified-execution/protocol.md#recovery-and-source-change
"""Compile the dated research cut; never infer implementation completion."""
import hashlib
import json
import re
import argparse
import subprocess
import shlex
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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', '--report', dest='output', required=True, help='New repository-relative report directory; the dated input cut is never overwritten')
    parser.add_argument('--source-revision', '--baseline', dest='source_revision', required=True, help='Full committed Fabric SHA whose input bytes have been reconciled by the owner')
    parser.add_argument('--privacy-deny-file', required=True, help='Local-only JSON array of private literal identifiers; never copied into outputs')
    args = parser.parse_args()
    relative_output = Path(args.output)
    if relative_output.is_absolute() or '\\' in args.output or re.match(r'^[A-Za-z]:', args.output) or any(p in ('', '.', '..') for p in args.output.split('/')) or not args.output.startswith('docs/reports/'):
        parser.error('unsafe report directory; output must be repository-relative docs/reports')
    output = ROOT / relative_output
    current = ROOT
    for part in relative_output.parts:
        current = current / part
        if current.is_symlink():
            parser.error('report directory contains a symlink')
    if ROOT.resolve() not in output.resolve().parents:
        raise SystemExit('Output escapes repository through a linked parent')
    if output.resolve() == REPORT.resolve() or (output / 'plan.json').exists() or (output / 'audit-graph.json').exists() or (output / 'cold-packets').exists():
        raise SystemExit('Refusing to overwrite a dated input or existing generated cut; choose a new output directory')
    if not re.fullmatch(r'[a-f0-9]{40}', args.source_revision):
        parser.error('Source revision must be a full lowercase immutable commit SHA')
    checked = subprocess.run(['git', '-C', str(ROOT), 'cat-file', '-t', args.source_revision], capture_output=True, text=True)
    if checked.returncode or checked.stdout.strip() != 'commit':
        parser.error('unknown baseline commit')
    inventory_command = ['node', str(ROOT / 'scripts/unified-plan.mjs'), 'inventory', '--source-revision', args.source_revision, '--privacy-deny-file', args.privacy_deny_file]
    inventory = json.loads(subprocess.check_output(inventory_command, cwd=ROOT, text=True))
    text = (ROOT / 'docs/evidence/backlog.md').read_text()
    section = text.split('<!-- general-plan:begin -->')[1].split('<!-- general-plan:end -->')[0]
    lanes = []
    for row in section.splitlines():
        if re.match(r'^\| \d+ ·', row):
            cells = [x.strip() for x in row.split('|')]
            lanes.append({'number': int(cells[1].split()[0]), 'canonical_ids': cells[-2].split(', ')})
    canonical = {x for l in lanes for x in l['canonical_ids']}
    tasks = []
    historical_receipt = load(REPORT / 'checks/execution.json')
    historical_revision = historical_receipt.get('source_revision')
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
                task['context']['research_provenance'] = {'path': (REPORT / f'packets/{name}.json').relative_to(ROOT).as_posix(), 'source_revision': historical_revision}
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
    # Coverage comes from every declaration in the canonical manifest, not only
    # the named direction lanes. Preserve source-qualified identity. Unresearched
    # rows become held source-review references, never inferred dispatch grants.
    for task in tasks:
        task['canonical_keys'] = [row['key'] for row in inventory['tasks']
                                  if row['id'] in task['canonical_ids'] and row['path'] in [p.split('#')[0] for p in task['context']['sources']]]
    covered = {key for task in tasks for key in task['canonical_keys']}
    used = {task['id'] for task in tasks}
    for row in inventory['tasks']:
        if row['key'] in covered:
            continue
        tid = row['id'] if row['id'] not in used else 'source.' + hashlib.sha256(row['key'].encode()).hexdigest()[:16]
        used.add(tid)
        lane = next((l['number'] for l in lanes if row['id'] in l['canonical_ids']), 0)
        source_line = (ROOT / row['path']).read_text().splitlines()[row['line'] - 1] if row.get('line') else None
        tasks.append({'id': tid, 'canonical_ids': [row['id']], 'canonical_keys': [row['key']], 'lane': lane,
                      'title': 'Reconcile canonical source: ' + row['id'], 'kind': 'canonical-source-review',
                      'dispatch': 'owned-elsewhere', 'priority_group': priority([row['id']], lane) if lane else 50, 'depends_on': [],
                      'context': {'outcome': 'Owner reconciles one bounded source-addressed packet for ' + row['id'],
                                  'sources': [row['path'], 'docs/backlog-sources.json'],
                                  'scope': [f'docs/handoffs/unified-source-reconciliation/{tid}.json'],
                                  'steps': ['Read the exact source row and its complete owning section, prerequisites and authority.', 'Resolve current receipts and priority with the integration owner before adding a bounded executable packet; do not copy writable status.'],
                                  'acceptance': ['Source-qualified identity and immutable source revision resolve; all original prerequisites are preserved.', 'A newly catalogued row stays held until the owner has reviewed its bounded packet and dependency receipts.'],
                                  'risks': ['A status label or coverage entry is not a completion receipt or permission. Conditional/external prerequisites must not be inferred away.'],
                                  'stop_conditions': ['Stop before dispatch, implementation or private-plan copying; source review is owned elsewhere.'],
                                  'resume': 'Open the canonical source URL and request owner reconciliation; preserve source dependencies, privacy and current hub convergence gate.',
                                  'canonical_source': row, 'canonical_line': source_line,
                                  'implementation_readiness': 'Held source reference only; no status or delivery authority is owned by this projection.'}})
    # Bounded activation leaves make the large remaining cards executable as design work.
    # The implementation parents remain held. Each leaf owns a separate dossier artifact.
    for parent in list(tasks):
        if parent['dispatch'] != 'design-gated':
            continue
        activation = {
            'id': parent['id'] + '.prepare', 'canonical_ids': parent['canonical_ids'], 'lane': parent['lane'],
            'canonical_keys': parent['canonical_keys'],
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
        task['evidence'] = {'path': receipt['path'], 'sha256': receipt['sha256'], 'scope': receipt['scope'], 'source_revision': subprocess.check_output(['git', 'log', '-1', '--format=%H', args.source_revision, '--', receipt['path']], cwd=ROOT, text=True).strip()}
    # New byte pins attest inputs, never current acceptance or dispatch authority.
    # The owning canonical queue can still authorize work independently of this
    # derived graph; a current bounded packet must reconcile inherited context.
    for task in tasks:
        if task['kind'] != 'canonical-source-review':
            task['context'].setdefault('research_provenance', {'source_revision': historical_revision, 'path': REPORT.relative_to(ROOT).as_posix()})
        if task['dispatch'] in ['candidate', 'done']:
            task['historical_dispatch'] = task['dispatch']
            if task.get('evidence'):
                task['historical_evidence'] = dict(task['evidence'])
                task['historical_evidence'].setdefault('source_revision', historical_revision)
                task['historical_evidence'].setdefault('scope', 'Historical input check only; consult the unchanged receipt for proof tier and NOT_RUN limitations')
            task['dispatch'] = 'design-gated'
            task['context']['stop_conditions'].append('Reconcile a current bounded owner packet before dispatch; new source hashes do not renew historical acceptance')
    sources = {p.split('#')[0] for t in tasks for p in t['context']['sources']}
    sources |= {t['context']['research_artifact'] for t in tasks if 'research_artifact' in t['context']}
    sources |= {s['path'] for s in inventory['sources']}
    sources |= {'scripts/build-unified-plan.py', 'scripts/unified-plan.mjs', 'scripts/unified-canonical-sources.mjs'}
    sources |= {(REPORT / f'packets/{name}.json').relative_to(ROOT).as_posix() for name in ['release', 'start-adoption', 'agents-memory', 'reach-horizon']}
    sources |= {(REPORT / 'impacts.json').relative_to(ROOT).as_posix(), (REPORT / 'checks/execution.json').relative_to(ROOT).as_posix()}
    sources |= {task['evidence']['path'] for task in tasks if task.get('evidence')}
    sources.add('docs/adr/0101-the-general-development-plan.md')
    if prepared_path.exists():
        sources.add(prepared_path.relative_to(ROOT).as_posix())
    missing = [p for p in sorted(sources) if not (ROOT / p).is_file()]
    if missing:
        raise SystemExit('Unresolved input sources: ' + ', '.join(missing))
    # Verify the input revision before any output is written. Working changes
    # cannot acquire an immutable source URL by copying the current hash.
    for path in sorted(sources):
        try:
            committed = subprocess.check_output(['git', 'show', args.source_revision + ':' + path], cwd=ROOT, stderr=subprocess.DEVNULL)
        except subprocess.CalledProcessError:
            raise SystemExit('Input is absent from the source revision: ' + path)
        if hashlib.sha256(committed).hexdigest() != sha(ROOT / path):
            raise SystemExit('Input is uncommitted or differs from source revision: ' + path)
    deny = load(Path(args.privacy_deny_file))
    if not isinstance(deny, list) or any(not isinstance(token, str) or not token.strip() for token in deny):
        raise SystemExit('Privacy deny file must contain an array of nonempty literal strings')
    for path in sorted(sources):
        text = (ROOT / path).read_text()
        label = '<redacted source path>' if any(token.casefold() in path.casefold() for token in deny) else path
        if any(token.casefold() in text.casefold() for token in deny):
            raise SystemExit('Private input refused: ' + label)
        if re.search(r'"(?:visibility|publication_scope)"\s*:\s*"private"|"private_(?:consumer|repository|context)"\s*:', text, re.I):
            raise SystemExit('Private metadata refused: ' + label)
    plan = {
        'schema': 1, 'as_of': '2026-10-04', 'baseline': args.source_revision,
        'research_input': REPORT.relative_to(ROOT).as_posix(), 'research_source_revision': historical_revision, 'reconciliation': 'Inherited dispatch and completion proofs held pending current bounded owner context; canonical owner queue remains authoritative', 'canonical_inventory': inventory,
        'goal': 'Project coherence through sourced observation, accountable work, consent, independent verification and learning; P-08 Now, P-06.1/P-07.1 Next; N1 parallel subject to its own real-provider prerequisites.',
        'constraints': ['ADR-0101 canonical source owns every delivery status; snapshot is dispatch design only.', 'P-08 external owners retain their worktrees; no agent may infer release approval, live migration or cleanup permission from research.', 'Project identity, role, consent, receipts and history survive agent/provider changes; private restored history grants no standing authority.', 'Source hashes checked before dispatch. Prepare leaves are design work; held parents need reviewed leaf and current dependency/authority receipt.', 'One task lease plus exact resource claim per guarded file; isolated worktree; shared generated outputs integrated by one owner.', 'Native/provider/hosted/packaged/product observations remain separate proof tiers; unknown, timeout, source error or partial read never equals success.', 'Public Fabric report excludes private commercial designs, credential values and transcript raw exports.'],
        'lanes': lanes, 'sources': [{'path': p, 'sha256': sha(ROOT / p), 'commit': args.source_revision} for p in sorted(sources)],
        'tasks': tasks, 'impacts': load(REPORT / 'impacts.json'),
    }
    plan_text = json.dumps(plan, ensure_ascii=False, indent=2) + '\n'
    # Loaded JSON can decode a literal hidden by Unicode escapes in the input.
    # Check the actual publication bytes before creating any output artifacts.
    if any(token.casefold() in plan_text.casefold() for token in deny):
        raise SystemExit('Private generated plan refused')
    if re.search(r'"(?:visibility|publication_scope)"\s*:\s*"private"|"private_(?:consumer|repository|context)"\s*:', plan_text, re.I):
        raise SystemExit('Private generated metadata refused')
    output.mkdir(parents=True, exist_ok=True)
    (output / 'plan.json').write_text(plan_text)
    # Adapter projection for the installed pipeline's cold-reader and collision audit.
    out = output / 'cold-packets'
    out.mkdir(exist_ok=True)
    nodes = []
    node_ids = {t['id']: f'N-{i:03d}' for i, t in enumerate(tasks, 1)}
    edges = []
    for i, t in enumerate(tasks, 1):
        nid = f'N-{i:03d}'
        settled = t['dispatch'] == 'done'
        nodes.append({'id': nid, 'title': t['title'], 'owner': 'coordinator', 'status': 'done' if settled else 'pending', 'serves': 'REQ-003', 'blocked_by': [node_ids[d['id']] for d in t['depends_on']], 'check': 'node scripts/unified-plan.mjs --report ' + shlex.quote(args.output) + ' --privacy-deny-file "$FABRIC_PUBLIC_PRIVACY_DENY_FILE" check'})
        for d in t['depends_on']:
            edges.append({'from': node_ids[d['id']], 'to': nid, 'payload': d['carries']})
        if settled:
            nodes[-1]['evidence'] = [t['evidence']['path'] + ' sha256=' + t['evidence']['sha256']]
            prior_packet = out / f'{nid}.json'
            if prior_packet.exists():
                prior_packet.unlink()
            continue
        ctx = t['context']
        unit_path = ctx['scope'][0] if t['id'].endswith('.prepare') or t['kind'] in ['design', 'canonical-source-review'] else f'docs/evidence/plans/unified-leaves/{t["id"]}.review.json'
        # Broad parents audit as spec-review units, not product edits. Their product
        # scope travels as context; no two parallel design units edit one dossier.
        leaf = {'schema_version': 'execution-packet/1', 'source_revision': args.source_revision, 'dispatch': t['dispatch'], 'research_source_revision': historical_revision, 'node': nid, 'id': t['id'], 'intent': ctx['outcome'],
                'inputs': [{'address': p, 'commit': args.source_revision, 'sha256': sha(ROOT / p.split('#')[0])} for p in ctx['sources']],
                'decision_refs': [{'address': 'docs/adr/0101-the-general-development-plan.md', 'commit': args.source_revision, 'sha256': sha(ROOT / 'docs/adr/0101-the-general-development-plan.md')}],
                'source_scope': {'edit_targets': [unit_path]},
                'outputs': [{'path': unit_path, 'contract': 'bounded leaf or explicit refusal, not canonical completion'}],
                'acceptance': ctx['acceptance'], 'guards': ctx['stop_conditions'], 'resume': ctx['resume']}
        (out / f'{nid}.json').write_text(json.dumps(leaf, ensure_ascii=False, indent=2) + '\n')
    (output / 'audit-graph.json').write_text(json.dumps({'goal': plan['goal'], 'requirements': ['REQ-003'], 'nodes': nodes, 'edges': edges}, ensure_ascii=False, indent=2) + '\n')
    print(f'Compiled {len(lanes)} direction lanes, {len(inventory["tasks"])} source-qualified canonical rows, {len(tasks)} held/dispatch/design records, {len(sources)} revision-bound source pins into {args.output}')


if __name__ == '__main__':
    main()
# #endregion unified-plan-compiler
