// ADR-0207 Decision 6, spec 2026-11-21 §3.4 (R4): a console waiting at a prompt is recognised from its last screen.
// The screens below are written in the layout Claude Code 2.x and Codex draw (box, markers, footers) with synthetic
// words: no session's own text is copied into the repository.
import { describe, expect, it } from 'vitest'
import { promptKey, promptOnScreen } from './consolePrompt'

const askMenu = [
  '⏺ I need one decision before I continue.',
  '',
  '☐ Storage',
  '',
  'Where should the drafts be kept?',
  '',
  '❯ 1. In the project folder',
  '     Kept beside the code, committed with it.',
  '  2. In the app data folder',
  '     Private to this machine.',
  '  3. Type something.',
  '',
  'Enter to select · ↑/↓ to navigate · Esc to cancel',
].join('\n')

const permission = [
  '╭──────────────────────────────────────────────╮',
  '│ Bash command                                 │',
  '│                                              │',
  '│   npm run build                              │',
  '│   Build the app                              │',
  '│                                              │',
  '│ Do you want to proceed?                      │',
  '│ ❯ 1. Yes                                     │',
  "│   2. Yes, and don't ask again for npm run    │",
  '│   3. No, and tell Claude what to do (esc)    │',
  '╰──────────────────────────────────────────────╯',
].join('\n')

const codexApproval = [
  'Allow command?',
  '',
  '  $ cargo test',
  '',
  '› 1. Yes, proceed',
  '  2. Yes, and don\'t ask again for this command',
  '  3. No, and tell Codex what to do differently',
  '',
  'Press enter to confirm or esc to cancel',
].join('\n')

const yesNo = ['Installing the hooks.', 'Overwrite the existing file? [y/N]'].join('\n')
const pressEnter = ['Setup finished.', 'Press Enter to continue'].join('\n')

const typedQuestion = [
  '⏺ The migration is written and the tests pass.',
  '  Should I land it on main now, or wait for the review?',
  '',
  '╭──────────────────────────────────────────────╮',
  '│ >                                            │',
  '╰──────────────────────────────────────────────╯',
  '  ? for shortcuts',
].join('\n')

const running = [
  '⏺ Should I land it on main now?',
  '',
  '✻ Thinking… (12s · esc to interrupt)',
  '',
  '╭──────────────────────────────────────────────╮',
  '│ >                                            │',
  '╰──────────────────────────────────────────────╯',
  '  ? for shortcuts',
].join('\n')

// A numbered list the agent prints while it still works is no menu.
const runningList = ['⏺ Which of these first?', '  1. The migration', '  2. The tests', '✻ Thinking… (4s · esc to interrupt)'].join('\n')

// A numbered question typed above Claude Code's input box waits for a typed answer, not a menu key.
const typedList = [
  '⏺ Which of these should go first?',
  '  1. The migration',
  '  2. The tests',
  '',
  '╭──────────────────────────────────────────────╮',
  '│ >                                            │',
  '╰──────────────────────────────────────────────╯',
  '  ? for shortcuts',
].join('\n')

const plainPrompt = [
  '╭──────────────────────────────────────────────╮',
  '│ >                                            │',
  '╰──────────────────────────────────────────────╯',
  '  ? for shortcuts',
].join('\n')

const finishedTurn = [
  '⏺ Done: the branch is pushed and the checks are green.',
  '',
  '╭──────────────────────────────────────────────╮',
  '│ >                                            │',
  '╰──────────────────────────────────────────────╯',
  '  ⏵⏵ accept edits on (shift+tab to cycle)',
].join('\n')

describe('promptOnScreen', () => {
  it('reads Claude Code\'s question menu: the question, every option with its key, the one selected', () => {
    const p = promptOnScreen(askMenu)
    expect(p).toEqual({
      kind: 'menu',
      question: 'Where should the drafts be kept?',
      options: [
        { key: '1', label: 'In the project folder' },
        { key: '2', label: 'In the app data folder' },
        { key: '3', label: 'Type something.' },
      ],
      selected: '1',
    })
  })

  it('reads a permission prompt inside a box as a confirmation with its numbered answers', () => {
    const p = promptOnScreen(permission)
    expect(p?.kind).toBe('confirm')
    expect(p?.question).toBe('Do you want to proceed?')
    expect(p?.options.map(o => o.key)).toEqual(['1', '2', '3'])
    expect(p?.options[0].label).toBe('Yes')
    expect(p?.selected).toBe('1')
  })

  it('reads Codex\'s approval the same way', () => {
    const p = promptOnScreen(codexApproval)
    expect(p?.kind).toBe('confirm')
    expect(p?.question).toBe('Allow command?')
    expect(p?.options).toHaveLength(3)
    expect(p?.selected).toBe('1')
  })

  it('reads a y/n prompt, the capital letter being the default', () => {
    expect(promptOnScreen(yesNo)).toEqual({
      kind: 'confirm',
      question: 'Overwrite the existing file?',
      options: [{ key: 'y', label: 'Yes' }, { key: 'n', label: 'No' }],
      selected: 'n',
    })
  })

  it('reads «Press Enter to continue» as a confirmation with one answer', () => {
    expect(promptOnScreen(pressEnter)).toEqual({
      kind: 'confirm', question: 'Press Enter to continue', options: [{ key: 'enter', label: 'Continue' }], selected: 'enter',
    })
  })

  it('reads a question the agent typed and stopped on, with the prompt drawn', () => {
    expect(promptOnScreen(typedQuestion)).toEqual({
      kind: 'text', question: 'Should I land it on main now, or wait for the review?', options: [], selected: null,
    })
  })

  it('reads a numbered question typed above the input box as a typed question, with its options as hints', () => {
    expect(promptOnScreen(typedList)).toEqual({
      kind: 'text', question: 'Which of these should go first?',
      options: [{ key: '1', label: 'The migration' }, { key: '2', label: 'The tests' }], selected: null,
    })
  })

  it('answers null while the agent runs, for a plain prompt and for a finished turn with no question', () => {
    expect(promptOnScreen(running)).toBeNull()
    expect(promptOnScreen(runningList)).toBeNull()
    expect(promptOnScreen(plainPrompt)).toBeNull()
    expect(promptOnScreen(finishedTurn)).toBeNull()
    expect(promptOnScreen('')).toBeNull()
  })

  it('does not take an old menu scrolled above a finished turn for a waiting one', () => {
    expect(promptOnScreen(askMenu + '\n' + finishedTurn)).toBeNull()
  })
})

describe('promptKey', () => {
  it('is the same for the same prompt in the same session and differs when the question or the session differs', () => {
    const a = promptOnScreen(askMenu)!
    expect(promptKey('s1', a)).toBe(promptKey('s1', promptOnScreen(askMenu)!))
    expect(promptKey('s2', a)).not.toBe(promptKey('s1', a))
    expect(promptKey('s1', { ...a, question: 'Another?' })).not.toBe(promptKey('s1', a))
    // The marker moving between options is the same prompt.
    expect(promptKey('s1', { ...a, selected: '2' })).toBe(promptKey('s1', a))
  })
})
