#!/usr/bin/env python3
"""Every GitHub workflow parses as YAML and names at least one job (0.3.5 verification, iteration 2, DO-1), and a
scheduled run never cancels a push run (its concurrency group names the event).

release.yml held a plain `run:` value containing ": " from c98a0817 (2026-10-10): GitHub refuses such a file whole,
so every release.yml run had zero jobs and a tag would have released nothing — and no local gate parsed it.
Usage: scripts/check-workflows.py [file ...]   (default: .github/workflows/*.yml)
"""
import glob, sys
import yaml

files = sys.argv[1:] or sorted(glob.glob('.github/workflows/*.yml') + glob.glob('.github/workflows/*.yaml'))
problems = []
for path in files:
    try:
        doc = yaml.safe_load(open(path, encoding='utf-8'))
    except yaml.YAMLError as e:
        problems.append(f'{path}: not valid YAML — {str(e).splitlines()[0]} ({getattr(e, "problem_mark", "")})')
        continue
    if not isinstance(doc, dict) or not isinstance(doc.get('jobs'), dict) or not doc['jobs']:
        problems.append(f'{path}: no jobs')
        continue
    # A schedule must never cancel a push (2026-10-22: the nightly run on main cancelled push run 39699805163, and the
    # release guard then needed the schedule's run). With cancel-in-progress, a group keyed by the ref alone puts both
    # events in one queue, so a workflow with a schedule names the event in its group. YAML 1.1 reads `on` as true.
    triggers = doc.get('on', doc.get(True))
    events = set(triggers) if isinstance(triggers, (dict, list)) else {triggers}
    conc = doc.get('concurrency')
    if 'schedule' in events and isinstance(conc, dict) and conc.get('cancel-in-progress') is True \
            and 'github.event_name' not in str(conc.get('group', '')):
        problems.append(f'{path}: concurrency group {conc.get("group")!r} cancels in progress but does not name '
                        'github.event_name, so a scheduled run cancels a push run on the same ref')
for p in problems:
    print('FAIL ' + p)
if problems:
    sys.exit(1)
print(f'PASS workflows: {len(files)} parse as YAML, name their jobs, and no schedule cancels a push')
