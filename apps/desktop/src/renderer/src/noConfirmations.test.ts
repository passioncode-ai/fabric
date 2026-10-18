// ADR-0160 §1 (0.3.7 wave 3): on the operator's own machine an act happens at once. No `window.confirm`, no
// `window.alert`, no `window.prompt`, and no «are you sure» alert dialog in the renderer: an act is recorded with its
// undo instead (the act line, История). The boundaries of §4 ask as a question on Главная, never as a pop-up.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.dirname(new URL(import.meta.url).pathname)
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = path.join(dir, f)
  return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : []
})

describe('no confirmation dialogs (ADR-0160 §1)', () => {
  it('no window.confirm, window.alert or window.prompt in the renderer', () => {
    const hits = files(ROOT).flatMap((f) => readFileSync(f, 'utf8').split('\n')
      .map((line, i) => ({ line, at: `${path.relative(ROOT, f)}:${i + 1}` }))
      .filter(({ line }) => /\bwindow\.(confirm|alert|prompt)\s*\(/.test(line) && !/^\s*(\/\/|\*)/.test(line))
      .map(({ at }) => at))
    expect(hits).toEqual([])
  })
  it('no alertdialog asking the person to confirm an act', () => {
    const hits = files(ROOT).filter((f) => /role="alertdialog"/.test(readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f))
    expect(hits).toEqual([])
  })
})
