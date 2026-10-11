// The component registry — what the interface is allowed to be made of.
//
// M117. Before this file, `styles.css` held ~90 class names for about fifteen
// concepts: EIGHT different "head of a container" (`.panel-head`, `.widget-head`,
// `.tile-head`, `.editor-head`, `.session-head`, `.workspace-head`,
// `.transcript-head`, `.task-history-head`), eight row shapes, two empty states,
// four overlapping state vocabularies — and `.stat-value` declared twice in the
// same stylesheet. Nothing was wrong with any single one of them; the problem is
// that a new screen had to re-decide what a card is, and every screen decided
// differently.
//
// `docs/brand/ui.md` already states the RULES — monochrome controls, one
// chromatic brand object, a state carried by its word, `--app-*` aliases only,
// the six-step space ladder. This file is the missing half: the set of objects
// those rules apply to. It is data rather than prose because
// `scripts/check-design.mjs` reads it, and a component set nothing can check is
// a style guide, not a system.
//
// TWO KINDS OF ENTRY, and the difference is the whole point:
//
//   COMPONENT — a named object with a React implementation in this directory.
//     Its classes are written by that component and by nothing else.
//   LAYOUT — a class that positions components and owns no appearance of its own:
//     grids, strips, scroll containers, page wrappers. These are declared rather
//     than banned because inventing a component for "two columns" is how a set
//     dies of ceremony. They may not carry colour, border or radius; the palette
//     gate already enforces the first and review enforces the rest.
//
// Adding a class means adding it here, in the same change. That is the friction
// this file exists to create.

export interface ComponentEntry {
  /** The React component that owns these classes. */
  component: string
  /** Every class name it writes, including its modifiers. */
  classes: readonly string[]
  /** What it is for — read by a person, not by the gate. */
  purpose: string
}

