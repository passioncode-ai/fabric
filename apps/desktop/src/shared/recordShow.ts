// #region record-show-delivery — docs: docs/ux/scenarios.md#scn-188-show-the-ceo-what-you-mean
/**
 * «Записать показ» and «Снимок» (SCN-188): the owner shows the screen and talks, `scripts/record-show` turns each
 * chunk of 45 seconds into context (speech with times, key frames, the cursor and clicks) and each screenshot into a
 * file, and Fabric delivers each piece as soon as it is ready: into the CEO conversation (a voice call included) or as
 * a note on a task. This module is the pure part: which pieces of a session folder are due, the paths rewritten for
 * the CEO's inbox, and the words that go with them. The processes live in `main/recordShow.ts`.
 */

/** Where a session's pieces go: the CEO conversation, or a task by its id. */
export type RecordShowTarget = 'ceo' | `task:${string}`

export interface RecordShowState {
  /** The recorder is shipped with this build and runnable (macOS only). */
  available: boolean
  recording: boolean
  startedAt: string | null
  deliver: RecordShowTarget | null
  chunksReady: number
}

export type RecordShowRefusal = 'permission-screen' | 'permission-microphone' | 'already' | 'not-recording' | 'failed' | 'unavailable' | 'cancelled'

export type RecordShowAnswer = { ok: true; state: RecordShowState } | { ok: false; reason: RecordShowRefusal; message: string; state: RecordShowState }

/** A piece Fabric has just delivered: the renderer tells a live voice call about it. */
export interface RecordShowDelivered {
  kind: 'chunk' | 'shot'
  to: RecordShowTarget
  /** 0-based chunk number. */
  index?: number
  /** What the owner said in that chunk, joined and cut to a few sentences. */
  said?: string
  start?: number
  end?: number
}

export interface RecordShowEvent {
  state: RecordShowState
  delivered?: RecordShowDelivered
}

export const IDLE_STATE: RecordShowState = { available: false, recording: false, startedAt: null, deliver: null, chunksReady: 0 }

export function isTarget(value: unknown): value is RecordShowTarget {
  return value === 'ceo' || (typeof value === 'string' && /^task:[0-9a-f-]{8,64}$/i.test(value))
}

/** The script's exit code into a refusal (`scripts/record-show/README.md#permissions`). */
export function refusalOf(code: number | null): RecordShowRefusal {
  switch (code) {
    case 3: return 'permission-screen'
    case 4: return 'permission-microphone'
    case 5: return 'already'
    case 7: return 'not-recording'
    default: return 'failed'
  }
}

export interface ShotEntry { at: number; file: string; mode?: string; deliver?: string; near?: string[] }

export interface SessionListing {
  /** The session folder's name. */
  name: string
  /** `session.json`'s `deliver`. */
  deliver: string | null
  /** `chunk-NNN.md` files present. */
  chunkFiles: readonly string[]
  shots: readonly ShotEntry[]
  /** Keys already delivered (`chunk-000.md`, `shot:shots/….png`). */
  delivered: readonly string[]
}

export interface DuePiece {
  key: string
  kind: 'chunk' | 'shot'
  to: RecordShowTarget
  /** Path relative to the session folder. */
  file: string
  index?: number
}

/**
 * The pieces of one session that are ready and not yet delivered, oldest first. Chunks go to the session's target;
 * a screenshot to its own (`shot --to`) or, without one, to the session's.
 */
export function duePieces(s: SessionListing): DuePiece[] {
  const done = new Set(s.delivered)
  const due: DuePiece[] = []
  if (isTarget(s.deliver)) {
    for (const f of [...s.chunkFiles].sort()) {
      const m = /^chunk-(\d{3,})\.md$/.exec(f)
      if (m && !done.has(f)) due.push({ key: f, kind: 'chunk', to: s.deliver, file: f, index: Number(m[1]) })
    }
  }
  for (const shot of [...s.shots].sort((a, b) => a.at - b.at)) {
    const to = shot.deliver ?? s.deliver
    const key = `shot:${shot.file}`
    if (isTarget(to) && !done.has(key) && /^shots\/[\w.-]+\.png$/.test(shot.file)) due.push({ key, kind: 'shot', to, file: shot.file })
  }
  return due
}

