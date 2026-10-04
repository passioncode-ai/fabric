#!/usr/bin/env python3
# #region unified-plan-compiler — docs: docs/reports/2026-10-04-unified-execution/protocol.md#recovery-and-source-change
"""Compile the dated research cut; never infer implementation completion."""
import hashlib
import json
import re
import argparse
import subprocess
import shlex
import stat
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


# #region current-owner-reconciliation — docs: docs/handoffs/2026-10-04-unified-owner-reconciliation.md#source-owned-current-input
# A fixed source-owned instruction is independent of editable graph fields.
RECONCILIATION = 'docs/evidence/plans/unified-current-reconciliation.json'


def owner_path(path):
    if not isinstance(path, str) or len(path) > 700 or not re.fullmatch(r'[A-Za-z0-9_./-]+', path) or any(p in ['', '.', '..'] or p.startswith('.') for p in path.split('/')) or path.startswith('workspace/'):
        raise SystemExit('Unsafe or cross-owner reconciliation path')
    cursor = ROOT
    for part in path.split('/'):
        cursor = cursor / part
        if cursor.is_symlink():
            raise SystemExit('Linked reconciliation input refused')
    return cursor


def git_bytes(revision, path):
    if not isinstance(revision, str) or not re.fullmatch(r'[a-f0-9]{40}', revision):
        raise SystemExit('Reconciliation requires a full immutable revision')
    owner_path(path)
    try:
        return subprocess.check_output(['git', 'show', revision + ':' + path], cwd=ROOT, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        raise SystemExit('Reconciliation reference is absent from its immutable revision: ' + path)


def exact_ref(ref, inputs):
    if not isinstance(ref, dict) or set(ref) != {'path', 'revision', 'sha256'} or not isinstance(ref['sha256'], str) or not re.fullmatch(r'[a-f0-9]{64}', ref['sha256']):
        raise SystemExit('Invalid reconciliation source receipt')
    path = owner_path(ref['path'])
    if not path.is_file() or path.stat().st_size > 32 * 1024 * 1024:
        raise SystemExit('Missing or oversized reconciliation source receipt: ' + ref['path'])
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != ref['sha256'] or raw != git_bytes(ref['revision'], ref['path']):
        raise SystemExit('Dirty or forged reconciliation source receipt: ' + ref['path'])
    inputs.add(ref['path'])
    return raw


def scoped_files(paths, basis):
    """A directory is a bounded complete input inventory, never an implicit output."""
    files = set()
    visited = 0
    for path in paths:
        target = owner_path(path)
        if not target.exists():
            raise SystemExit('Missing reconciliation input scope; declare new outputs explicitly')
        entries = subprocess.check_output(['git', 'ls-tree', '-rz', basis, '--', path], cwd=ROOT).split(b'\0')
        committed = set()
        for entry in filter(None, entries):
            if len(entry) > 1400:
                raise SystemExit('Oversized reconciliation scope tree entry')
            metadata, name = entry.decode('utf8').split('\t', 1)
            mode, kind, _ = metadata.split(' ')
            owner_path(name)
            if mode not in ['100644', '100755'] or kind != 'blob':
                raise SystemExit('Nonregular reconciliation basis scope entry refused')
            committed.add(name)
            if len(committed) > 256:
                raise SystemExit('Reconciliation scope inventory exceeds bound')
        live = set()
        pending = [target]
        while pending:
            item = pending.pop()
            visited += 1
            if visited > 1024:
                raise SystemExit('Reconciliation scope traversal exceeds bound')
            relative = item.relative_to(ROOT).as_posix()
            owner_path(relative)
            mode = item.lstat().st_mode
            if stat.S_ISREG(mode):
                live.add(relative)
            elif stat.S_ISDIR(mode):
                for child in item.iterdir():
                    pending.append(child)
                    if len(pending) + visited > 1024:
                        raise SystemExit('Reconciliation scope traversal exceeds bound')
            else:
                raise SystemExit('Linked or nonregular reconciliation live scope entry refused')
        if not committed or live != committed:
            raise SystemExit('Reconciliation scope inventory differs from immutable basis')
        files.update(live)
        if len(files) > 256:
            raise SystemExit('Reconciliation scope inventory exceeds bound')
    return files


def new_outputs(paths, input_paths, basis, revision):
    if not isinstance(paths, list) or len(paths) > 64 or len(set(paths)) != len(paths):
        raise SystemExit('Invalid reconciliation explicit output scope')
    for path in paths:
        target = owner_path(path)
        for parent in target.parents:
            if parent == ROOT:
                break
            if parent.exists() and not parent.is_dir():
                raise SystemExit('Non-directory reconciliation output parent refused')
        if target.exists():
            raise SystemExit('New reconciliation output already exists in live tree')
        for commit in [basis, revision]:
            if subprocess.run(['git', 'cat-file', '-e', commit + ':' + path], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
                raise SystemExit('New reconciliation output already exists in immutable tree')
            for parent in target.parents:
                if parent == ROOT:
                    break
                ancestor = parent.relative_to(ROOT).as_posix()
                kind = subprocess.run(['git', 'cat-file', '-t', commit + ':' + ancestor], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
                if kind.returncode == 0 and kind.stdout.strip() != b'tree':
                    raise SystemExit('Non-directory reconciliation immutable output parent refused')
        if any(path == other or path.startswith(other + '/') or other.startswith(path + '/') for other in input_paths + [p for p in paths if p != path]):
            raise SystemExit('Overlapping reconciliation input or output scopes refused')
    return paths


def owner_packets(inventory, revision):
    path = owner_path(RECONCILIATION)
    present_at_revision = subprocess.run(['git', 'cat-file', '-e', revision + ':' + RECONCILIATION], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
    if not present_at_revision and not path.exists():
        return [], set(), None
    if not present_at_revision or not path.is_file():
        raise SystemExit('Reconciliation source missing or not committed at selected revision')
    inputs = set()
    raw = exact_ref({'path': RECONCILIATION, 'revision': revision, 'sha256': sha(path)}, inputs)
    source = json.loads(raw)
    repo = inventory['repository']
    if set(source) != {'schema', 'repository', 'packets'} or source['schema'] != 'unified-owner-reconciliation/1' or source['repository'] != repo or not isinstance(source['packets'], list) or len(source['packets']) > 64:
        raise SystemExit('Invalid or cross-owner reconciliation source')
    by_key = {row['key']: row for row in inventory['tasks']}
    tasks, used = [], set()
    required = {'id', 'canonical_key', 'related_canonical_keys', 'basis_revision', 'basis_sources', 'operation', 'title', 'context', 'output_scope', 'rollback', 'authority', 'dependencies', 'acceptance_gates', 'impact_scope'}
    for packet in source['packets']:
        packet_inputs = set()
        if not isinstance(packet, dict) or set(packet) != required:
            raise SystemExit('Reconciliation packet fields invalid; no derived status or done authority is accepted')
        row = by_key.get(packet['canonical_key'])
        if not row or not isinstance(packet['related_canonical_keys'], list):
            raise SystemExit('Unknown or cross-owner reconciliation identity')
        rows = [row] + [by_key.get(key) for key in packet['related_canonical_keys']]
        if any(r is None for r in rows) or len({r['key'] for r in rows}) != len(rows):
            raise SystemExit('Unknown or duplicate related reconciliation identity')
        tid = packet['id']
        if not isinstance(tid, str) or not re.fullmatch(re.escape(row['id']) + r'\.[a-z][a-z0-9-]{1,60}', tid) or tid in used:
            raise SystemExit('Reconciliation bounded task cannot rename or collide with its owner identity')
        used.add(tid)
        if packet['operation'] not in ['source-preparation', 'qualification', 'bounded-design'] or not isinstance(packet['title'], str) or not packet['title'].strip() or not packet['rollback']:
            raise SystemExit('Reconciliation is bounded source/design work only, with rollback')
        basis = packet['basis_revision']
        git_bytes(basis, row['path'])
        if subprocess.run(['git', 'merge-base', '--is-ancestor', basis, revision], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode:
            raise SystemExit('Reconciliation basis is not an ancestor of selected source')
        basis_paths = set()
        if not isinstance(packet['basis_sources'], list) or len(packet['basis_sources']) > 256:
            raise SystemExit('Reconciliation basis source count is invalid')
        for ref in packet['basis_sources']:
            if ref['revision'] != basis or ref['path'] in basis_paths:
                raise SystemExit('Reconciliation basis receipts must share one immutable revision without duplicates')
            exact_ref(ref, packet_inputs); basis_paths.add(ref['path'])
        ctx = packet['context']
        fields = {'outcome', 'sources', 'scope', 'steps', 'acceptance', 'risks', 'stop_conditions', 'resume'}
        if not isinstance(ctx, dict) or set(ctx) != fields or any(not ctx[k] for k in fields) or any(not isinstance(ctx[k], list) for k in fields - {'outcome', 'resume'}):
            raise SystemExit('Reconciliation needs complete bounded cold context')
        if len(ctx['scope']) > 64 or len(ctx['sources']) > 256 or any(not isinstance(value, str) or not value.strip() for key in fields - {'outcome', 'resume'} for value in ctx[key]):
            raise SystemExit('Reconciliation context is oversized or not textual')
        for value in ctx['scope'] + ctx['sources']:
            owner_path(value)
        required_basis = {r['path'] for r in rows} | set(ctx['sources']) | scoped_files(ctx['scope'], basis)
        outputs = new_outputs(packet['output_scope'], ctx['scope'] + ctx['sources'], basis, revision)
        if not required_basis.issubset(basis_paths):
            raise SystemExit('Reconciliation basis does not cover canonical/context/current scoped files')
        authority = packet['authority']
        if not isinstance(authority, dict) or set(authority) != {'kind', 'repository', 'actions', 'standing', 'requested_source'} or authority['kind'] != 'source-owner-bounded-work' or authority['repository'] != repo or not isinstance(authority['actions'], list) or not authority['actions'] or not set(authority['actions']).issubset({'design', 'code', 'check', 'commit', 'push'}):
            raise SystemExit('Reconciliation owner authority cannot grant release or live operations')
        for field, expected in [('standing', 'AGENTS.md'), ('requested_source', row['path'])]:
            if authority[field]['path'] != expected or authority[field]['revision'] != basis:
                raise SystemExit('Reconciliation authority must bind standing AGENTS and original owner source')
            exact_ref(authority[field], packet_inputs)
        if not isinstance(packet['acceptance_gates'], list) or not packet['acceptance_gates'] or any(set(gate) != {'id', 'requirement', 'required_for'} or not gate['id'] or not gate['requirement'] or gate['required_for'] != 'parent-acceptance' for gate in packet['acceptance_gates']):
            raise SystemExit('Reconciliation must retain separate parent acceptance gates without status claims')
        nonblocking = []
        if not isinstance(packet['impact_scope'], list):
            raise SystemExit('Reconciliation impact applicability must be explicit')
        impacts_path = (REPORT / 'impacts.json').relative_to(ROOT).as_posix()
        current_impacts = {impact['id']: impact for impact in load(ROOT / impacts_path)}
        for decision in packet['impact_scope']:
            if set(decision) != {'id', 'effect', 'reason', 'source'} or decision['id'] in nonblocking or decision['effect'] != 'parent-acceptance-only' or not decision['reason'] or packet['operation'] not in ['source-preparation', 'qualification']:
                raise SystemExit('Invalid or excessive reconciliation impact applicability')
            if decision['source']['path'] != impacts_path or decision['source']['revision'] != basis:
                raise SystemExit('Impact applicability must bind the exact owning impact input')
            exact_ref(decision['source'], packet_inputs)
            impact = current_impacts.get(decision['id'])
            if not impact or impact['severity'] != 'blocking' or impact['disposition'] != 'open' or not any(r['id'] in impact['targets'] for r in rows):
                raise SystemExit('Impact applicability cannot clear unknown or unrelated impacts')
            nonblocking.append(decision['id'])
        holds = []
        if not isinstance(packet['dependencies'], list):
            raise SystemExit('Reconciliation dependencies must be explicit')
        for dep in packet['dependencies']:
            if dep.get('kind') == 'source-input' and set(dep) == {'kind', 'purpose', 'ref'} and dep['purpose']:
                exact_ref(dep['ref'], packet_inputs)
            elif dep.get('kind') == 'scoped-acceptance' and set(dep) == {'kind', 'subject_key', 'scope', 'proof_tier', 'receipt'} and dep['scope'] and dep['proof_tier'] in ['source', 'focused', 'native', 'disposable', 'independent']:
                if dep['subject_key'] not in {r['key'] for r in rows}:
                    raise SystemExit('Scoped dependency is outside declared owner identities')
                if dep['receipt'] is None:
                    holds.append('Missing scoped acceptance: ' + dep['scope']); continue
                receipt = json.loads(exact_ref(dep['receipt'], packet_inputs))
                expected = {'schema': 'unified-scoped-receipt/1', 'repository': repo, 'subject_key': dep['subject_key'], 'basis_revision': basis, 'scope': dep['scope'], 'proof_tier': dep['proof_tier']}
                if set(receipt) != set(expected) | {'result'} or any(receipt.get(k) != v for k, v in expected.items()) or receipt.get('result') not in ['PASS', 'FAIL', 'NOT_RUN']:
                    raise SystemExit('Reconciliation receipt has forged subject, basis, scope or proof tier')
                if receipt['result'] != 'PASS':
                    holds.append('Scoped acceptance ' + receipt['result'] + ': ' + dep['scope'])
            else:
                raise SystemExit('Invalid reconciliation dependency')
        inputs.update(packet_inputs)
        current = dict(ctx)
        current['scope'] = ctx['scope'] + outputs
        current['sources'] = list(dict.fromkeys(ctx['sources'] + sorted(packet_inputs) + [RECONCILIATION]))
        current['owner_reconciliation'] = packet
        current['owner_holds'] = holds
        current['stop_conditions'] = ctx['stop_conditions'] + ['Stop before release approval, tag, deployment, production publication or operator database mutation; this packet does not accept its canonical parent']
        tasks.append({'id': tid, 'canonical_ids': [r['id'] for r in rows], 'canonical_keys': [r['key'] for r in rows], 'lane': 0, 'title': packet['title'], 'kind': 'bounded-source-work', 'dispatch': 'design-gated' if holds else 'candidate', 'priority_group': 0, 'depends_on': [], 'external_dependencies': packet['dependencies'], 'preparation_only_impacts': nonblocking, 'context': current})
    return tasks, inputs, {'path': RECONCILIATION, 'commit': revision, 'sha256': sha(path), 'packet_ids': [t['id'] for t in tasks]}

# #endregion current-owner-reconciliation

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', '--report', dest='output', help='New repository-relative report directory; the dated input cut is never overwritten')
    parser.add_argument('--source-revision', '--baseline', dest='source_revision', required=True, help='Full committed Fabric SHA whose input bytes have been reconciled by the owner')
    parser.add_argument('--privacy-deny-file', help='Local-only JSON array of private literal identifiers; never copied into outputs')
    parser.add_argument('--emit-plan', action='store_true', help='Reconstruct expected plan as JSON on stdout; never create or modify an output directory')
    args = parser.parse_args()
    if not args.emit_plan and (not args.output or not args.privacy_deny_file):
        parser.error('generation requires --output and --privacy-deny-file')
    if not args.emit_plan:
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
    inventory_command = ['node', str(ROOT / 'scripts/unified-plan.mjs'), 'inventory', '--source-revision', args.source_revision]
    if args.privacy_deny_file:
        inventory_command += ['--privacy-deny-file', args.privacy_deny_file]
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
    current_tasks, owner_inputs, owner_source = owner_packets(inventory, args.source_revision)
    if {t['id'] for t in tasks} & {t['id'] for t in current_tasks}:
        raise SystemExit('Reconciliation graph task identity collides with inherited graph')
    for task in current_tasks:
        task['lane'] = next((lane['number'] for lane in lanes if task['canonical_ids'][0] in lane['canonical_ids']), 0)
    tasks += current_tasks
    sources = {p.split('#')[0] for t in tasks for p in t['context']['sources']} | owner_inputs
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
    deny = load(Path(args.privacy_deny_file)) if args.privacy_deny_file else []
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
        'owner_reconciliation': owner_source, 'research_input': REPORT.relative_to(ROOT).as_posix(), 'research_source_revision': historical_revision, 'reconciliation': 'Inherited dispatch and completion proofs held pending current bounded owner context; canonical owner queue remains authoritative', 'canonical_inventory': inventory,
        'goal': 'Project coherence through sourced observation, accountable work, consent, independent verification and learning; P-08 Now, P-06.1/P-07.1 Next; N1 parallel subject to its own real-provider prerequisites.',
        'constraints': ['ADR-0101 canonical source owns every delivery status; snapshot is dispatch design only.', 'P-08 external owners retain their worktrees; no agent may infer release approval, live migration or cleanup permission from research.', 'Project identity, role, consent, receipts and history survive agent/provider changes; private restored history grants no standing authority.', 'Source hashes checked before dispatch. Prepare leaves are design work; held parents need reviewed leaf and current dependency/authority receipt.', 'One task lease plus exact resource claim per guarded file; isolated worktree; shared generated outputs integrated by one owner.', 'Native/provider/hosted/packaged/product observations remain separate proof tiers; unknown, timeout, source error or partial read never equals success.', 'Public Fabric report excludes private commercial designs, credential values and transcript raw exports.'],
        'lanes': lanes, 'sources': [{'path': p, 'sha256': sha(ROOT / p), 'commit': args.source_revision} for p in sorted(sources)],
        'tasks': tasks, 'impacts': load(REPORT / 'impacts.json'),
    }
    plan_text = json.dumps(plan, ensure_ascii=False, indent=2) + '\n'
    # Loaded JSON can decode a literal hidden by Unicode escapes in the input.
    # Check the actual publication bytes before emitting or creating any output artifacts.
    if any(token.casefold() in plan_text.casefold() for token in deny):
        raise SystemExit('Private generated plan refused')
    if re.search(r'"(?:visibility|publication_scope)"\s*:\s*"private"|"private_(?:consumer|repository|context)"\s*:', plan_text, re.I):
        raise SystemExit('Private generated metadata refused')
    if args.emit_plan:
        print(json.dumps(plan, ensure_ascii=False, separators=(',', ':')))
        return
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
        unit_path = ctx['scope'][0] if t['id'].endswith('.prepare') or t['kind'] in ['design', 'canonical-source-review', 'bounded-source-work'] else f'docs/evidence/plans/unified-leaves/{t["id"]}.review.json'
        # Broad parents audit as spec-review units, not product edits. Their product
        # scope travels as context; no two parallel design units edit one dossier.
        leaf = {'schema_version': 'execution-packet/1', 'source_revision': args.source_revision, 'dispatch': t['dispatch'], 'research_source_revision': historical_revision, 'node': nid, 'id': t['id'], 'intent': ctx['outcome'],
                'inputs': [{'address': p, 'commit': args.source_revision, 'sha256': sha(ROOT / p.split('#')[0])} for p in ctx['sources']],
                'decision_refs': [{'address': 'docs/adr/0101-the-general-development-plan.md', 'commit': args.source_revision, 'sha256': sha(ROOT / 'docs/adr/0101-the-general-development-plan.md')}],
                'source_scope': {'edit_targets': ctx['scope'] if t['kind'] == 'bounded-source-work' else [unit_path]},
                'outputs': [{'path': unit_path, 'contract': 'bounded leaf or explicit refusal, not canonical completion'}],
                'acceptance': ctx['acceptance'], 'guards': ctx['stop_conditions'], 'resume': ctx['resume']}
        if t['kind'] == 'bounded-source-work':
            packet = ctx['owner_reconciliation']
            leaf['source_scope']['input_targets'] = packet['context']['scope']
            leaf['source_scope']['new_output_targets'] = packet['output_scope']
        (out / f'{nid}.json').write_text(json.dumps(leaf, ensure_ascii=False, indent=2) + '\n')
    (output / 'audit-graph.json').write_text(json.dumps({'goal': plan['goal'], 'requirements': ['REQ-003'], 'nodes': nodes, 'edges': edges}, ensure_ascii=False, indent=2) + '\n')
    print(f'Compiled {len(lanes)} direction lanes, {len(inventory["tasks"])} source-qualified canonical rows, {len(tasks)} held/dispatch/design records, {len(sources)} revision-bound source pins into {args.output}')


if __name__ == '__main__':
    main()
# #endregion unified-plan-compiler
