{
  "schema": "design-review/1",
  "surface": "Fabric desktop: a console's bottom bar (session-bar), the system line of SCN-188",
  "panel_revision": "none: docs/ux/test-panel.md is absent in this worktree; design_gate.py panel answers NOT_RUN. Persona P-01 (Estate operator, docs/ux/foundation.md, status confirmed) is used as the dispatcher asked; coverage against a panel is not computed",
  "review_basis": {
    "date": "2026-11-20",
    "method": "captures only, no live app. The tester did not drive the build: the captures were supplied, rendered from the screens stand with fixtures (docs/reports/2026-11-20-console-meta-line/shots/), before-* against it3-* (final), with it1-* and it2-* read for history. Code read for what a capture cannot show: apps/desktop/src/renderer/src/SessionMetaLine.tsx, launch/launch.css (.session-meta*), SessionMetaLine.test.tsx, apps/desktop/stand/fixtures.ts (terminal.meta). Nothing was edited. Reference: the owner's capture of the Fabric Dashboards session header (CEO inbox image of 2026-11-20 19:59:16Z)",
    "fixture_values": "folder ~/DATA/support-desk under the fixture's example home (shown as a two-segment tail), branch feat/queue, account claude13@example.me (short claude13@…), context PassionCode.ai, started by switchboard, handed over 50 minutes before NOW, runner claude-code, model claude-opus-5-5, Fabric session id c2 (a real one shows 8 hex characters), agent session id 1fc71162-…",
    "surface_class": "internal per the repository's recorded family-routes detection (Surface: internal); the gate was also run as product to show what it would say on a gated class"
  },
  "rows": [
    {
      "scenario": "SCN-188", "step": 1, "persona": "P-01", "pass": "build", "round": 1,
      "frame": "no Figma frame or mockup for SCN-188; judged against the scenario text, the owner's brief and the Fabric Dashboards reference",
      "capture": "docs/reports/2026-11-20-console-meta-line/shots/it3-bar-dark-1280.jpg, it3-bar-light-1280.jpg, it3-bar-dark-820.jpg, it3-console-dark-1280.jpg, it3-console-light-1280.jpg, it3-console-dark-820.jpg; before: before-bar-dark-1280.jpg, before-bar-dark-820.jpg",
      "engine": "not recorded: supplied stand captures, not driven by the tester",
      "outcome": "At 1280 every brief part is present, but folder, branch, organisation and start time are cut to a generic prefix; at 820 the branch and both ids are absent and organisation, folder and who are 5 to 15 character fragments. The account (claude13@…) and the runner and model (Claude Code · Opus 5.5) are whole at both widths.",
      "checks": {"frame": "pass", "primary_action": "pass", "controls": "fail", "focus": "NOT_RUN", "states": "NOT_RUN", "text_fit": "fail", "outcome": "fail"},
      "reason": "focus: no keyboard pass is possible on captures. states: only the running state with Switchboard read was captured; ended (with «Новая сессия» in the bar, which takes more width), Switchboard not read, and the before-read fallback were not captured.",
      "findings": [
        {"id": "F1", "severity": "breaks", "status": "open", "checklist": "text_fit, outcome",
         "what": "At 1280 the line cuts four of its eight parts, and every cut removes the part's distinguishing end: the folder …/DATA/support-desk shows «…/DATA/su…», the branch feat/queue shows «feat/…», PassionCode.ai shows «PassionCo…», and «Передана Switchboard, HH:MM» shows «Передана Switchboard, 1…» (the time is lost). These are short fixture values (10 to 17 characters). The scenario's expected result, that the operator sees in what folder and branch a console works without opening anything, is not met at rest at the main laptop width. It is also a regression: the before bar carried one fact, the folder, and showed it whole at both widths («…/atlas-desktop/Atlas desktop app with a long folder name»); with the line, the folder is the first part to give way (flex-shrink 6, right-end ellipsis) and is no longer readable at rest. Projected, not captured: a real Fabric session id is 8 hex characters against the fixture's «c2», about 40 px more, which the CSS takes from who/when and the folder next.",
         "where": "session-bar, system line; it3-bar-dark-1280.jpg and it3-bar-light-1280.jpg against before-bar-dark-1280.jpg"},
        {"id": "F2", "severity": "risk", "status": "open", "checklist": "controls, text_fit",
         "what": "At 820 the branch and both ids are removed whole (launch.css: .is-branch and .is-id display:none at max-width 940px, by viewport width), so the branch and the copy presses are not on the line at all. The CSS comment says they stay on hover of the folder's console tab, but the folder's tooltip (session.meta.folder) names only the path, so in this bar they are unreachable. What remains is fragments, «Передана Switc…», «Passi…», «…/DA…», which contradicts the CSS's own stated rule that a narrow window keeps whole parts only. The start time is gone. The it2 stray clipped separator at 820 is fixed in it3.",
         "where": "session-bar at 820; it3-bar-dark-820.jpg, it3-console-dark-820.jpg"},
        {"id": "F3", "severity": "risk", "status": "open", "checklist": "text_fit",
         "what": "What is cut first is not what the owner asked to keep. The parts that never shrink are the account, the runner and model, and the ids; «Claude Code» repeats the console's title and tab («Сессия · Atlas · Claude Code · с 10:31»), while the owner's named parts (who started it and when, the folder, the branch, the organisation) give way. The account short form is right to keep. Observed in the captures; the alternative order (cut the folder and branch from the left so their last segment stays, drop the runner name the title already shows, drop a part whole rather than leave a 5 character fragment) is a suggestion, the builder's call.",
         "where": "launch.css .session-meta-item flex-shrink order; it3-bar-dark-1280.jpg, it3-bar-dark-820.jpg"}
      ]
    },
    {
      "scenario": "SCN-188", "step": 2, "persona": "P-01", "pass": "build", "round": 1,
      "frame": "no Figma frame or mockup for SCN-188; scenario text and the owner's brief",
      "capture": "none: no hover capture was supplied (it3-bar-dark-820.jpg shows the parts that have nothing to hover)",
      "engine": "not recorded: supplied stand captures, not driven by the tester",
      "outcome": "NOT_RUN: no tooltip was seen. Code gives every visible part a title with the whole value (e-mail, path, branch, whole id, account source); the unit test asserts three of them. At 820 the branch and the ids have nothing to hover (absent).",
      "checks": {"frame": "NOT_RUN", "primary_action": "na", "controls": "fail", "focus": "NOT_RUN", "states": "na", "text_fit": "NOT_RUN", "outcome": "NOT_RUN"},
      "reason": "No hover or tooltip capture exists and no live app was driven; a native title tooltip cannot be proven from a still. controls fails on what the 820 capture shows (F2).",
      "findings": [
        {"id": "F6", "severity": "risk", "status": "open", "checklist": "focus (code reading, not observed)",
         "what": "The whole values of the account, organisation, runner, branch and who/when live only in a title attribute on non-focusable spans: there is no keyboard or touch route to them, and a native tooltip comes after a delay. Code reading; not observed in use (NOT_RUN).",
         "where": "SessionMetaLine.tsx, the span parts"},
        {"id": "F2-ref", "severity": "risk", "status": "open", "checklist": "controls",
         "what": "At 820 the branch and both ids are absent, so step 2 has nothing to hover for them; see F2.",
         "where": "it3-bar-dark-820.jpg"}
      ]
    },
    {
      "scenario": "SCN-188", "step": 3, "persona": "P-01", "pass": "build", "round": 1,
      "frame": "no Figma frame or mockup for SCN-188; scenario text, the owner's brief and the Fabric Dashboards reference («Показать в Finder» button)",
      "capture": "docs/reports/2026-11-20-console-meta-line/shots/it3-bar-dark-1280.jpg, it3-bar-light-1280.jpg, it3-bar-dark-820.jpg",
      "engine": "not recorded: supplied stand captures, not driven by the tester",
      "outcome": "NOT_RUN: Finder opening and the clipboard were not exercised. The press targets are present at 1280 (folder, «c2», «1fc71162»); at 820 only the folder is.",
      "checks": {"frame": "pass", "primary_action": "fail", "controls": "fail", "focus": "NOT_RUN", "states": "NOT_RUN", "text_fit": "NOT_RUN", "outcome": "NOT_RUN"},
      "reason": "No live app: Finder and the clipboard cannot be read back from captures; the «Скопировано» state, the hover and the focus ring were not captured; the unit test that covers the presses was not run here.",
      "findings": [
        {"id": "F4", "severity": "risk", "status": "open", "checklist": "primary_action",
         "what": "The presses are not discoverable at rest. The folder and the ids are buttons drawn as plain muted text, identical in colour and in the mono face to the branch, which does nothing; underline and pointer appear only on hover (and only where hover exists), and the words «Нажмите, чтобы открыть в Finder» / «Нажмите, чтобы скопировать» only in the delayed tooltip. The owner's reference offers a labelled «Показать в Finder» button.",
         "where": "session-bar, folder and id parts; it3-bar-dark-1280.jpg"},
        {"id": "F5", "severity": "risk", "status": "open", "checklist": "primary_action",
         "what": "The two ids sit side by side unlabelled («c2 · 1fc71162»; in real use two 8 hex strings). Which one resumes the agent is said only in the tooltip, so the operator copies one to learn which it was.",
         "where": "session-bar, id parts"},
        {"id": "F2-ref", "severity": "risk", "status": "open", "checklist": "controls",
         "what": "At 820 neither id can be pressed (absent); see F2.",
         "where": "it3-bar-dark-820.jpg"},
        {"id": "F8", "severity": "nit", "status": "open", "checklist": "states (code reading)",
         "what": "The separator is the ::before of the next part, so for the folder and the id buttons the dot sits inside the press target, takes the hover underline and sits inside the focus ring. «Скопировано» (11 characters) replaces an 8 character id, so the line reflows on a copy, and no live region says it. Code reading; not captured.",
         "where": "launch.css .session-meta-item+.session-meta-item::before; SessionMetaLine.tsx copy()"}
      ]
    }
  ],
  "observations": {
    "no_regression": "The bar's height is unchanged (74 px at 2x before and after, both widths); the state pill, «Завершить сессию» and the detach icon keep their position and size; the line ends about 12 px before the button and never wraps; dark and light lay out the same. The line does not fight the pill or the stop button.",
    "contrast_measured_from_pixels": "Background read as the bar's most common pixel. Muted text, darkest core pixel against the bar: dark 9.4 to 10.1:1 (token #b6aabc on #0a070d is 9.0:1), light 7.1 to 7.8:1 (token #655769 on #ffffff is 6.7:1): pass. Item separators: dark 2.5 to 2.8:1 (token #5c4e63 is 2.6:1), light 3.4 to 3.8:1 (token #8f8095 is 3.7:1). JPEG captures at 2x; figures are close to the tokens.",
    "contrast_finding": {"id": "F7", "severity": "nit", "what": "The dark separators are under 3:1. They are decorative (12 px of spacing also separates the parts), so this is not a failure; but the dot inside «Claude Code · Opus 5.5» is drawn in the brighter text colour, so the inner dot outweighs the dots between parts and the runner and model read as two parts. Preference."},
    "test_finding": {"id": "F9", "severity": "risk", "status": "open", "what": "Outside what a user meets: SessionMetaLine.test.tsx line 32 expects the text '⎇ feat/ceo-window-place', but the component draws the branch sign as an SVG (BranchIcon) with no text, so the line's textContent has no '⎇' and the assertion fails as written; line 63, not.toContain('⎇'), now passes whatever happens, so the case of a branch left out is no longer tested. Static reading; the test was not run here (NOT_RUN). If a run confirms it, ci.sh fast is red, which blocks the unit's exit."},
    "brief_points": "1280: who and how (cut, time lost), account (short, whole on hover per code), organisation (cut), runner and model (whole), folder (cut to a generic prefix, press opens Finder per code), branch (cut to its prefix), Fabric id and agent id (present, press copies per code). 820: who (fragment), account (short), organisation (fragment), runner and model (whole), folder (fragment); branch, both ids and the time absent.",
    "blocking": "F1 (breaks: the folder and branch unreadable at rest at 1280, a regression of the folder the bar showed before); F9 if a test run confirms it.",
    "non_blocking": "F2, F3, F4, F5, F6 (risk) and F7, F8 (nit): board rows with this evidence unless the builder takes them with F1."
  },
  "resources": {"started": [], "live": [], "closed": true}
}
