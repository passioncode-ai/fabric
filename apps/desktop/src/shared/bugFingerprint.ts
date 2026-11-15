// #region bug-tracker — docs: docs/reports/2026-11-15-quality-audit/2026-11-15-bug-tracker-design.md#35-fingerprint-and-dedup
// The parts of a bug's fingerprint (W4 of the quality waves, wave 1, the bug tracker's §3.5). The same bug with other
// numbers, ids, paths or versions gives one template and one set of frames; nothing in them names a person, a path, an
// address or a secret, and the template is only ever hashed on its way out of the machine.

const MAX_TEMPLATE = 200

/** The message with what varies between two occurrences of one bug replaced by placeholders, lowercased, cut at 200. */
export function messageTemplate(message: string): string {
  return message
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<url>')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '<email>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<id>')
    .replace(/(?:~|[A-Za-z]:)?(?:[\\/][^\s\\/'"`:,;()]+){2,}[\\/]?/g, '<path>')
    .replace(/(["'`])(?:(?!\1).){0,200}\1/g, '<s>')
    .replace(/\b(?:sk|pk|ghp|gho|cak|key|tok|xox[abp])[-_][A-Za-z0-9_-]{8,}\b/gi, '<secret>')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '<secret>')
    .replace(/\b(?:0x)?[0-9a-f]{6,}\b/gi, '<hex>')
    .replace(/\d+(?:\.\d+)*/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, MAX_TEMPLATE)
}

/** The first three named frames of a V8 stack (anonymous and the runtime's own skipped), top first. */
export function frameNames(stack: string | undefined): string[] {
  if (!stack) return []
  const names: string[] = []
  for (const line of stack.split('\n')) {
    const m = /^\s*at (?:async )?([^\s(]+) \(/.exec(line)
    if (!m) continue
    const name = m[1]
    if (name === '<anonymous>' || name.startsWith('process.') || name.startsWith('node:') || name === 'new Promise') continue
    names.push(name)
    if (names.length === 3) break
  }
  return names
}

/** The bytes a fingerprint hashes: class, code, error name, template and frames; never the version, time or session. */
export function fingerprintInput(input: { cls: string; code: string; errorName: string; message: string; stack?: string }): string {
  return ['fabric-bug/1', input.cls, input.code, input.errorName, messageTemplate(input.message), frameNames(input.stack).join('>')].join('|')
}
// #endregion bug-tracker