export const COMPONENTS: readonly ComponentEntry[] = [
  {
    component: 'OperatorError',
    classes: ['error-detail', 'boot-failure', 'booting-failed'],
    purpose:
      'The one place a failure becomes words (M106). Forty-eight `onError(String(e))` sites all reach the operator through one banner, so our sentence is chosen here and the machine’s own words are kept beside it — subordinate, wrapped, and scrollable rather than able to widen the window. `boot-failure` is the separate surface for a window that could not read what it is FOR, where the ordinary banner is unreachable.'
  },
  {
    component: 'Panel',
    classes: ['panel', 'panel-quiet', 'panel-interactive', 'panel-head', 'panel-title', 'panel-body', 'span-2'],
    purpose:
      'The one resting container: fill plus a hairline, never a shadow. Absorbs .widget, .project-card and the tile body; `interactive` makes the whole card one keyboard-reachable control.'
  },
  {
    component: 'StateChip',
    classes: ['chip', 'chip-dot', 'chip-warn', 'chip-good', 'chip-danger', 'chip-info', 'chip-quiet'],
    purpose:
      'A short label in a pill. `dot` adds the state dot. The WORD carries the state and the colour supports it — ui.md forbids an unlabelled coloured dot standing in for a state.'
  },
  {
    component: 'EmptyState',
    classes: ['empty', 'empty-loud'],
    purpose:
      'What a surface says when it has nothing — and, per M108, only after it has read. Absorbs .estate-empty.'
  },
  {
    component: 'Row',
    classes: ['row', 'row-interactive', 'row-lead', 'row-main', 'row-trail', 'row-quiet', 'row-trail-acts'],
    purpose:
      'One line in a list: an optional lead cell, the content, an optional trailing cell. **`onClick` makes it a real `<button>`, so it must not then contain one** — a clickable Row (or Panel) with a button in its lead or trail is nested buttons, which is invalid and whose click behaviour is not worth relying on. Walked into three times: TaskCard avoided it by design, the estate card and the attention queue did not. Where a row needs BOTH a navigation and an action, it is a plain row with two sibling controls. Absorbs .feed-row, .memory-row, .repo-row, .transcript-row, .task-line, .choice-row, .preset-row.'
  },
  {
    component: 'Toolbar',
    classes: ['toolbar', 'toolbar-end', 'toolbar-between'],
    purpose:
      'A cluster of controls with one spacing rule. Absorbs .header-actions, .editor-actions, .conflict-actions, .task-row-actions, .task-controls, .settings-bar.'
  },
  {
    component: 'Stat',
    classes: ['stat', 'stat-value', 'stat-label', 'stat-strip', 'stat-interactive'],
    purpose: 'A measured number with its label. `.stat-value` was declared twice in styles.css; here it is declared once.'
  },
  {
    component: 'Field',
    classes: ['field', 'field-label', 'field-hint', 'field-problem', 'field-row', 'field-grid', 'field-actions'],
    purpose:
      'A labelled control with an optional hint, so a form does not re-invent its own label rhythm. `FieldGroup` is the same shell for one label over several controls, which binds by role and `aria-labelledby` rather than by id.'
  },
  {
    component: 'Button',
    classes: ['btn', 'btn-ghost', 'btn-quiet', 'btn-danger', 'disclosure'],
    purpose:
      'Interactive controls stay monochrome (ui.md): the brand mark identifies the product and never becomes a button state.'
  },
  {
    component: 'Claim',
    classes: ['claim', 'claim-label', 'claim-stage', 'claim-age', 'claim-stale', 'tail'],
    purpose:
      "What an agent says about itself beside what Fabric observed. One entry because the two only mean anything together: a stage with no age beside a measurement is the confusion the product exists to prevent."
  },
  {
    component: 'StatusBar',
    classes: ['status-bar', 'status-cell', 'status-quiet', 'status-dot', 'live', 'idle', 'tick', 'tick-muted', 'tick-mono'],
    purpose:
      'A band of facts that navigate. Its cells hold heterogeneous content, which is why they are not Stat; a cell with an action is a real button, because every fact must open its receipt from a keyboard too.'
  },
  {
    component: 'TabStrip',
    classes: ['tabbar', 'tab-btn', 'tab-label', 'tab-close', 'tabbar-estate', 'live-count', 'active', 'home', 'plus', 'settings-btn'],
    purpose:
      'The window tab strip. In the set because it owns nine classes with appearance, and a class with appearance belongs to a component or to nobody.'
  },
  {
    component: 'FileTree',
    classes: ['file-tree', 'file-row', 'dir', 'file'],
    purpose:
      'A directory listing with disclosure. Product-specific rather than generic, but it owns classes and is reused, so it belongs in the set rather than beside it.'
  },
  {
    component: 'Caret',
    classes: ['caret'],
    purpose:
      'The disclosure triangle. Its own entry because two components draw it and a class has exactly one owner — the duplicate was caught by the inventory test, not by review.'
  },
  {
    component: 'Board',
    classes: ['board', 'board-column', 'board-column-head', 'board-column-title', 'board-count', 'board-column-body', 'board-column-target'],
    purpose:
      'The task board as a projection of the journal. A column always states its count, and an empty column SAYS it is empty — a column that renders as nothing is indistinguishable from one that failed to load.'
  },
  {
    component: 'TaskCard',
    classes: ['task-card', 'task-card-quiet', 'task-card-interactive', 'task-card-title', 'task-card-meta', 'task-card-origin', 'task-card-hand', 'task-card-trail', 'task-card-move', 'task-card-note', 'task-card-note-warn'],
    purpose:
      'One task on the board, and it never appears without its provenance: who filed it and between whom it moved (M130). A card showing only a title turns "who decided this" into archaeology. `.task-card-note` carries what the MOVER makes the column mean (M124) and is written only where that changes something — `provenance.ts` owns the judgement, so cards do not all grow a line. `.task-card-note-warn` is for the one case the ladder says cannot happen: a terminal state an agent reached.'
  },
  {
    component: 'Banner',
    classes: ['banner', 'banner-error', 'banner-warn', 'banner-actions', 'banner-remedy', 'banner-why'],
    purpose: 'Something the operator must read before continuing. Absorbs .error-banner, .conflict-banner, .settings-note.'
  }
] as const

