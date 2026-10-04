# CO-179 native launcher recheck — assembled source54cefbbf

Root used CUA against the real Electron44 product renderer/preload built from
`54cefbbf0c9b71ad0c403689b90c790ceb7ed139`. The [checks](checks.json) verify
all four actual fixture markers against the current complete desktop source,
build bytes and test host. [Build log](build.log), copied per-fixture audits,
synthetic local Draft/settings bytes, native AX and PNGs are retained.

## Observed results

- EN/light/960 and RU/light/960 initial forms show Create and Cancel fully,
  with the launcher contained inside the sidebar. No launcher overlaps the form.
- Actual Shift-Tab twice from Name focuses the launcher in both locales;
  the AX receipts and gold focus rings are captured. Return opens the conversation
  panel. The typed host deliberately refuses `ceo:call`, so the panel shows its
  retained-draft error. This proves keyboard reachability, not a live conversation.
- RU/dark/960 retains the disabled Cloud reason. Native main scrolling reveals
  the lower select/Create/Cancel without launcher occlusion.
- EN's native select to Tab/Create focus and pointer-open observations are
  separate captures from its earlier processes.

## Preserved limits and unsuccessful attempts

The initial English fixture had two separate 120-second lifetime exits2. The
first backwards-tab attempt reached Fabric help, not the launcher; the help
capture is explicitly named and is not used as launcher proof. In the second,
CUA returned `timeoutReached` while saving further observations; those unsaved
files are not claimed. A fresh English fixture then produced the durable
keyboard-focus/open captures and exited0 after native quit. The Russian light
and dark fixtures also exited0. These outcomes are listed separately in checks.

The [older18-case matrix](../co179-native-9adebf88/README.md) retains its own
source/build pins, original visual defect and timeout. The only product source
change since that matrix is the [scoped launcher CSS correction](../2026-10-04-co179-native-review/README.md);
this packet reruns affected states, rather than relabeling all old cases as new.
The independent missing-reason mutants remain rejected.

This fixture is contained synthetic IPC/local storage. Production main,
Supabase, provider tools, a real chooser, real folder creation/git initialization,
VoiceOver, multiple windows, installed upgrade, full tier and release are not
accepted by this packet. No canonical task or scenario status is closed here.

Next: freeze the assembled source with its verified current queue, run the full
tier on owned PostgreSQL and disposable Supabase, and obtain fresh independent
reviews. [Current compiler replay](../unified-compiler-root-54cefbbf/README.md)
is a separate scoped receipt.
