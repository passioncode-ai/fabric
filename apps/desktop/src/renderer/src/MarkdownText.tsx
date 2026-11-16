// #region markdown-text — docs: docs/evidence/plans/2026-11-15-quality-waves.md#w1--переписка-and-the-columns-nothing-runs-under-anything
/**
 * Markdown a person or an agent wrote (a task note, a board message), said as text instead of its raw marks
 * (W1 of the quality waves, ui UI-9; the screens wave of 2026-11-16). Paragraphs, line breaks, `-`/`*`/`1.` lists,
 * `#` headings as bold lines, fenced and inline code, **bold**, *italic* and [a link](address) as its words with the
 * address in the tooltip. No HTML is ever rendered: every piece is a React text node, so a body cannot inject markup.
 */
import React from 'react'

type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'h'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'code'; text: string }

const BULLET = /^\s{0,3}[-*+]\s+(.*)$/
const NUMBERED = /^\s{0,3}\d{1,3}[.)]\s+(.*)$/
const HEADING = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/
const FENCE = /^\s{0,3}(```|~~~)/

/** The body's blocks, in order. A fence left open runs to the end, as a reader expects. */
export function markdownBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const out: Block[] = []
  let para: string[] = []
  const flush = (): void => { if (para.length) out.push({ kind: 'p', lines: para }); para = [] }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (FENCE.test(line)) {
      flush()
      const body: string[] = []
      for (i++; i < lines.length && !FENCE.test(lines[i]); i++) body.push(lines[i])
      out.push({ kind: 'code', text: body.join('\n') })
      continue
    }
    if (!line.trim()) { flush(); continue }
    const h = HEADING.exec(line)
    if (h) { flush(); out.push({ kind: 'h', text: h[1] }); continue }
    const list = BULLET.exec(line) ? 'ul' : NUMBERED.exec(line) ? 'ol' : null
    if (list) {
      flush()
      const items: string[] = []
      for (; i < lines.length; i++) {
        const m = (list === 'ul' ? BULLET : NUMBERED).exec(lines[i])
        if (m) items.push(m[1])
        else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) items[items.length - 1] += ' ' + lines[i].trim()
        else break
      }
      i--
      out.push({ kind: list, items })
      continue
    }
    para.push(line)
  }
  flush()
  return out
}

// An underscore inside a word (`snake_case_name`) is the word's own, never emphasis.
const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*|(?<![\p{L}\p{N}_])__[^_\n]+__(?![\p{L}\p{N}_]))|(\*[^*\s][^*\n]*\*|(?<![\p{L}\p{N}_])_[^_\s][^_\n]*_(?![\p{L}\p{N}_]))|(\[[^\]\n]+\]\([^)\s]+\))/gu

/** One line's inline marks as React nodes; anything unmarked stays text. */
export function markdownInline(text: string, key = 'i'): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let last = 0
  let n = 0
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0
    if (at > last) out.push(text.slice(last, at))
    const k = `${key}-${n++}`
    const token = m[0]
    if (m[1]) out.push(<code key={k} className="md-code">{token.slice(1, -1)}</code>)
    else if (m[2]) out.push(<strong key={k}>{markdownInline(token.slice(2, -2), k)}</strong>)
    else if (m[3]) out.push(<em key={k}>{markdownInline(token.slice(1, -1), k)}</em>)
    else {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token)
      out.push(<span key={k} className="md-link" title={link?.[2]}>{link?.[1] ?? token}</span>)
    }
    last = at + token.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** A body's words without its marks, for a one-line preview (a thread's first words, a feed post): `**x**` is x,
 *  a list's bullets and a heading's hashes go, a link is its words, lines join with a space. */
export function plainWords(source: string): string {
  return source
    .replace(/^\s{0,3}(```|~~~).*$/gm, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}(?:[-*+]|\d{1,3}[.)])\s+/gm, '')
    .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/(?<![\p{L}\p{N}_])__([^_\n]+)__(?![\p{L}\p{N}_])/gu, '$1')
    .replace(/\*([^*\s][^*\n]*)\*/g, '$1')
    .replace(/(?<![\p{L}\p{N}_])_([^_\s][^_\n]*)_(?![\p{L}\p{N}_])/gu, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export function MarkdownText({ text, className }: { text: string; className?: string }): React.JSX.Element {
  const blocks = markdownBlocks(text)
  return (
    <div className={className ? `md ${className}` : 'md'}>
      {blocks.map((b, i) => {
        const k = `b${i}`
        if (b.kind === 'code') return <pre key={k} className="md-pre">{b.text}</pre>
        if (b.kind === 'h') return <p key={k} className="md-h"><strong>{markdownInline(b.text, k)}</strong></p>
        if (b.kind === 'ul' || b.kind === 'ol') {
          const List = b.kind
          return <List key={k}>{b.items.map((item, j) => <li key={j}>{markdownInline(item, `${k}-${j}`)}</li>)}</List>
        }
        return (
          <p key={k}>
            {b.lines.map((line, j) => (
              <React.Fragment key={j}>{j > 0 && <br />}{markdownInline(line, `${k}-${j}`)}</React.Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
// #endregion markdown-text