/** The frames and shots a chunk's markdown names (`frames/…jpg`, `shots/…png`), each once, in order. */
export function referencedFiles(md: string): string[] {
  return [...new Set([...md.matchAll(/\b(?:frames|shots)\/[\w.-]+\.(?:jpg|png)\b/g)].map((m) => m[0]))]
}

/** A file's flat name in the CEO inbox: the session and its own name, nothing that reads as a path. */
export function inboxFileName(session: string, rel: string): string {
  return `show-${session}-${rel.replace(/\//g, '-')}`.replace(/[^\w.-]+/g, '-').slice(0, 160)
}

/** The markdown with every frame and shot pointing at its absolute copy. */
export function rewritePaths(md: string, absolute: (rel: string) => string): string {
  return md.replace(/\b(?:frames|shots)\/[\w.-]+\.(?:jpg|png)\b/g, (rel) => absolute(rel))
    .replace(/Пути к кадрам и снимкам даны от папки этого файла; /, 'Пути к кадрам и снимкам полные; ')
}

const clock = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** The line typed into the CEO console with a piece (its file is named by `ceoLine` as an attachment). */
export function ceoText(p: { kind: 'chunk' | 'shot'; index?: number; start?: number; end?: number }, locale: string): string {
  const en = locale === 'en'
  if (p.kind === 'shot')
    return en
      ? 'A screenshot from the owner: open it and keep it in mind for what they say next.'
      : 'Снимок экрана от владельца: открой его и держи в голове, о чём он говорит дальше.'
  const span = p.start !== undefined && p.end !== undefined ? ` (${clock(p.start)}–${clock(p.end)})` : ''
  return en
    ? `Part ${(p.index ?? 0) + 1} of the owner's screen show${span}: read the file whole and open its frames before you answer; it says what they said, where the cursor was and what they clicked.`
    : `Показ владельца, кусок ${(p.index ?? 0) + 1}${span}: прочти файл целиком и открой кадры, прежде чем отвечать; там сказанное, где был курсор и куда нажимал.`
}

/** What a live voice call hears about a delivered piece: short, with the owner's own words when there are any. */
export function callText(d: RecordShowDelivered, locale: string): string {
  const en = locale === 'en'
  if (d.kind === 'shot')
    return en
      ? '[Screen show] The owner took a screenshot; the CEO has it. Say in one short phrase that it arrived.'
      : '[Показ] Владелец сделал снимок экрана, он уже у CEO. Скажи одной короткой фразой, что снимок получен.'
  const said = d.said?.trim() ? (en ? ` They said: «${d.said.trim()}».` : ` Сказано: «${d.said.trim()}».`) : ''
  return en
    ? `[Screen show] Part ${(d.index ?? 0) + 1} of the owner's show reached the CEO.${said} Say in one short phrase what you understood, quoting the owner.`
    : `[Показ] Кусок ${(d.index ?? 0) + 1} показа владельца уже у CEO.${said} Скажи одной короткой фразой, что понял, процитировав владельца.`
}

/** The owner's words of one chunk from `manifest.json`, joined and cut to at most `max` characters. */
export function saidIn(manifest: unknown, index: number, max = 300): string {
  const items = (manifest as { items?: Array<{ kind?: string; index?: number; lines?: Array<{ text?: string }> }> })?.items ?? []
  const chunk = items.find((i) => i.kind === 'chunk' && i.index === index)
  const text = (chunk?.lines ?? []).map((l) => String(l.text ?? '').trim()).filter(Boolean).join(' ')
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/** A task note's body: the chunk's markdown with absolute paths, within the note's size. */
export function noteBody(md: string, max = 60_000): string {
  return md.length > max ? `${md.slice(0, max)}\n\n…` : md
}
// #endregion record-show-delivery
