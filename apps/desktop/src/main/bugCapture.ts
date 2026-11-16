// #region bug-tracker — docs: docs/reports/2026-11-15-quality-audit/2026-11-15-bug-tracker-design.md#35-fingerprint-and-dedup
/**
 * The bug store's wiring (W4 of the quality waves, wave 1; moved out of index.ts on 2026-11-16). Every failure the
 * operations log records with an error folds into its fingerprint in `userData/bugs.json`, written once a minute when
 * it changed and at quit. A helper process (GPU, network, utility) that crashes is recorded as `crash.<type>`, never
 * during a quit, where ending them is the quit's own work; native dumps stay on this machine (`uploadToServer: false`,
 * §3.9). Nothing leaves the machine.
 */
import { createBugStore } from './bugStore.ts'

export interface BugCaptureDeps {
  file: string
  version(): string
  app: { on(event: 'child-process-gone', listener: (e: unknown, details: { type: string; reason: string; exitCode: number; name?: string }) => void): unknown }
  crashReporter: { start(options: { uploadToServer: boolean; compress: boolean }): void }
  quitting(): boolean
  onQuit(f: () => void): void
  failed(op: string, e: Error, detail: Record<string, unknown>): void
}

export interface BugCapture {
  /** The operations log's observer: a failed record with its error becomes a row of the store. */
  observe(op: string, outcome: string, failure?: { error: unknown; correlationId: string }): void
}

export function startBugCapture(deps: BugCaptureDeps): BugCapture {
  const bugs = createBugStore(deps.file)
  const flush = setInterval(() => bugs.flush(), 60_000)
  flush.unref()
  deps.onQuit(() => { clearInterval(flush); bugs.flush() })
  deps.crashReporter.start({ uploadToServer: false, compress: true })
  deps.app.on('child-process-gone', (_e, details) => {
    if (deps.quitting() || details.reason === 'clean-exit' || details.reason === 'killed') return
    deps.failed(`crash.${details.type.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, new Error(details.reason), { exitCode: details.exitCode, name: details.name ?? null })
  })
  return {
    observe(op, outcome, failure) {
      if (failure && outcome === 'failed') bugs.record({ cls: op.startsWith('crash.') ? 'crash' : 'error', code: op, error: failure.error, version: deps.version(), correlationId: failure.correlationId })
    }
  }
}
// #endregion bug-tracker
