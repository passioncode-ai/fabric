# Fabric app icon

The PassionCode.ai mark ([source](../favicon/source/passioncode-passion-fruit.svg)) composed on a graphite
macOS tile — Apple's 1024 grid, 824 × 824 at (100, 100), corner radius 185, transparent corners, a soft
tile shadow, a faint magenta glow behind the mark. Chosen by the operator on 2026-10-03
([ADR-0100](../../../docs/adr/0100-first-run-and-start-paths.md) §8) over four Asset Foundry candidates
that did not keep the mark (job `job_01M3ZC9B3DYDH7ECV6ECECD45T`, cancelled).

| File | What it is |
|---|---|
| `fabric-icon.svg` | the source — edit this |
| `fabric-icon-1024.png` | its render; never edit by hand |
| `manifest.json` | binds the PNG to the SVG and the mark by SHA-256 |

```sh
node scripts/build-app-icon.mjs          # render (Electron offscreen, transparent) and write the manifest
node scripts/build-app-icon.mjs --check  # the render still matches the SVG (run by scripts/ci.sh)
node scripts/stage-app-icon.mjs          # copy it to apps/desktop/build/icon.png for electron-builder
```
