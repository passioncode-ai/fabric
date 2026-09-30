// A lazy directory listing. main does the reading (files.ts); this only asks
// for one level at a time, so a repository with a huge tree costs one call per
// folder the operator actually opens.

import { useEffect, useState } from 'react'
import type { FileNode } from '../../../shared/types'
import { useT } from '../i18n'
import { Caret } from './Caret'
import { EmptyState } from './EmptyState'

export function FileTree({ root }: { root: string | null }): React.JSX.Element {
  const t = useT()
  if (!root) return <EmptyState read>{t('files.empty')}</EmptyState>
  return <Level key={root} dir={root} depth={0} />
}

function Level({ dir, depth }: { dir: string; depth: number }): React.JSX.Element {
  const t = useT()
  const [entries, setEntries] = useState<FileNode[] | null>(null)
  const [truncated, setTruncated] = useState(0)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set())

  useEffect(() => {
    window.fabric.files
      .list(dir)
      .then((r) => {
        setEntries(r.entries)
        setTruncated(r.truncated)
      })
      .catch(() => setFailed(true))
  }, [dir])

  if (failed) return <EmptyState read>{t('files.error')}</EmptyState>
  // Children is required even here: the component's contract is that a surface
  // knows what "empty" says BEFORE it has read, which is what stops the empty
  // copy from being written after the fact (M108).
  if (!entries)
    return (
      <EmptyState read={false} waiting={t('app.loading')}>
        {t('files.empty')}
      </EmptyState>
    )

  return (
    <ul className="file-tree" style={{ paddingInlineStart: depth === 0 ? 0 : undefined }}>
      {entries.map((e) => (
        <li key={e.path}>
          {e.isDirectory ? (
            <>
              <button
                className="file-row dir"
                onClick={() =>
                  setOpen((old) => {
                    const next = new Set(old)
                    if (next.has(e.path)) next.delete(e.path)
                    else next.add(e.path)
                    return next
                  })
                }
              >
                <Caret open={open.has(e.path)} />
                <span className="mono">{e.name}</span>
              </button>
              {open.has(e.path) && <Level dir={e.path} depth={depth + 1} />}
            </>
          ) : (
            <button
              className="file-row file"
              onClick={() => void window.fabric.windows.openFile(e.path)}
            >
              <Caret open={false} />
              <span className="mono">{e.name}</span>
            </button>
          )}
        </li>
      ))}
      {truncated > 0 && <li className="muted">{t('files.more', { count: truncated })}</li>}
    </ul>
  )
}
