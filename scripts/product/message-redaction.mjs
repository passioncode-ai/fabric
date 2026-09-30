// Prototype examples only. Native ingestion needs provider-aware redaction,
// secret classification and a separate sensitive-data policy before persistence.
export function redactFixtureMessage(value) {
 return String(value??'')
  .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi,'Bearer [скрыто]')
  .replace(/\b(?:sk-|ghp_|github_pat_|xox[baprs]-)[A-Za-z0-9_-]{8,}/g,'[скрыто]')
  .replace(/\b(api[_ -]?key|access[_ -]?token|refresh[_ -]?token|password|secret)\s*[:=]\s*(?:"[^"\n]+"|'[^'\n]+'|[^\s,;]+)/gi,'$1=[скрыто]')
}
