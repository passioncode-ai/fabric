#!/usr/bin/env python3
# Expands CO-215 and CO-216 (the 0.3.2 audit's deferred P2 and P3 findings) into one entry per finding,
# each under its ORIGINAL audit id, with a canvas node and a wave (release-040 plan, REQ-34).
#
#   python3 scripts/plan/release-040-co215-216.py \
#     docs/reports/2026-10-05-release-032-audit/raw \
#     docs/evidence/plans/2026-10-11-release-040-inventory.json \
#     docs/evidence/plans/2026-10-11-release-040-co215-216.json
#
# The rows are read the way the audit's own `raw/build-fix-list.py` reads them (same seven reports, same
# row test, same default disposition), so the set expanded here is exactly the fix list's
# "deferred — CO-215" and "deferred — CO-216" rows. The dated reports are only read, never written.
#
# Area → node is `scripts/plan/release-040-waves.py#NODE_BY_AREA`, read from that file, not copied. A
# finding's area is, in order: its kind (the audit's Area column) — a UI, accessibility or wording finding is
# `screens/ux` (`i18n` for language), a documentation-only finding `docs/process`; otherwise the inventory's
# area for the first scenario it names; a keyword rule over its evidence paths and text; the architecture
# report's area number; else `docs/process`. Wave by node: C1 and C2 → W1, C5 → W3, C6 and C7 → W4, C8 → W5,
# C10 and C12 → W6, C11 → W7; a finding whose proposed fix needs a decision first
# (FIX_NEEDS_MORE) → after-0.4.0. A finding a later record settled (SETTLED) keeps its entry, its receipt
# and wave `closed`. Deterministic: the same inputs give the same file.
import ast, json, pathlib, re, sys
from collections import Counter

raw, inventory_path, out_path = (pathlib.Path(a) for a in sys.argv[1:4])
here = pathlib.Path(__file__).parent
NODE_BY_AREA = ast.literal_eval(re.search(r'NODE_BY_AREA = (\{.*?\})\n', (here / 'release-040-waves.py').read_text(), re.S).group(1))

SOURCES = ['2026-10-05-scn-001-022.md', '2026-10-05-scn-023-045.md', '2026-10-05-scn-046-068.md',
           '2026-10-05-scn-069-090.md', '2026-10-05-scn-091-112.md', '2026-10-05-scn-113-134.md',
           '2026-10-05-architecture.md']
disp = json.loads((raw / 'dispositions.json').read_text())
inventory = {i['id']: i for i in json.load(open(inventory_path))}


def rows():
    out = []
    for name in SOURCES:
        head = None
        for line in (raw / name).read_text().splitlines():
            cells = [c.strip() for c in re.split(r'(?<!\\)\|', line.strip().strip('|'))]
            if cells and cells[0] == 'ID':
                head = cells
                continue
            if head and len(cells) >= len(head) - 1 and re.fullmatch(r'[A-Z][0-9]*-[0-9]+', cells[0]) \
                    and re.fullmatch(r'P[0-3]', cells[1]):
                row = dict(zip(head, cells))
                row['_source'] = name
                out.append(row)
    return out


def deferred_to(r):
    d = disp.get(r['ID'])
    if d is None and r['Severity'] in ('P2', 'P3'):
        d = {'state': 'deferred', 'ref': 'CO-215' if r['Severity'] == 'P2' else 'CO-216'}
    return d['ref'] if d and d.get('state') == 'deferred' and d.get('ref') in ('CO-215', 'CO-216') else None


def field(r, prefix):
    return next((v for k, v in r.items() if k.startswith(prefix)), '')


# Keyword rules over evidence paths and the finding, first match wins. Paths are the stronger signal.
KEYWORDS = [
    ('i18n', r'\bru\.ts\b|\bi18n\b|translat|Russian|English-only|\blocale\b'),
    ('harness/hub', r'hub(Tools)?\.ts|accessService|accessStore|productConnect|agentSurface|AgentAccessPanel|mcpStdioBridge|\bhub\b|fabric\.access'),
    ('security', r'\bgrant|redact|secret|credential|Keychain|\bCSP\b|sandbox|authority|privacy|permission'),
    ('sessions/runners', r'pty\.ts|SessionWindow|TerminalView|scrollback|transcript|acpShell|runner|launch(er|Place)|session'),
    ('onboarding/start', r'\bstart/|AgentPaths|FirstRun|onboarding|first run|first-run|New project|setup|executorDetect'),
    ('agents/registry', r'agentRegistry|registry|conversion|admission|\bagent(s)? (entry|card|binding)'),
    ('workflows/routines/chains', r'routine|chain(Advance)?|workflow|automation|cron'),
    ('board/communications', r'Board|board\.|tasks?\.(move|close)|question|proposal|attention|ObligationActs|digest|feed'),
    ('memory/context', r'memory|facts?\b|context pack|contextPack|decisions\.ts'),
    ('data/schema', r'supabase/migrations|\bmigration|projector|journal|\.sql\b|schema'),
    ('release/platform', r'release|electron-builder|updater|quit\.ts|lifecycle|DMG|notar|toolchain|analytics'),
]
ARCH_AREA = {'1': 'security', '2': 'data/schema', '3': 'release/platform', '4': 'other', '5': 'docs/process', '6': 'security'}
WAVE_BY_NODE = {'C1': 'W1', 'C2': 'W1', 'C5': 'W3', 'C6': 'W4', 'C7': 'W4', 'C8': 'W5', 'C10': 'W6', 'C11': 'W7', 'C12': 'W6'}
# A proposed fix that asks for a decision first is not one pass. Measured against the 252 fixes: the
# looser words ("ADR", "unbuilt", "Not built") are what a one-pass DOCUMENT fix writes, so they are not used.
FIX_NEEDS_MORE = re.compile(
    r"\bDecide whether\b|needs an ADR|an ADR amendment|\bhave the [a-z ]+ decide\b|operator decides|"
    r"operator's decision|needs? a (design|decision|contract)\b|is a (product|business) decision", re.I)
