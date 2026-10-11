// #region smoke-platform-verdict — docs: docs/evidence/plans/2026-10-10-windows-linux-port.md#req-table
// What a SMOKE run's output means (0.3.5, REQ-03). The causes a Windows runner may legitimately end on are the
// stack's own: it has no Docker that runs Linux containers. Everything else — a crash, a hang, an unknown cause, a
// schema or identity refusal — is a failure of the package, whatever the expectation.
export const STACK_CAUSES = Object.freeze(['supabase-cli-missing', 'stack-would-not-start', 'stack-start-timed-out', 'stack-up-but-silent', 'database-unreachable'])

export function smokeVerdict({ output, code, signal, expect }) {
  const ok = /^SMOKE OK\b/m.test(output)
  const failed = /^SMOKE FAILED \(([a-z-]+)\)/m.exec(output)?.[1] ?? null
  if (ok && code === 0) return { pass: true, why: 'SMOKE OK: the app booted end to end' }
  if (expect === 'ok') return { pass: false, why: failed ? `expected SMOKE OK, the app stopped on ${failed}` : `expected SMOKE OK, got no verdict (exit ${code}${signal ? `, ${signal}` : ''})` }
  if (failed && STACK_CAUSES.includes(failed)) return { pass: true, why: `the app started and named its stack's absence (${failed})` }
  if (failed) return { pass: false, why: `the app stopped on ${failed}, not on the stack` }
  return { pass: false, why: `the app gave no SMOKE verdict (exit ${code}${signal ? `, ${signal}` : ''}): a crash or a hang` }
}
// #endregion smoke-platform-verdict
