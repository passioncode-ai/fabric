// #region ceo-windows-ports — docs: docs/adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md#amendment-3-2026-11-19-the-ceo-closes-and-arranges-windows-and-opens-dashboards
/**
 * The windows the CEO closes and arranges (board requests 26989d91, 07db5c30, 374f27bf; the owner, 2026-11-19): Fabric's
 * own windows through Electron, and Fabric Dashboards' window, another app's, through macOS's System Events. Closing a
 * console's window here is the same as the person closing it: the session's process lives in the main process
 * (`pty.ts`) and runs on, and opening it again shows its kept screen.
 *
 * What is NOT here: a second way to start or stop a session. `ceoTools.ts` decides; this only moves windows.
 */
import { execFile } from 'node:child_process'
import type { CeoDashboard, CeoDashboardsPort, CeoDashboardsWindow, CeoPlacement, CeoWindow, CeoWindowsPort } from './ceoTools.ts'
import type { DisplayLike, Rect } from '../shared/windowLayout.ts'

/** What this module needs of an Electron window, so the tests pass plain objects. */
export interface WindowLike {
  isDestroyed(): boolean
  getBounds(): Rect
  setBounds(r: Rect): void
  getTitle(): string
  isFullScreen(): boolean
  setFullScreen(v: boolean): void
  isMinimized(): boolean
  restore(): void
  isFocused(): boolean
  show(): void
  focus(): void
  close(): void
  destroy?(): void
  once?(event: 'leave-full-screen', fn: () => void): void
  removeListener?(event: 'leave-full-screen', fn: () => void): void
}

export interface WindowsPortDeps {
  main(): WindowLike | null
  ceo(): WindowLike | null
  sessions(): ReadonlyMap<string, WindowLike>
  files(): ReadonlyMap<string, WindowLike>
  displays(): Array<DisplayLike & { label: string }>
  openMain(): void
  openCeo(): void
  openSession(sessionId: string): void
}

const live = (w: WindowLike | null | undefined): w is WindowLike => !!w && !w.isDestroyed()

export function createWindowsPort(d: WindowsPortDeps): CeoWindowsPort {
  const row = (kind: CeoWindow['kind'], subject: string | null, w: WindowLike): CeoWindow => ({
    kind, subject, title: w.getTitle(), bounds: w.getBounds(), fullScreen: w.isFullScreen(), minimized: w.isMinimized(), focused: w.isFocused()
  })
  const find = (kind: 'main' | 'ceo' | 'session', subject: string | null): WindowLike | null => {
    const w = kind === 'main' ? d.main() : kind === 'ceo' ? d.ceo() : subject ? d.sessions().get(subject) ?? null : null
    return live(w) ? w : null
  }
  return {
    list() {
      const out: CeoWindow[] = []
      const m = d.main(); if (live(m)) out.push(row('main', null, m))
      const c = d.ceo(); if (live(c)) out.push(row('ceo', null, c))
      for (const [id, w] of d.sessions()) if (live(w)) out.push(row('session', id, w))
      for (const [file, w] of d.files()) if (live(w)) out.push(row('editor', file, w))
      return out
    },
    displays: () => d.displays(),
    closeSession(sessionId) {
      const w = d.sessions().get(sessionId)
      if (!live(w)) return false
      w.close()
      // ER-13: a console window has no unload handler, so it closes; one whose renderer hangs is destroyed after a
      // moment. Either way only the window goes: the session's process lives in the main process.
      if (w.destroy) setTimeout(() => { if (!w.isDestroyed()) w.destroy!() }, 1500).unref?.()
      return true
    },
    open(kind, subject) {
      if (kind === 'main') d.openMain()
      else if (kind === 'ceo') d.openCeo()
      else if (subject) d.openSession(subject)
    },
    place(kind, subject, to: CeoPlacement) {
      const w = find(kind, subject)
      if (!w) return false
      if (w.isMinimized()) w.restore()
      // ER-1: the CEO window is the main window's child and moves with it; moving main puts it back where it was.
      const child = kind === 'main' ? d.ceo() : null
      const childAt = live(child) ? child.getBounds() : null
      if ('fullScreen' in to) {
        w.setFullScreen(true)
      } else if (w.isFullScreen()) {
        // macOS animates out of full screen; a size set before it ends is lost. A transition that never comes (another
        // Space) drops the listener after a few seconds rather than applying old bounds later (ER-11).
        // The CEO child goes back once main has moved, not before (ER-15).
        const apply = () => { if (!w.isDestroyed()) w.setBounds(to.bounds); if (childAt && live(child)) child.setBounds(childAt) }
        if (w.once) {
          w.once('leave-full-screen', apply)
          setTimeout(() => w.removeListener?.('leave-full-screen', apply), 4000).unref?.()
        }
        w.setFullScreen(false)
        if (!w.once) apply()
      } else w.setBounds(to.bounds)
      if (childAt && live(child)) child.setBounds(childAt)
      w.show()
      w.focus()
      return true
    }
  }
}

