"""Run saved audit probes with the desktop workspace's installed dependencies."""
from pathlib import Path
import subprocess
import tempfile

probes = Path(__file__).resolve().parent
root = probes.parents[3]
dependencies = root / "apps/desktop/node_modules"
vitest = dependencies / ".bin/vitest"
if not vitest.exists():
    raise SystemExit("Install this checkout's desktop dependencies first.")

with tempfile.TemporaryDirectory(prefix="fabric-audit-ui-") as temporary:
    stage = Path(temporary)
    (stage / "node_modules").symlink_to(dependencies, target_is_directory=True)
    (stage / "package.json").write_text('{"type":"module","private":true}\n')
    for source in [*probes.glob("*.test.tsx"), probes / "vitest.config.ts"]:
        content = source.read_text().replace("", f"{root}/")
        (stage / source.name).write_text(content)
    result = subprocess.run(
        ["./node_modules/.bin/vitest", "run", "--config", "vitest.config.ts", "--disableConsoleIntercept"],
        cwd=stage,
        check=False,
    )
    raise SystemExit(result.returncode)
