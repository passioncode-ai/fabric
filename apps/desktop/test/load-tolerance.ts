// The renderer suite runs on a loaded machine (lifecycle audit 2026-10-03): the scheduled workspace
// sync ran `ci.sh fast` at load averages of 35–135, and four specs that pass 40/40 in isolation failed
// there on Testing Library's 1 s default wait — a different spec each run. A wait that is about "the
// interface eventually shows X" must not fail because the machine is busy; a spec about timing sets
// its own deadline explicitly.
import { configure } from '@testing-library/react'

configure({ asyncUtilTimeout: 10_000 })
