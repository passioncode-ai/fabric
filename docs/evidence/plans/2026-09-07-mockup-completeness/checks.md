# Проверки макетов · 2026-09-07

Каждая запись ниже относится к вымышленным данным и собственному test scope.
Продуктовый runtime, DB, внешние провайдеры и агенты не запускаются.

| Проверка | Результат / квитанция |
|---|---|
| Source inventory | [315 baseline paths](source-inventory.json),0read errors; depth per file |
| Semantic gaps | [Матрица105](resolution-matrix.json); status не выводится из числа routes |
| Canonical model |61SCR /70views /80SCN /49FLW /35journeys /107taskcontexts /57active cards; `node scripts/check-product-model.mjs` |
| UX projection / generated HTML | `node scripts/sync-product-ux.mjs --check`; `node scripts/build-product-report.mjs --check`; `node scripts/build-mockup-coverage.mjs --check` |
| Graph + integration pure contracts | [95pass /0fail](all-mockup-pure-tests.txt); negativecases включены |
| Root workbench semantic | [33pass /0pageerrors](workbench-root-browser.json), exact inspected source hashes |
| Independent integration | [20groups](integrated-browser.json): new project/run,Proposal→task/memory,repo roundtrip,scope,Authority,goalgraph |
| Operations semantic | [41groups](operations-browser-check.json),32views×6states and375px; zero errors |
| Schedule semantic | [11checks](schedule-final-tests.txt), per-source failure/filter/shared history |
| Governance follow-up | [10groups /28geometrychecks](governance-followup.browser.json) |
| Feedback and source coverage function reviews | [6feedbackgroups](feedback-browser.json), [4coveragegroups](coverage-browser.json); root integration отдельно |
| Main browser | [JSON](browser-check.json):490view/state renders,176journey steps,12views×2widths×2themes, interactions,noJS,keyboard,contrast samples |
| Report review | [Матрица/ссылки/адаптивность](coverage-report-browser.json); отдельная проверка страницы приёмки |
| Repository gate | `bash scripts/ci.sh fast`; итог в `fast-ci.txt`. Full stack-backed probes в этой итерации не запускались |

Для повторения browser suite нужен Playwright, переданный через
`FABRIC_PLAYWRIGHT_MODULE` (CommonJS) или `PLAYWRIGHT_MODULE` (ESM).
Main/workbench используют локальный docs-server по `FABRIC_REPORT_BASE`;
integrated и module suites поднимают собственную isolated fixture surface.

```sh
node scripts/test/product-report.browser.cjs
node scripts/test/product-integrated.browser.cjs
node scripts/test/product-workbench.browser.cjs
node scripts/test/product-operations.browser.cjs
node scripts/test/product-schedule.browser.mjs
node scripts/test/product-graph-provenance.browser.mjs
```

[Контракт](../../../ux/mockup-contract.md), [исходная сверка экранов](screen-findings.md),
[исходная сверка документов](2026-09-07-source-findings.md) и [итог итерации](../2026-09-07-mockup-completeness.md)
определяют границы результата. Старые отчёты и receipts сохранены; re-run не
выдаётся за повторное подтверждение исторического runtime.
