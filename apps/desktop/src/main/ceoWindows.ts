// #region ceo-windows-ports — docs: docs/adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md#the-session-control-tools
/**
 * The windows the CEO closes and arranges (board requests 26989d91, 07db5c30, 374f27bf; the owner, 2026-11-19): Fabric's
 * own windows through Electron, and Fabric Dashboards' window, another app's, through macOS's System Events. Closing a
 * console's window here is the same as the person closing it: the session's process lives in the main process
 * (`pty.ts`) and runs on, and opening it again shows its kept screen.
 *
 * What is NOT here: a second way to start or stop a session. `ceoTools.ts` decides; this only moves windows.
 */
import { execFile } from 'node:child_process'
import type { CeoDashboard, CeoDashboardsPort, CeoPlacement, CeoWindow, CeoWindowsPort } from './ceoTools.ts'
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
  once?(event: 'leave-full-screen', fn: () => void): void
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
      if ('fullScreen' in to) {
        w.setFullScreen(true)
      } else if (w.isFullScreen()) {
        // macOS animates out of full screen; a size set before it ends is lost.
        if (w.once) w.once('leave-full-screen', () => { if (!w.isDestroyed()) w.setBounds(to.bounds) })
        w.setFullScreen(false)
        if (!w.once) w.setBounds(to.bounds)
      } else w.setBounds(to.bounds)
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
}

export function runOsascript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('/usr/bin/osascript', ['-e', script], { timeout: 8000 }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message).trim().slice(0, 300)))
      else resolve(stdout.trim())
    })
  })
}

export function createDashboardsPort(d: DashboardsPortDeps): CeoDashboardsPort {
  const osa = d.osascript ?? runOsascript
  const mac = (d.platform ?? process.platform) === 'darwin'
  return {
    list: () => d.services(),
    open: (link) => d.openExternal(link),
    async bounds() {
      if (!mac || !d.trusted(false)) return null
      try { return parseBounds(await osa(dashboardsScript('bounds'))) } catch { return null /* not running, or macOS would not say: unknown, never a place */ }
    },
    async place(to) {
      if (!mac) return { ok: false, reason: 'Fabric Dashboards\' window is moved only on macOS' }
      // The first time macOS shows the person its own consent (Accessibility); the move waits for their answer.
      if (!d.trusted(true)) return { ok: false, reason: 'macOS has not let Fabric move other apps\' windows yet: the owner allows Fabric in System Settings, Privacy and Security, Accessibility, then ask again' }
      try {
        await osa(dashboardsScript(to))
        return { ok: true }
      } catch (e) { /* said to the caller as the tool's refusal, never as success */
        const said = e instanceof Error ? e.message : String(e)
        // -1712: the Apple Event waited on macOS's own question (Automation) and timed out; -1743: the person said no.
        if (/-1712|-1743|not allowed|not authori[sz]ed/i.test(said))
          return { ok: false, reason: 'macOS asks the owner to let Fabric control System Events (System Settings, Privacy and Security, Automation): once it is allowed, ask again' }
        return { ok: false, reason: `macOS did not move Fabric Dashboards' window: ${said}` }
      }
    }
  }
}
// #endregion ceo-windows-ports
