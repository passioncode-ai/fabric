# N-020 bounded unsettled adapter I/O evidence

Candidate: `d4ae7a295ec0c7a146c34e4b3afc6f52763a238a`; base:
`e42366eb02a7ad602fd7382345642b0bd03949a5`. This directory preserves
builder checks, not independent review or production acceptance. Source hashes,
commands, exit codes, limitations and normalization metadata are in
[receipt.json](receipt.json). [receipt-original.json](receipt-original.json)
is the byte-exact original receipt; its log hashes describe the original local
bytes, whereas the normalized receipt hashes describe these stored files.
No historical candidate was rewritten when this evidence was committed.

Run from the repository root with the candidate source and its recorded tests:

```sh
node --experimental-strip-types docs/reports/2026-10-13-resource-admission-contract/raw/n020/repro-portable.mjs
node --experimental-strip-types --import ./docs/reports/2026-10-13-resource-admission-contract/raw/n020/negative-loader-portable.mjs docs/reports/2026-10-13-resource-admission-contract/raw/n020/repro-portable.mjs
node --experimental-strip-types --import ./docs/reports/2026-10-13-resource-admission-contract/raw/n020/negative-loader-portable.mjs --test --test-name-pattern='one outstanding entry|pending operation blocks' apps/desktop/test/resource-launch-adapter.test.mjs
```

The reproduction is descriptive and exits 0 for both variants: six repeated
calls leave six actual dependencies pending before the fix and one after it,
for each of currentness, cancellation and release. The negative loader replaces
only the actual adapter source with [before.ts](before.ts), keeping its module
URL and normal relative imports; the seven regression tests then fail (exit 1).
The fixed adapter plus existing R6 suite passed 67 tests. The managed-launch
legacy check and targeted strict TypeScript check exited 0. These use synthetic
local dependencies; no SQL, native process, provider, installation or activation
was exercised. A timeout still cannot cancel the underlying operation.
