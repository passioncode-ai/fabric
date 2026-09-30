# Проверки и доставка

Baseline: a838073de097be1ce136730c8ef41070929a7196, 14 сентября 2026.

| Проверка | Результат | Граница |
|---|---|---|
| project-audit collector | 8 probes ran, 1 blind; 18 кандидатов разобраны вручную | Не security-сертификат; вывод коллектора сохранён отдельно |
| Два подсчёта дерева Git | 1501 = 1501 | До добавления отчёта |
| История | 473 записи сохранены с полными SHA | Git-baseline, без переписки незакоммиченных сессий |
| gh release list | [] | GitHub Releases, не локальные сборки |
| gh run list | 60 запусков, агрегаты в ci-sample.json | Последние 11–12 сентября |
| workspace status | source 29950b9, child 40e6d0f, child verified | Локальный pin/snapshot, не remote UI |
| Браузер remote wiki | ERR_INVALID_AUTH_CREDENTIALS | Remote render не проверен |
| Браузер local snapshot | Главная вики → prototype SCR-30 → только макет | Demo, ru/dark, кадр 1280×720; runtime не запущен |
| baseline bash scripts/ci.sh fast | exit 1: installed CLI versions differ from capability matrix | Не изменять матрицу без probes |
| latest remote ci 34719611230 | 5 unresolved workspace symbols in child-absent checkout | Локально child существует; это отдельный CI-scope finding |
| agent-sync status/reconcile | mirror drift 122 pages; reconcile exit 1 | Исторические пробелы as-built не равны отсутствию кода |

Final branch checks and remote delivery are appended below after execution. No product release, new scenario implementation or published runtime is claimed by this audit.

## Source review checks

- `pnpm gates:docs`: exit 0 after refreshing the unchanged M131 receipt and rebuilding its completeness/plan projections. The first post-edit run correctly refused the stale backlog digest; the cited M131 row remained byte-identical.
- `node scripts/check-registers.mjs`: exit 0; 165 carry-over rows, 197 milestones, 1549 verification rows. CO-165 was reserved through agent-sync; its printed numeric reservation is normalized to this repository’s three-digit CO scheme.
- `node scripts/check-design-map.mjs`: exit 0 after content review and refresh; 260 unique anchors.
- Audit Markdown local paths and short commit refs: resolved; HTML local links and 17 unique IDs: resolved.
- Audit HTML opened in CUA browser; board section and table-of-contents visually inspected. This is report readability, not a new product UI acceptance.
- Historical token matches independently traced to test paths in db7eb4e/d2a215f/dc5f794; values omitted.
- Remote wiki publication is pending: the source fast gate has a pre-existing provider-capability blocker; this planning branch must not be represented as deployed.

Final `bash scripts/ci.sh fast` after source/projection updates: **exit 1**, same two installed-provider-version mismatches as baseline. Documentation/model/register checks and preceding pure checks passed. This is a known pre-existing release prerequisite, not a green fast run. No capabilities matrix was relabelled and no installed agent was launched to bypass it.

Source-only handoff is authorized by the repository standing instruction. The publication remains on its previous receipt; this branch is for review, not merged and not a product release. All sibling remote main SHAs were read with `git ls-remote` and match repositories.json.

## Remote handoff verification

- Source report committed and pushed: `d96006e0024a33f4641231f6225fe023cb52f05c`, remote branch `codex/context-audit-2026-09-14`; `git ls-remote` returned that exact SHA.
- A fresh shallow clone of that remote branch resolved all **25 local Markdown links** in the audit folder, retained **473 history entries**, and contained the standalone HTML report. Reading the audit did not require initializing the private workspace child. The temporary checkout was removed after verification.
- Coordination `record` acknowledged the source report and its bounded scope. Existing reconcile debt remains described above; this record does not assert that old missing entries were repaired.
- This delivery-receipt addition is a follow-up documentation commit; it does not change product behavior or publish the workspace. The map gate refused reuse of the committed iteration anchor, so the handoff receives its own top entry and reviewed stamp in the following correction.
