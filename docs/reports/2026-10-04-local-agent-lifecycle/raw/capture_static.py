#!/usr/bin/env python3
"""Capture safe CLI help/offline schema facts; never start a session or server."""
# #region lifecycle-static-capture — docs: docs/reports/2026-10-04-local-agent-lifecycle/README.md#observed-surface-and-proof-levels
import argparse
import hashlib
import json
import subprocess
from pathlib import Path


def run(*args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, (args[0], result.returncode)
    return result.stdout.strip()


def capture(schema_dir):
    versions = {name: run(name, '--version') for name in ('codex', 'claude')}
    assert versions['codex'] == 'codex-cli 0.160.0', versions['codex']
    assert versions['claude'].startswith('2.1.289 '), versions['claude']
    files = ['ClientRequest.json', 'v2/ThreadQueueAddParams.json',
             'v2/ThreadQueueStartParams.json', 'v2/TurnStartParams.json',
             'v2/HooksListResponse.json', 'v2/McpServerToolCallParams.json']
    snapshots = {}
    for name in files:
        data = (schema_dir / name).read_bytes()
        parsed = json.loads(data)
        snapshots[name] = {
            'sha256': hashlib.sha256(data).hexdigest(),
            'required': parsed.get('required', []),
            'properties': sorted(parsed.get('properties', {})),
        }
    client = json.loads((schema_dir / 'ClientRequest.json').read_text())
    methods = []
    for entry in client['oneOf']:
        methods.extend(entry.get('properties', {}).get('method', {}).get('enum', []))
    selected = sorted(m for m in methods if m.startswith('thread/queue/') or
                      m in ['hooks/list', 'turn/start', 'turn/interrupt', 'turn/steer',
                            'thread/read', 'thread/resume', 'mcpServer/tool/call'])
    commands = [('codex', '--help'), ('codex', 'app-server', '--help'),
                ('codex', 'queue', '--help'), ('codex', 'agents', '--help'),
                ('claude', '--help'), ('claude', 'agents', '--help'),
                ('claude', 'attach', '--help')]
    help_records = []
    for args in commands:
        output = run(*args)
        help_records.append({'command': ' '.join(args), 'exit': 0,
                             'stdout_sha256': hashlib.sha256(output.encode()).hexdigest()})
    return {
        'as_of': '2026-10-04', 'proof_tier': 'S: static only', 'versions': versions,
        'schema_generation': 'CODEX_HOME=<task-owned-empty-temp-home> codex app-server generate-json-schema --experimental --out <task-owned-temp-dir>',
        'schema_generation_exit': 0, 'methods': selected, 'schemas': snapshots,
        'help': help_records,
        'upstream_version_source': 'a956835d020762cb2b570053af06f643a11c0ecc',
        'binary_source_attestation': 'NOT_PROVEN: matching version is not build attestation',
        'app_scope': {
            'codex_conventional_plist_present': Path('/Applications/Codex.app/Contents/Info.plist').is_file(),
            'claude_conventional_plist_present': Path('/Applications/Claude.app/Contents/Info.plist').is_file(),
            'qualification': 'No app launched or session listed; conventional absence is not global absence.'},
        'runtime': 'NOT_RUN: no app-server/model/account/board/session invocation',
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('schema_dir', type=Path)
    args = parser.parse_args()
    print(json.dumps(capture(args.schema_dir), indent=2))
# #endregion lifecycle-static-capture
