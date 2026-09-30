# Renderer fault reproduction, 2026-09-09

Run against a checkout at `d28c321ccca8c4ef0e803ebea5b7ba056e88bc5d` with its existing pnpm dependencies installed. The probes mock IPC and write no estate/database/product state.

From that checkout's `apps/desktop` directory:

```sh
./node_modules/.bin/vitest run --config /absolute/path/to/this-evidence/vitest.config.mjs
```

The config resolves the desktop package from the current working directory (override with `FABRIC_AUDIT_DESKTOP`). Keep the config beside `reader-probes.test.tsx`.

`reader-probes.log` records 2/2 **defect reproductions** passing. A pass proves the defect is present, not that the product is correct. These are audit evidence; implementation should invert each expected bad behavior into a regression assertion in the owning test suite.

1. A→B TaskPage route switches title but retains A's uncontrolled brief text; blur writes A's text to B.
2. Digest feedMark refresh invokes `digest.seen` without leaving the component.

The first command used /tmp alias and failed import before any tests. Canonical /private/tmp and then portable artifact-directory configuration run successfully. No native renderer, PTY, screen reader or browser result is implied.