# Findings a later record already settled; each names its receipt. Nothing else is re-measured here.
SETTLED = {
    'A7-012': 'resolved 2026-10-08 by ADR-0127 (docs/adr/0127-no-usage-count-leaves-before-the-person-has-answered-the-switch.md): '
              'on by default, nothing queued or sent before the first-run notice or Settings is answered; shipped in 0.3.3 '
              '(carry-over CO-215 and CO-218)',
}
FILE = r'((?:[\w@.-]+/)*[\w@-]+(?:\.[\w-]+)*\.(?:tsx?|mjs|js|sql|md|json|ya?ml|toml|sh|py|css))'
LINES = r'(\d+(?:[-\u2013]\d+)?)'
FILELINE = re.compile(FILE + r'(?::' + LINES + r')?|`:' + LINES + r'`')
ROOTS = (('src/', 'apps/desktop/'), ('test/', 'apps/desktop/'), ('main/', 'apps/desktop/src/'),
         ('shared/', 'apps/desktop/src/'), ('renderer/', 'apps/desktop/src/'), ('preload/', 'apps/desktop/src/'))


def file_lines(evidence):
    """Every file (and line, when given) the evidence cites, normalised to a repository path where the
    audit used a short form; a bare `:42` continues the file before it."""
    out, last = [], None
    for path, line, cont in FILELINE.findall(evidence):
        if cont and last:
            path, line = last, cont
        elif not path:
            continue
        for short, root in ROOTS:
            if path.startswith(short):
                path = root + path
                break
        last = path
        ref = f'{path}:{line}' if line else path
        if ref not in out:
            out.append(ref)
    return out


UI_KINDS = {'ui', 'ui (a11y)', 'ui/a11y', 'ui/docs', 'docs/ui', 'ui/test'}
DOC_KINDS = {'docs', 'docs/test', 'test/docs'}


def area_of(r):
    kind = r.get('Area', '')
    if 'i18n' in kind:
        return 'i18n', f'kind {kind}'
    if kind in UI_KINDS:
        return 'screens/ux', f'kind {kind}'
    if kind in DOC_KINDS:
        return 'docs/process', f'kind {kind}'
    where = r.get('Scenario/Screen', '')
    for s in re.findall(r'SCN-\d+', where):
        if s in inventory:
            return inventory[s]['area'], f'inventory area of {s}'
    text = ' '.join([field(r, 'Evidence'), field(r, 'Finding'), where])
    for area, pat in KEYWORDS:
        if re.search(pat, text):
            return area, f'keyword {area}'
    m = re.match(r'(\d)', kind)
    if m:
        return ARCH_AREA[m.group(1)], f'architecture area {m.group(1)}'
    return 'docs/process', 'default'


entries = []
for r in rows():
    ref = deferred_to(r)
    if not ref:
        continue
    finding = field(r, 'Finding')
    title = re.split(r'(?<=[.!?])\s', finding, maxsplit=1)[0]
    if len(title) > 240:
        title = title[:237].rstrip() + '…'
    evidence = field(r, 'Evidence')
    refs = file_lines(evidence)
    area, why = area_of(r)
    node = NODE_BY_AREA.get(area, 'C12')
    fix = field(r, 'Proposed fix')
    needs = FIX_NEEDS_MORE.search(fix)
    settled = SETTLED.get(r['ID'])
    wave = 'closed' if settled else 'after-0.4.0' if needs else WAVE_BY_NODE[node]
    entries.append({
        'id': r['ID'], 'carriedBy': ref, 'severity': r['Severity'], 'kind': r.get('Area', ''),
        'where': r.get('Scenario/Screen', '') or None, 'title': title, 'fileLines': refs,
        'proposedFix': fix, 'area': area, 'areaFrom': why, 'node': node, 'wave': wave,
        'release': None if settled else 'program' if wave == 'after-0.4.0' else '0.4.0',
        'waveWhy': 'settled by a later record' if settled else
                   f'proposed fix needs a decision first ("{needs.group(0)}")' if needs else f'node {node}',
        'source': f'docs/reports/2026-10-05-release-032-audit/raw/{r["_source"]}',
        'status': settled or 'open',
    })

by = lambda k: dict(sorted(Counter(e[k] for e in entries).items()))
doc = {
    'schema': 'release-040-co215-216/1',
    'generatedBy': 'scripts/plan/release-040-co215-216.py',
    'sources': {'fixList': 'docs/reports/2026-10-05-release-032-audit/raw/2026-10-05-fix-list.md',
                'dispositions': 'docs/reports/2026-10-05-release-032-audit/raw/dispositions.json',
                'inventory': str(inventory_path)},
    'note': 'Every id is the audit\'s own. A finding closes in this file (status, with a dated receipt) when its fix '
            'lands; CO-215 closes when no carriedBy CO-215 entry is open, CO-216 likewise. Not re-measured against '
            'the 0.3.4 tree: some may already be fixed, and the wave that takes one re-reads it first.',
    'counts': {'total': len(entries), 'carriedBy': by('carriedBy'), 'severity': by('severity'), 'node': by('node'),
               'wave': by('wave'), 'nodeWave': dict(sorted(Counter(f"{e['node']} {e['wave']}" for e in entries).items())),
               'open': sum(e['status'] == 'open' for e in entries)},
    'findings': entries,
}
out_path.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + '\n')
print(json.dumps(doc['counts'], ensure_ascii=False))
