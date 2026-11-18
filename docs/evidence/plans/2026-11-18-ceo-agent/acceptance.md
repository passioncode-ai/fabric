# The CEO agent: acceptance walk (ADR-0197)

**Status:** in progress, 2026-11-18. The walk runs a development build of branch `feat/ceo-agent` with a data folder of its
own, against a disposable database stack (`scripts/test-stack.mjs`), never the operator's installed Fabric or its stack.
