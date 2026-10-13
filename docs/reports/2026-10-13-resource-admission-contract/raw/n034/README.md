# N034 source-bound storage evidence

Author candidate and its rejected original are preserved as exact `.snapshot.txt`
files. Logs normalize owned temporary paths; manifest retains both original and
stored SHA-256. Dependency snapshots support local replay without installation.

`node replay.mjs` runs the three correction controls. `node replay.mjs --rejected`
runs the same controls against initial source76189 and is expected to exit1.
`node replay.mjs --full` runs all25 focused real-filesystem tests. Replaying this
package is packaging validation, not a new independent review. No provider, native
agent or DB call is made. The optional source environment override points only at
an owned restored temporary source tree.

The first17/19 diagnostic is unpinned; two setup deadline failures are retained.
The later22 assertions passed but process exit1 exposed real unclosed FileHandle
GC errors. Neither is acceptance. Corrected25/25 plus a clean exit0 is author
focused evidence, separate from independent reviewer evidence in `independent/receipt.json`. The independent reviewer accepted the corrected storage scope and ran two unchanged actual-FS controls against both source versions. Packaging replay ran the restored correction controls: current exit0, rejected exit1. This is an author packaging check, not independent acceptance.

All production results remain incomplete and deny execution authority. No current
N031 producer integration, native retirement, pool activation or global capacity
claim is made. Root owns integration, graph, full gates and publication.
