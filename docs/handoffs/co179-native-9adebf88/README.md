# CO-179 actual native observations — source 9adebf88

Root drove eighteen contained Electron 44 fixtures through CUA. Every fixture
pins source `9adebf88964df6e3cffb13c016863ca981459674`, the complete desktop source
tree, test host, compiled local-state modules and production renderer/preload.
The product renderer/build bytes are unchanged from the assembled
`2e06e5013595ec96b52b85cae2c486050632565b` build. This packet is **not an overall
visual acceptance**: the initial EN/light/960 observation exposed launcher
occlusion, and its independent scoped repair is pending.

## Executed cases and receipts

[Executed matrix](executed-matrix.json) records configurations and actual audit
events for every launched case. [Disk/audit checks](disk-audit-checks.json) passed
the stated bounded assertions; [artifact hashes](artifact-hashes.json) identify
the copied markers, audits, synthetic local-state files, native AX text and PNGs.
The older `prepared-matrix.json` is a preparation record, not an execution claim.

| Cases | Native observation and limits |
|---|---|
| EN/dark/640; RU/dark/640 | Lower controls become fully visible using the native main scroller. EN empty backend list leaves Memory absent; it does not invent a backend. Native checkbox keyboard toggle is confirmed by the subsequent folder command's `git=false`. |
| EN/light/960 single; RU/dark/960 two | Single backend uses the existing statement; two choices expose native radios and Cloud selection. The initial EN frame partially overlaps Create project with the launcher. Scrolling resolves reachability, but does not erase the initial visual defect; both frames are retained. |
| EN/dark/1440; RU/light/1440 | Wide form and lower controls observed. |
| EN/dark/long/760 | Long synthetic ASCII repository path wraps inside the form with Remove retained. |
| RU/light/2x; RU/dark/2x; EN/light/2x | Actual BrowserWindow zoom factor 2; configured content size 1280×1000 gives CSS viewport 640×500. Top and lower controls observed with native scrolling. RU light native select, disabled agent option, Tab/Shift-Tab focus captured. |
| EN/light/2x non-ASCII continuation | Actual Name paste `Проект 📚 — проверка длинного имени`, then synthetic folder command; full wrapping Cyrillic/emoji path and Remove are visible in `en-light-2x-non-ascii-path-visible.png`. The earlier `non-ascii-path.png` was below the path and is not used as path visibility proof. |
| EN refusal | One project-create request; native refusal banner; name and purpose remain. No successful response. |
| RU saving | Disabled pending Create button observed across a 20-second synthetic response delay; exactly one project-create request. Successful synthetic response reaches the project destination, whose unregistered handlers are refused by the host and produce an empty screen. That destination is **NOT accepted** by this fixture. |
| EN unread | Memory choices absent while the 20-second read is pending, then Local and disabled Cloud reason appear. This observes the existing behavior; it does not claim that submit is disabled during the read. |
| EN exists; RU outside; EN failed | Distinct folder refusal reasons visible; form retained, no repository attached. |
| RU creating | Disabled pending folder button observed; audit records successful response after 20 seconds. First process hit the fixture's 120-second lifetime and exited 2; root did not observe live completion in that process. A deliberate second process restored the resulting synthetic attached path and captured the cancel warning that the created folder remains. Second process exited 0. |
| EN cancel | Synthetic parent chooser returns null; no folder-create request; existing form retained. |
| EN/dark/640 folder continuation | Synthetic parent chosen before folder command; attach, Remove and leftover-folder notice observed. The host does not create a real folder or run git init. |

All other seventeen first processes exited 0 after explicit native quit. RU
creating's timeout is retained in its audit; its later successful restart is a
separate observation, not a relabeling of that exit. Parent selection precedes
all three successful synthetic folder commands. No network attempt is recorded.

## Authority and acceptance boundary

This is the real production renderer/preload and Draft/local-state code against
typed, bounded synthetic IPC, not production main, Supabase, provider tools,
terminal launch, a real native folder chooser, filesystem folder creation or git
initialization. Fixtures use only owned temporary storage. Their successful
project response does not prove persistence to the production database.

The invalid destination screen, initial launcher occlusion and timeout are kept
as evidence. VoiceOver, production startup focus, multi-window behavior,
production/provider/DB acceptance, installed upgrade, full tier and release are
NOT_RUN here. No canonical task or release gate is closed by this packet.

Next task: integrate the independent onboarding-scoped launcher repair and
critical-reason negative visual control, rerun affected native observations on
the new product bytes, then freeze the assembled source for full and independent
acceptance checks. The separate [AD02 recovery packet](../ad02-native-2e06e501/README.md)
remains its earlier bounded source cut.
