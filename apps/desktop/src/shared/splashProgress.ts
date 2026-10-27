// What the splash says while the local stack starts (M101).
//
// It had one sentence and, until this change, NOBODY EVER SAW IT. `startStack()`
// was `execFileSync` with a 240-second timeout called immediately after the
// window was created, and Electron's main thread is the browser process message
// loop. Measured with the page reporting its OWN clock: against a six-second
// block starting at +285ms, the page's script ran at +6387ms — 59ms after the
// block ended. The renderer did not execute the page at any point during the
// wait, so the text was not late, it was absent.
//
// With the start moved off the main thread the window paints, and then the
// question becomes what it should say. Four minutes of one static sentence is
// how a person decides an app has hung and force-quits a process that was
// working — so this shows the elapsed time once a wait is long enough to be
// doubted, says plainly that a first run is expected to be slow, and passes
// through the stack's own last line, which is usually the most informative
// thing on the machine.

export interface SplashState {
  elapsedMs: number
  /** The last line the stack printed, or null when it has printed nothing. */
  lastLine: string | null
  /** CO-306 (SCN-161): the interface's language, read from Settings before any window; anything else is English. */
  locale?: string | null
}

/** Below this a wait is ordinary; above it, silence starts to read as a hang. */
export const DOUBT_MS = 5_000
/** Past this the wait needs explaining, not just counting. */
export const PATIENCE_MS = 30_000

const MAX_LINE = 90

/** Fabric's own two notes on the splash (`main/env.ts`), written in English there and said in the person's language here. */
const DOCKER_WAIT = /^Waiting for Docker to answer \((\d+) s\)$/
const STILL_STARTING = /^The stack is still starting, try (\d+) of (\d+)$/
/** `main/stackHalfUp.ts#HEAL_LINE`: the half-up heal stops and starts the stack (0.3.13 review, iteration 3, UX-5). */
const HEALING = /^Restarting the local stack, keeping its data$/
/** `main/env.ts`, CO-294: Fabric starts Docker's own app. */
const LAUNCHING = /^Starting (OrbStack|Docker Desktop|Colima)$/

const WORDS = {
  en: {
    starting: 'Starting the local stack',
    seconds: (n: number) => `${n}s`,
    patient: 'a first run downloads images and is expected to be slow',
    docker: (n: string) => `Waiting for Docker to answer (${n} s)`,
    retry: (a: string, b: string) => `The stack is still starting, try ${a} of ${b}`,
    healing: 'Restarting the local stack, keeping its data',
    launching: (app: string) => `Starting ${app}`
  },
  ru: {
    starting: 'Запускаю локальную базу',
    seconds: (n: number) => `${n} с`,
    patient: 'первый запуск скачивает образы и идёт долго',
    docker: (n: string) => `Жду ответа Docker (${n} с)`,
    retry: (a: string, b: string) => `База ещё запускается, попытка ${a} из ${b}`,
    healing: 'Перезапускаю локальную базу, данные сохраняются',
    launching: (app: string) => `Запускаю ${app}`
  }
}

export function splashProgress(state: SplashState): string {
  const w = state.locale === 'ru' ? WORDS.ru : WORDS.en
  const parts = [w.starting]
  if (state.elapsedMs >= DOUBT_MS) parts.push(w.seconds(Math.floor(state.elapsedMs / 1000)))

  let text = parts.join(' · ')
  // No dash between the parts: a full stop, as the text rule for people asks.
  if (state.elapsedMs >= PATIENCE_MS) text += `. ${w.patient[0].toUpperCase()}${w.patient.slice(1)}`

  let line = (state.lastLine ?? '').trim()
  const docker = DOCKER_WAIT.exec(line)
  const retry = STILL_STARTING.exec(line)
  if (docker) line = w.docker(docker[1])
  else if (retry) line = w.retry(retry[1], retry[2])
  else if (HEALING.test(line)) line = w.healing
  else if (LAUNCHING.test(line)) line = w.launching(LAUNCHING.exec(line)![1])
  if (line) {
    // Stripped, not escaped. The main process writes this into a page, and a
    // stack that printed a tag could otherwise put markup on the screen — a
    // small hole, but one nobody would think to look for in a splash.
    const safe = line.replace(/[<>&"']/g, ' ').replace(/\s+/g, ' ').trim()
    if (safe) text += `. ${safe.length > MAX_LINE ? safe.slice(0, MAX_LINE - 1) + '…' : safe}`
  }
  return text
}
