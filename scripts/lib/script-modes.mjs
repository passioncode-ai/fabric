// PL-8 of the 0.3.23 review, iteration 2: a script CI runs directly (`./scripts/ci.sh fast` in ci.yml) must keep its
// executable bit in git, or the hosted run fails before any gate does (PL-1 of iteration 1 found ci.sh at 100644).

/** Paths a workflow runs as `./<path>` in the command's own place (a line's or `run:`'s first word, or after `;`, `&&`,
 *  `||`, `|` or `(`), read from its text; `node ./x.mjs` passes the path to an interpreter and is not one. */
export function directlyRun(workflowText) {
  const found = []
  for (const m of workflowText.matchAll(/(?:^|run:|[;&|(])[ \t]*\.\/([\w.\/-]+)/gm)) {
    const p = m[1].replace(/^\.\//, '')
    if (!found.includes(p)) found.push(p)
  }
  return found
}

/** Parses `git ls-files -s` output into a map of path to mode. */
export function modesOf(lsFiles) {
  const modes = new Map()
  for (const line of lsFiles.split('\n')) {
    const m = line.match(/^(\d{6}) [0-9a-f]+ \d+\t(.+)$/)
    if (m) modes.set(m[2], m[1])
  }
  return modes
}

/** The problems: each required path that git does not track as 100755. `required` is the shell scripts under `scripts/`
 *  and every path a workflow runs directly. */
export function modeProblems(modes, workflowPaths) {
  const problems = []
  const shell = [...modes.keys()].filter((p) => /^scripts\/[^/]+\.sh$/.test(p))
  for (const p of [...new Set([...shell, ...workflowPaths])].sort()) {
    const mode = modes.get(p)
    if (mode === undefined) problems.push(`${p} is run directly by a workflow and is not tracked`)
    else if (mode !== '100755') problems.push(`${p} is tracked as ${mode}, not 100755`)
  }
  return problems
}