/**
 * Classes that place components and own no appearance. Declared, not banned:
 * see the header. Each names what it positions so an unused one is visible.
 */
export const LAYOUT: Readonly<Record<string, string>> = {
  app: 'the application shell',
  content: 'the scrolling body of a window',
  workspace: 'the project workspace grid',
  'workspace-head': 'the workspace title band',
  'project-home': 'the project page grid',
  'project-columns': 'the project page two-column split',
  'project-columns-3': 'the estate agents three-column split — list, console, where it is working',
  'project-grid': 'the estate project cards',
  'estate-home': 'the estate page',
  'agent-grid': 'the agent tiles',
  'canvas-grid': 'the widget canvas',
  'edit-grid': 'the project settings form grid',
  feed: 'the scrolling event list',
  compact: 'a shorter variant of a scroll container',
  'memory-list': 'the memory list',
  'repo-list': 'the repository list',
  'transcript-list': 'the transcript list',
  'widget-list': 'a list inside a panel',
  'terminal-host': 'the xterm mount point',
  'editor-host': 'the monaco mount point',
  'editor-window': 'the editor window shell',
  'session-window': 'the session window shell',
  'session-head': 'the session window title band',
  'editor-head': 'the editor window title band',
  onboarding: 'the onboarding form shell',
  'onboarding-launch': 'the existing onboarding form scoped to the launch visual system',
  booting: 'the pre-bootstrap splash body',
  mono: 'monospace text',
  muted: 'de-emphasised text',
  'project-header': 'the project page title band',
  'col-main': 'the project page main column',
  'col-side': 'the project page reference column',
  'memory-add': 'the remember-a-fact form',
  'memory-search': 'the memory search field row',
  'memory-toggle': 'the show-corrected-facts control',
  'correcting': 'the banner naming the fact being corrected',
  'transcript-body': 'an opened transcript',
  'excerpt': 'a transcript excerpt',
  'editing': 'the project header in edit mode',
  'widget': 'a canvas widget frame',
  'task-panel': 'the give-a-task panel',
  'task-input': 'the instruction textarea',
  'task-history': 'the recent-tasks list',
  'task-history-head': 'its heading',
  'settings-bar': 'the settings band under the tab strip',
  'settings-note': 'the line stating what the OS will not do',
  'settings-usage': 'the usage-counts switch and its note, one column in the settings band',
  'settings-fallback': 'the fallback order (ADR-0125): heading, note and one aligned row per coding agent',
  'settings-fallback-name': 'a coding agent\'s name in its fallback-order row, cut with an ellipsis',
  'settings-fallback-add': 'the add-an-agent control under the fallback order',
  'choice': 'one option in a radio group',
  'choice-row': 'the options of a radio group',
  'actions': 'a form’s action row',
  'shell': 'the row holding the content and the CEO panel',
  'shell-with-panel': 'the shell while the CEO panel is open — content narrows, nothing is covered',
  'ceo-panel': 'the CEO panel itself',
  'search-button': 'Search in the scope bar of the launch shell (SCR-30)',
  'chat-log': 'the conversation, the only growing area of the chat panel',
  'chat-message': 'one message in the conversation',
  'chat-composer': 'the chat panel\'s context, input and send band',
  'visually-hidden': 'present for a screen reader, absent on screen',
  'access-card': 'one product, request or agent in Agent access (SCR-76)',
  'access-name': 'the agent\'s name heading a card in Agent access',
  'access-asks': 'what a request asks, one line per resource',
  'access-url': 'a product server address that may break anywhere',
  'access-problem': 'a failed connect attempt, in the warning ink',
  'access-acts': 'a card\'s acts, on their own line under its text',
  'access-detail': 'the machine\'s own words, under a localised line'
}

/** Every class the interface may name, from both kinds of entry. */
export function declaredClasses(): Set<string> {
  const all = new Set<string>(Object.keys(LAYOUT))
  for (const entry of COMPONENTS) for (const cls of entry.classes) all.add(cls)
  return all
}