/** Fabric Dashboards' process name, as System Events names it (`/Applications/Fabric Dashboards.app`). */
export const DASHBOARDS_PROCESS = 'Fabric Dashboards'

/** The AppleScript that moves Fabric Dashboards' front window, or answers where it stands. Numbers only reach it. */
export function dashboardsScript(to: CeoPlacement | 'bounds'): string {
  const head = `tell application "System Events" to tell process "${DASHBOARDS_PROCESS}"`
  if (to === 'bounds') return `${head}\n  if (count of windows) is 0 then return ""\n  set p to position of window 1\n  set s to size of window 1\n  return ((item 1 of p) as text) & "," & ((item 2 of p) as text) & "," & ((item 1 of s) as text) & "," & ((item 2 of s) as text)\nend tell`
  if ('fullScreen' in to) return `${head}\n  set frontmost to true\n  set value of attribute "AXFullScreen" of window 1 to true\nend tell`
  const n = (v: number) => String(Math.round(v))
  const b = to.bounds
  return `${head}\n  set frontmost to true\n  if value of attribute "AXFullScreen" of window 1 is true then\n    set value of attribute "AXFullScreen" of window 1 to false\n    delay 0.8\n  end if\n  set position of window 1 to {${n(b.x)}, ${n(b.y)}}\n  set size of window 1 to {${n(b.width)}, ${n(b.height)}}\nend tell`
}

/** `"x,y,w,h"` as the bounds script answers it; null for anything else. */
export function parseBounds(text: string): Rect | null {
  const m = /^\s*(-?\d+),\s*(-?\d+),\s*(\d+),\s*(\d+)\s*$/.exec(text)
  return m ? { x: Number(m[1]), y: Number(m[2]), width: Number(m[3]), height: Number(m[4]) } : null
}

export interface DashboardsPortDeps {
  /** The registry's services (`agentRegistry.ts`): the ones Fabric Dashboards lists. */
  services(): CeoDashboard[]
  openExternal(link: string): Promise<void>
  /** Whether macOS lets Fabric drive another app's windows; `prompt` asks the person once (System Settings). */
  trusted(prompt: boolean): boolean
  /** Run one AppleScript; resolves with its output. Tests pass their own. */
  osascript?(script: string): Promise<string>
  platform?: string
  sleep?(ms: number): Promise<void>
}

/** An osascript that did not answer in time: on the first move this is macOS's own Automation question on screen. */
export class OsascriptTimeout extends Error { readonly code = 'ETIMEDOUT' }

export function runOsascript(script: string, timeoutMs = 10_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('/usr/bin/osascript', ['-e', script], { timeout: timeoutMs }, (err, stdout, stderr) => {
      // DO-1, ER-6: a kill at the deadline is a timeout, said as one; the script's text never goes up.
      if (err && (err.killed || err.signal)) reject(new OsascriptTimeout('osascript did not answer in time'))
      else if (err) reject(new Error((stderr || 'osascript failed').trim().slice(0, 300)))
      else resolve(stdout.trim())
    })
  })
}

