// #region repin-provider-builds — docs: docs/evidence/plans/2026-10-03-onboarding-and-plan.md#req-table
// The mechanical half of a provider re-pin (REQ-19 of the 2026-10-03 run).
//
// `check-provider-capability.mjs` fails when an installed CLI's build differs from the pinned one,
// and it is right to: a capability is a property of a version. But when EVERY current row about
// that provider is already `unverified` — a version-only observation — re-pinning carries no
// verdict forward and loses none; it is a version number and a date. That edit was being made by
// hand after every Claude Code self-update (2.1.286 → .287 → .288 in two days) and it stopped the
// workspace publication each time. This makes it a command.
//
// It REFUSES when any current row for the provider holds `supported` or `unsupported`: then the
// probes must be re-run, which is a person's work, and a script that re-pinned would be carrying
// yesterday's answer forward — the exact thing the gate exists to stop.
//
// Pure over the source text: the caller reads and writes the file. Every edit is matched exactly
// once or the whole repin refuses, so a changed file shape can never be half-edited.

/**
 * @param {string} source  providerCapabilityMatrix.ts
 * @param {{pinned: Record<string,string>, rows: {provider:string, cliBuild:string, status:string}[]}} matrix  the module's current values
 * @param {Record<string,string>} measured  provider → installed build
 * @param {string} today  YYYY-MM-DD
 * @returns {{ok: true, source: string, changed: string[]} | {ok: false, reason: string}}
 */
export function repinSource(source, matrix, measured, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return { ok: false, reason: `not a date: ${today}` }
  const changed = []
  let out = source
  for (const [provider, build] of Object.entries(measured)) {
    const pinned = matrix.pinned[provider]
    if (pinned === undefined) return { ok: false, reason: `${provider} is not pinned in the matrix` }
    if (pinned === build) continue
    const verdicts = matrix.rows.filter((r) => r.provider === provider && r.cliBuild === pinned && r.status !== 'unverified')
    if (verdicts.length)
      return { ok: false, reason: `${provider} ${pinned} has ${verdicts.length} verified row(s); re-run the probes instead of re-pinning` }
    const line = new RegExp(`(\\n\\s*'${provider}': ')${pinned.replace(/\./g, '\\.')}(')`)
    const hits = out.match(new RegExp(line.source, 'g'))?.length ?? 0
    if (hits !== 1) return { ok: false, reason: `the PINNED_BUILDS entry for ${provider} was found ${hits} times, expected once` }
    out = out.replace(line, `$1${build}$2`)
    changed.push(`${provider} ${pinned} → ${build}`)
  }
  if (!changed.length) return { ok: true, source, changed }
  const dated = [
    [/(\n\s*checkedAt: ')\d{4}-\d{2}-\d{2}(',)/, `$1${today}$2`],
    [/(version-only observation, )\d{4}-\d{2}-\d{2}(\))/, `$1${today}$2`],
    [
      /( \* Measured with `claude --version` \/ `codex --version`, )\d{4}-\d{2}-\d{2} \([^)]*\)\.?/,
      `$1${today} (${changed.join('; ')}; re-pinned by scripts/repin-provider-builds.mjs).`
    ]
  ]
  for (const [re, rep] of dated) {
    const n = out.match(new RegExp(re.source, 'g'))?.length ?? 0
    if (n !== 1) return { ok: false, reason: `a dated line was found ${n} times, expected once: ${re.source}` }
    out = out.replace(re, rep)
  }
  return { ok: true, source: out, changed }
}
// #endregion repin-provider-builds
