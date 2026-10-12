// The project page's sections are revealed by id (evidence.ts#EVIDENCE_ANCHORS, App's revealSection): two panels on it
// with one id send «Where work is»'s review count to «Needs you» instead of the board (0.3.5 verification, iteration 2,
// UX-2). The project page renders ProjectHome and, inside it, BoardPanel.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const idsOf = (file: string): string[] => [...readFileSync(new URL(file, import.meta.url), 'utf8').matchAll(/\bid="(sec-[a-z0-9-]+)"/g)].map((m) => m[1])

describe('project page section ids', () => {
  it('no id is used by both ProjectHome and BoardPanel (one header id inside ProjectHome serves two exclusive modes)', () => {
    const home = new Set(idsOf('./ProjectHome.tsx'))
    expect(idsOf('./BoardPanel.tsx').filter((id) => home.has(id))).toEqual([])
  })
  it('the board keeps sec-board, where the review count and «all tasks» go', () => {
    expect(idsOf('./ProjectHome.tsx')).toContain('sec-board')
  })
})