const AUTOMATION = 'macOS asks the owner to let Fabric control System Events (System Settings, Privacy and Security, Automation): once it is allowed, ask again'
const ACCESSIBILITY = 'macOS has not let Fabric move other apps\' windows yet: the owner allows Fabric in System Settings, Privacy and Security, Accessibility (macOS shows its own prompt now), then ask again'

export function createDashboardsPort(d: DashboardsPortDeps): CeoDashboardsPort {
  const osa = d.osascript ?? ((script: string) => runOsascript(script))
  const mac = (d.platform ?? process.platform) === 'darwin'
  const sleep = d.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  /** Set once an Apple Event reached System Events in this process: macOS has answered its Automation question. */
  let reached = false
  async function read(ask: boolean): Promise<CeoDashboardsWindow> {
    if (!mac) return { known: false, why: 'Fabric Dashboards\' window is read only on macOS' }
    if (!d.trusted(false)) return { known: false, why: 'macOS has not let Fabric read other apps\' windows yet (Accessibility)' }
    // A listing never raises the Automation question: it reads only after a move reached System Events (ER-7).
    if (!ask && !reached) return { known: false, why: 'not read yet: Fabric reads Fabric Dashboards\' window after its first move' }
    try {
      const out = await osa(dashboardsScript('bounds'))
      reached = true
      return { known: true, rect: parseBounds(out) }
    } catch (e) {
      // System Events answers -1728 («Can't get process») for an app that is not running, -600 for one that ended:
      // either way it has no window, which a cold start waits out (UX-5, ER-19, DO-14).
      if (e instanceof Error && /-1728\b|-600\b|can.t get process|isn.t running|not running/i.test(e.message)) { reached = true; return { known: true, rect: null } }
      return { known: false, why: e instanceof OsascriptTimeout ? AUTOMATION : 'macOS would not say where it is' }
    }
  }
  return {
    list: () => d.services(),
    open: (link) => d.openExternal(link),
    window: (ask) => read(ask),
    async waitWindow(ms) {
      // Only once macOS lets Fabric look; otherwise the move itself says what is missing.
      if (!mac || !d.trusted(false)) return { known: false, why: 'cannot look' }
      const until = Date.now() + ms
      let last: CeoDashboardsWindow = { known: false, why: 'not read' }
      while (Date.now() < until) {
        last = await read(true)
        if (!last.known || last.rect) return last
        await sleep(400)
      }
      return last
    },
    async place(to) {
      if (!mac) return { ok: false, reason: 'Fabric Dashboards\' window is moved only on macOS' }
      // macOS shows its own Accessibility prompt at this call and answers at once; the move is refused now and works
      // once the owner allows it (DO-3).
      if (!d.trusted(true)) return { ok: false, reason: ACCESSIBILITY }
      try {
        await osa(dashboardsScript(to))
        reached = true
        return { ok: true }
      } catch (e) { /* said to the caller as the tool's refusal, never as success */
        const said = e instanceof Error ? e.message : String(e)
        // A timeout is the Automation question waiting on screen; -1743: the owner said no; -1712: the event timed out.
        if (e instanceof OsascriptTimeout || /-1712|-1743|not allowed|not authori[sz]ed/i.test(said)) return { ok: false, reason: AUTOMATION }
        // DA-5: only the AppleScript error's number reaches the model; its text can carry paths.
        const num = /\((-?\d+)\)/.exec(said)?.[1]
        return { ok: false, reason: `macOS did not move Fabric Dashboards' window${num ? ` (AppleScript error ${num})` : ''}: is it open?` }
      }
    }
  }
}
// #endregion ceo-windows-ports
