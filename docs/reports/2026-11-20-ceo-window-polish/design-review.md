{
  "schema": "design-review/1",
  "surface": "Fabric desktop: the CEO window (SCN-110) and Главная's greeting block with the «Спросить CEO» card (SCN-182, SCN-163)",
  "surface_class": "internal",
  "panel_revision": "none: docs/ux/test-panel.md is absent; `design_gate.py panel docs/ux/test-panel.md` says NOT_RUN (exit 3). Personas come from docs/ux/foundation.md (P-01, last changed at 03311c85), not from a gated panel",
  "build_under_review": "working tree of the feat/ceo-window-place worktree, branch feat/ceo-window-place, uncommitted on 37d69d6a (= origin/main); captures it3-* are the final iteration",
  "method": "Captures only, no live app (the dispatcher's instruction). Each it3 capture compared with its before-* capture and with the scenario text (no Figma frame or mockup exists for the 2026-11-20 head). Contrast figures are estimates from capture pixels (WCAG relative luminance of the strongest glyph pixel against the sampled background), not a measurement of the CSS. The traffic lights are not drawn by the stand, so alignment with them is not judged.",
  "verdicts": [
    "Head buttons wrapping to two rows of mixed heights: RESOLVED. before-ceo-dark-520 puts «Перезапустить» on a second row and before-ceo-dark-380 stacks three rows; in it3 the head is one 52 px row at 520 and at 380.",
    "Filled yellow call button in the window against an outlined one on the home: RESOLVED. Both are the outlined small button (`btn btn-ghost btn-sm`) in it3-ceo-* and it3-home-*.",
    "Muddy faded-yellow disabled «Отправить»: RESOLVED in the CEO window and on the ask card. Before: dark text on a half-faded accent, about 3.8:1. It3: neutral fill with muted text, about 8.1:1 dark and 6.7:1 light.",
    "Empty band under the ask card's buttons: RESOLVED. The field takes the card's height; the buttons' bottom edge lines up with the greeting card's (it3-home-dark-1280, it3-home-light-1280).",
    "Name truncated to one letter at 380 px: RESOLVED. It is not in the before captures (before-ceo-dark-380 shows «Ника» whole); it1 introduced it («Н», it1-ceo-dark-380), it2 left a gap between name and state, it3 shows «Ника» whole with «на связи» beside it.",
    "The greeting block stays light: PASS. The greeting card is pixel-identical before and it3 except the live «Есть движение» dot (0 changed pixels dark, 112 in one 12 by 12 CSS px spot light); nothing was added to it.",
    "One system of buttons: PARTIAL. The CEO window and the ask card now share one height, one outline and one disabled look, but on the same home screen the decision card's disabled «Записать решение» became nearly invisible (regression, below), so two disabled primaries on one screen look different.",
    "Window movable and resizable: NOT_RUN. Captures cannot show a drag or a resize; the code makes the head a drag region with its buttons excluded (styles.css `.ceo-popup-head`) and the scenario cites `windowPlacement.test.ts`, but nothing was driven.",
    "Icon buttons' contrast at rest: PASS on the captures (stop and restart glyphs about 9.0:1 dark, 6.7:1 light, above the 3:1 non-text minimum). Hover, focus, pressed and disabled (busy) states: NOT_RUN.",
    "Hit targets of the 28 px buttons: NOT_RUN as a measurement. The stop and restart buttons are borderless, so their box is not visible in a capture; by the code (`components.css` `.btn-icon` 28 by 28) they exceed the WCAG 2.2 2.5.8 minimum of 24 by 24 CSS px, which is a code reading, not a test.",
    "Screen-reader names of stop and restart: NOT_RUN by screenshot. `CeoPopup.test.tsx` «the head is one row» asserts aria-label equals title on both, which is a unit test, not an assistive-technology run.",
    "Discoverability of the stop and restart signs: RISK, judgement only. No panel and no user observation back it."
  ],
  "blocking": [
    "B-1 (regression, observed): Главная's «Записать решение» in its empty, disabled state almost disappears in both themes. Before: a grey fill visible against the card (about 3.7:1) with text about 3.8:1 dark and 2.6:1 light. It3: the fill is 1.02:1 against the card (the button's shape is gone) and its text about 2.3:1 dark and 1.9:1 light. Cause by the code: the new `.lp-button.primary:disabled` neutral fill (launch/launch.css line 81) still sits under `.lp button:disabled{opacity:.4}` (line 83), so the fill is faded to 40%, while the window's `.btn` rule sets `opacity: 1`. It is blocking under the finish line because something that read clearly at the start now does not, and the SCN-110 amendment's claim «A primary button that cannot be pressed is a neutral fill everywhere» is false on this screen. The same rule reaches every `lp-button primary` (38 uses in 19 renderer files), of which only this one is captured. Severity by the checklist: risk (the step is not stopped: typing enables the button)."
  ],
  "non_blocking": [
    "N-1 (risk, judgement): the stop sign is a small filled square right after a worded «Позвонить» with a microphone; read beside a call control it suggests stopping the call or a recording rather than stopping the CEO. Its name exists only on hover and for a screen reader. Rests on judgement, not on a panel portrait or an observation.",
    "N-2 (nit, preference): at 380 px the three head controls take two treatments: an outlined microphone and two borderless signs. The outline does carry the hierarchy (the call is the secondary action, the signs are quiet).",
    "N-3 (nit, observed): at 380 px the runner line truncates to «работает на Claude C...», so the model name is not visible at the minimum width. A long Fabric name at 380 px is not captured (the fixture name has four letters).",
    "N-4 (nit, documentation drift, observed): SCN-182's UI elements still say «a two-line box»; the home field now fills the card (about five lines). SCN-110's amendment records the change, SCN-182 does not.",
    "N-5 (nit, preference): the taller empty field on the ask card draws more of the eye than the two-line box did; it reads as an invitation to write, not as a load, so it does not break the light greeting block.",
    "N-6 (nit, unverified): the enabled «Отправить» is not captured, so whether the neutral disabled fill differs clearly enough from the enabled look is not shown."
  ],
  "not_run": [
    "Moving, resizing and reopening the CEO window where it was left (SCN-110 step 3): no live window.",
    "The traffic lights' alignment with the 52 px head: the stand does not draw them.",
    "Every head state except running: starting, failed, stopped, ended, a call in progress (the red «Положить трубку», which at 380 px also collapses to a 28 px sign), busy stop and restart.",
    "Keyboard focus rings and order in the head and composer.",
    "Hover tooltips of the signs, screen-reader output, measured hit areas.",
    "Outcomes: a message reaching the CEO's console, stop and restart acting on the CEO.",
    "Other screens reached by the two global disabled-primary rules (`components.css` `.btn:not(.btn-ghost):not(.btn-quiet):not(.btn-danger):disabled`, `launch/launch.css` `.lp-button.primary:disabled`)."
  ],
  "rows": [
    {
      "scenario": "SCN-110", "step": 1, "persona": "P-01", "pass": "build", "round": 1,
      "frame": "scenario text only (SCN-110, amended 2026-11-20); no Figma frame or mockup for the new head; compared with before-ceo-*",
      "capture": "shots/it3-ceo-dark-520.png, shots/it3-ceo-light-520.png, shots/it3-ceo-dark-380.png",
      "engine": "chromium, by the stand's harness (scripts/test/screens-stand.browser.mjs launches Playwright chromium); the dispatcher did not name the engine",
      "outcome": "not read back: captures only",
      "checks": {"frame": "pass", "primary_action": "pass", "controls": "pass", "focus": "NOT_RUN", "states": "NOT_RUN", "text_fit": "pass", "outcome": "NOT_RUN"},
      "reason": "focus, states other than running, and the effect of stop, restart and call cannot be shown by static captures of a fixture stand",
      "findings": [
        {"severity": "risk", "what": "head buttons wrapped to two or three rows of mixed heights", "where": "CEO window head, before-ceo-dark-520 and before-ceo-dark-380; it3 is one 52 px row", "status": "fixed"},
        {"severity": "risk", "what": "the call was a filled yellow button in the window and an outlined one on the home", "where": "CEO window head; it3 uses btn-ghost btn-sm in both places", "status": "fixed"},
        {"severity": "risk", "what": "the CEO's name truncated to «Н» at 380 px (introduced in it1, not in before)", "where": "it1-ceo-dark-380; it3 shows «Ника» whole", "status": "fixed"},
        {"severity": "risk", "what": "N-1: the stop square beside a worded call with a microphone can read as stopping the call; its name is only a tooltip and an accessible name (judgement, no panel evidence)", "where": "CEO window head, it3-ceo-dark-520", "status": "open"},
        {"severity": "nit", "what": "N-2: at 380 px the head mixes an outlined microphone with borderless signs (preference)", "where": "it3-ceo-dark-380", "status": "open"},
        {"severity": "nit", "what": "N-3: the runner line loses the model name at 380 px; a long name is not captured", "where": "it3-ceo-dark-380, «работает на Claude C...»", "status": "open"}
      ]
    },
    {
      "scenario": "SCN-110", "step": 2, "persona": "P-01", "pass": "build", "round": 1,
      "frame": "scenario text only (SCN-110 step 2); compared with before-ceo-*",
      "capture": "shots/it3-ceo-dark-520.png, shots/it3-ceo-light-520.png, shots/it3-ceo-dark-380.png (composer at the foot)",
      "engine": "chromium, by the stand's harness (assumed, see row 0)",
      "outcome": "not read back: nothing was typed or sent",
      "checks": {"frame": "pass", "primary_action": "pass", "controls": "pass", "focus": "NOT_RUN", "states": "NOT_RUN", "text_fit": "pass", "outcome": "NOT_RUN"},
      "reason": "only the empty composer is captured: enabled, sending and sent states, focus and the console's answer are not",
      "findings": [
        {"severity": "risk", "what": "disabled «Отправить» was a faded accent that read as a muddy colour of its own (text about 3.8:1)", "where": "before-ceo-dark-520; it3 neutral fill, text about 8.1:1 dark, 6.7:1 light", "status": "fixed"},
        {"severity": "nit", "what": "N-6: the enabled «Отправить» is not captured, so the difference between disabled and enabled is not shown", "where": "CEO composer", "status": "open"}
      ]
    },
    {
      "scenario": "SCN-110", "step": 3, "persona": "P-01", "pass": "build", "round": 1,
      "frame": "scenario text only (SCN-110 step 3 and the 2026-11-20 amendment: move by the head, resize to 380 by 420, reopen where left)",
      "capture": "",
      "engine": "none: no live window",
      "outcome": "not read back",
      "checks": {"frame": "NOT_RUN", "primary_action": "NOT_RUN", "controls": "NOT_RUN", "focus": "NOT_RUN", "states": "NOT_RUN", "text_fit": "NOT_RUN", "outcome": "NOT_RUN"},
      "reason": "moving, resizing and placement memory need a running macOS window; the review was ordered over captures only",
      "findings": []
    },
    {
      "scenario": "SCN-182", "step": 1, "persona": "P-01", "pass": "build", "round": 1,
      "frame": "scenario text only (SCN-182 UI elements, SCN-110 amendment); compared with before-home-*",
      "capture": "shots/it3-home-dark-1280.png, shots/it3-home-light-1280.png",
      "engine": "chromium, by the stand's harness (assumed, see row 0)",
      "outcome": "not read back: nothing was sent",
      "checks": {"frame": "pass", "primary_action": "pass", "controls": "pass", "focus": "NOT_RUN", "states": "NOT_RUN", "text_fit": "pass", "outcome": "NOT_RUN"},
      "reason": "only the empty card is captured: attachments, sent, too-large file and focus are not",
      "findings": [
        {"severity": "risk", "what": "an empty band of about 65 CSS px hung under «Приложить файл» and «Отправить»", "where": "before-home-*; it3 field fills the card and the buttons align with the greeting card's bottom", "status": "fixed"},
        {"severity": "nit", "what": "N-4: SCN-182 still says «a two-line box»; the box now fills the card", "where": "docs/ux/scenarios.md SCN-182 UI elements", "status": "open"},
        {"severity": "nit", "what": "N-5: the taller empty field is more prominent than the two-line box (preference; the block still reads light)", "where": "it3-home-*-1280, «Спросить CEO» card", "status": "open"}
      ]
    },
    {
      "scenario": "SCN-163", "step": 1, "persona": "P-01", "pass": "build", "round": 1,
      "frame": "scenario text only (SCN-163 step 1 and amendments); compared with before-home-*",
      "capture": "shots/it3-home-dark-1280.png, shots/it3-home-light-1280.png",
      "engine": "chromium, by the stand's harness (assumed, see row 0)",
      "outcome": "greeting card unchanged by pixel diff (0 px dark; 112 px light, the live «Есть движение» dot); no decision recorded",
      "checks": {"frame": "pass", "primary_action": "fail", "controls": "pass", "focus": "NOT_RUN", "states": "NOT_RUN", "text_fit": "pass", "outcome": "NOT_RUN"},
      "reason": "recording a decision, focus and the card's enabled state are not captured",
      "findings": [
        {"severity": "risk", "what": "B-1, regression: the disabled «Записать решение» lost its shape (fill 1.02:1 against the card) and its text fell to about 2.3:1 dark and 1.9:1 light, from about 3.8:1 and 2.6:1 with a visible fill; `.lp button:disabled{opacity:.4}` stacks on the new neutral fill, unlike the window's `.btn` rule with `opacity: 1`. Blocking under the finish line: it worked at the start, and SCN-110's «neutral fill everywhere» claim is false here", "where": "Главная, «Нужны вы» decision card, it3-home-dark-1280 and it3-home-light-1280 against before-home-*", "status": "open"}
      ]
    }
  ],
  "resources": {"started": [], "live": [], "closed": true}
}
