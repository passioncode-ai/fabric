# PassionCode.ai favicon family

The canonical artwork is
[`source/passioncode-passion-fruit.svg`](source/passioncode-passion-fruit.svg).
It uses one 1024-unit geometry for every export so a size label cannot become a
second drawing of the mark.

## Export matrix

| Directory | Canvas |
|---|---|
| `transparent/` | transparent |
| `dark/` | full-canvas Paperclip coal, `#0A0A0A` |
| `white/` | full-canvas white, `#FFFFFF` |

Each directory contains `1024`, `512`, `256`, `128` and `64` pixel SVGs. The
dark and white files add exactly one canvas-sized rectangle behind the shared
artwork. They do not add a shaped tile, keyline or shadow.

Rebuild and verify from the repository root:

```bash
node scripts/build-brand-icons.mjs
node scripts/build-brand-icons.mjs --check
```

Do not edit generated size or background variants directly. Change the master,
rebuild the matrix and inspect every background at every size.
