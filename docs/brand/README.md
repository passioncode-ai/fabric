Contract: brand-contract v1

# PassionCode.ai brand pack

This directory is the source of truth for how the PassionCode.ai toolkit, Fabric and Switchboard speak on
public surfaces. Product behaviour remains in [`../ux/`](../ux/); architecture and
decisions remain in [`../architecture/`](../architecture/) and
[`../adr/`](../adr/).

| File | Owns |
|---|---|
| [`voice.md`](voice.md) | voice, narrative, invariants and failure mode |
| [`ui.md`](ui.md) | visual identity, icon construction and product/brand colour boundary |
| [`terminology.md`](terminology.md) | preferred product language and exact entity names |
| [`facts.md`](facts.md) | public claims and their evidence |
| [`channels.md`](channels.md) | register and constraints for each active surface |
| [`strings.md`](strings.md) | user-interface string decisions; empty until implementation exists |
| [`locales/`](locales/) | locale-specific choices without changing meaning |

Only declared public surfaces are scanned. Internal architecture and evidence files
are not marketing sources and must not leak into public copy by accident.

Sources:
  marketing: docs/public/*.md docs/guides/*.md

Run the pack check from the repository root:

```bash
python3 docs/brand/lint.py
```

The project accepts two narrow mechanical exceptions: the operator-approved positioning
contains an em dash, and the canonical entity name `Agent` may exceed the generic token
density heuristic in a page that defines the product model. All other findings remain
blocking.
