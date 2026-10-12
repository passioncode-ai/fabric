#!/usr/bin/env python3
"""Every GitHub workflow parses as YAML and names at least one job (0.3.5 verification, iteration 2, DO-1).

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
for p in problems:
    print('FAIL ' + p)
if problems:
    sys.exit(1)
print(f'PASS workflows: {len(files)} parse as YAML and name their jobs')
