// Looking at what the program did, without opening a terminal (M81).
//
// "Help us find the problem" is not a request to open a log file. Before this
// the only way to see why something failed was a `console.error` in a stream a
// packaged app does not have — so for the operator, the failure had no evidence
// at all.
//
// It shows ERRORS FIRST by default. A log opened at level `debug` is a wall, and
// the person opening it is looking for the thing that went wrong.

import { useEffect, useState } from 'react'
import type { DiagnosticsView } from '../../shared/types'
import type { OpsLevel } from '../../shared/opsLog'
import { Banner, Button, EmptyState, Panel, Row, Toolbar } from './components'
import { useT } from './i18n'

export function DiagnosticsSection(): React.JSX.Element {
  const t = useT()
  const [level, setLevel] = useState<OpsLevel>('warn')
  const [view, setView] = useState<DiagnosticsView | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  /**
   * WHICH BUILD THIS IS (S07). Nothing in the application said so, so a defect
   * report could not name what was running and nobody could ask. It belongs
   * here rather than on a marketing "About": this is the panel a person opens
   * when something is wrong, and the first question anyone asks them is which
   * version they are on.
   */
  const [meta, setMeta] = useState<Awaited<ReturnType<Window['fabric']['meta']['info']>> | null>(
    null
  )

  useEffect(() => {
    let alive = true
    void window.fabric.meta.info().then(
      (m) => alive && setMeta(m),
      // A build that cannot describe itself still reports the diagnostics
      // below; losing the log because the manifest read failed would trade the
      // thing the operator came for against the label on it.
      () => {}
    )
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let alive = true
    void window.fabric.diagnostics.read({ level, limit: 200 }).then(
      (v) => alive && setView(v),
      (e: unknown) => alive && setProblem(e instanceof Error ? e.message : String(e))
    )
    return () => {
      alive = false
    }
  }, [level])

  return (
    <Panel id="sec-diagnostics" title={t('diagnostics.title')}>
      <p className="muted">{t('diagnostics.lede')}</p>

      {/* The build, and its compatibility with this estate. Both, because the
          second is the one that explains a refusal the operator is looking at. */}
      {meta && (
        <p className="muted">
          <span className="mono">{meta.buildLine.short}</span> — {meta.buildLine.says}
          {meta.compatibility.compatibility !== 'compatible' && (
            <>
              {' · '}
              <span className="mono">{meta.compatibility.reasonCode}</span>:{' '}
              {meta.compatibility.says}
            </>
          )}
        </p>
      )}

      <Toolbar align="end">
        {(['error', 'warn', 'info', 'debug'] as OpsLevel[]).map((l) => (
          <Button key={l} tone={l === level ? 'primary' : 'ghost'} onClick={() => setLevel(l)}>
            {t(`diagnostics.level.${l}` as 'diagnostics.level.error')}
          </Button>
        ))}
      </Toolbar>

      {problem && <Banner tone="error">{t('diagnostics.unreadable', { reason: problem })}</Banner>}

      {view && view.records.length === 0 && (
        <EmptyState read>{t('diagnostics.nothing')}</EmptyState>
      )}

      {view?.records
        .slice()
        .reverse()
        .map((r, i) => (
          <Row
            key={`${r.at}:${i}`}
            lead={<span className="mono">{r.op}</span>}
            trail={
              <span className="muted">
                {r.ms !== undefined ? `${r.ms}ms · ` : ''}
                {r.at.slice(11, 19)}
              </span>
            }
          >
            {/* The reason, and the correlation id — which is what turns a list
                you can read into a list you can search. */}
            {r.error ? `${r.error.name}: ${r.error.message}` : r.outcome}
            <span className="muted mono"> · {r.correlationId.slice(0, 8)}</span>
          </Row>
        ))}

      {view?.file && <p className="muted mono">{view.file}</p>}
    </Panel>
  )
}
