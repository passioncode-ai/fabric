"""Replay two production controls; no DB, provider or source-checkout writes."""
import argparse
import pathlib
import subprocess
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('--source-root', type=pathlib.Path, required=True)
args = parser.parse_args()
root = args.source_root.resolve()
archive = pathlib.Path(__file__).resolve().parent
pattern = 'actual child key overrides|child environment extra-key'
for state in ['fixed', 'original']:
    with tempfile.TemporaryDirectory(prefix='fabric-n033-replay-') as temporary:
        overlay = pathlib.Path(temporary)
        for relative in ['apps/desktop/src/main', 'apps/desktop/src/shared', 'apps/desktop/test']:
            target = overlay / relative
            target.mkdir(parents=True)
            for item in (root / relative).iterdir():
                (target / item.name).symlink_to(item.resolve(), target_is_directory=item.is_dir())
        for relative in ['node_modules', 'apps/desktop/node_modules', 'scripts']:
            (overlay / relative).symlink_to((root / relative).resolve(), target_is_directory=True)
        test = overlay / 'apps/desktop/test/resource-worker-launch.test.mjs'
        test.unlink()
        test.write_bytes((archive / 'final-test.snapshot.txt').read_bytes())
        for module in ['resourceManagedUnit', 'pty']:
            target = overlay / f'apps/desktop/src/main/{module}.ts'
            target.unlink()
            source = (archive / f'original-{module}.snapshot.txt') if state == 'original' else root / f'apps/desktop/src/main/{module}.ts'
            target.write_bytes(source.read_bytes())
        command = ['node', '--experimental-strip-types', '--test', '--test-reporter=tap', f'--test-name-pattern={pattern}', str(test)]
        result = subprocess.run(command, cwd=overlay, text=True, capture_output=True)
        print(state, 'exit', result.returncode)
        print(result.stdout)
        print(result.stderr)
        # Skipped tests or an import failure are not acceptance/negative evidence.
        expected = ('# pass 2', '# fail 0', '# skipped 0') if state == 'fixed' else ('# pass 0', '# fail 2', '# skipped 0')
        if result.returncode != (0 if state == 'fixed' else 1) or not all(marker in result.stdout for marker in expected):
            raise SystemExit('unexpected replay result; inspect exact test failures')
print('fixed PASS; original EXPECTED_RED (two actual assertions)')
