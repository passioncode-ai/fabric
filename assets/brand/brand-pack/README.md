# PassionCode.ai graphical brand pack

Raster exports of the canonical passion-fruit mark. The vector source remains
[`../favicon/source/passioncode-passion-fruit.svg`](../favicon/source/passioncode-passion-fruit.svg);
do not edit PNG or JPG files directly.

## Contents

| Directory | Format | Canvas | Sizes |
|---|---|---|---|
| `png/transparent/` | PNG | transparent | 1024, 512, 256, 128, 64 px |
| `png/dark/` | PNG | `#0A0A0A` | 1024, 512, 256, 128, 64 px |
| `png/white/` | PNG | `#FFFFFF` | 1024, 512, 256, 128, 64 px |
| `jpg/dark/` | JPG | `#0A0A0A` | 1024, 512, 256, 128, 64 px |
| `jpg/white/` | JPG | `#FFFFFF` | 1024, 512, 256, 128, 64 px |
| `preview/` | PNG + JPG | dark presentation board | 1920 × 1080 px |

The separate [`../social/`](../social/) package contains the approved 1200×630
Open Graph/GitHub social card in SVG, PNG and JPG.

JPG cannot preserve transparency, so it is intentionally exported only on dark
and white full-canvas backgrounds. PNG is the preferred production format when
transparency or lossless edges are required.

`manifest.json` records the canonical source checksum, export dimensions,
backgrounds and checksums for all raster files.

## Rebuild and verify

Raster generation uses macOS `sips`. Verification is portable and uses Node.js
only.

```bash
node scripts/build-brand-icons.mjs --check
node scripts/build-brand-pack.mjs
node scripts/build-brand-pack.mjs --check
```
