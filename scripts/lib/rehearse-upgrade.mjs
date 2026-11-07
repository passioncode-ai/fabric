// #region rehearse-upgrade — docs: docs/launch/release-mac.md#upgrading-an-existing-database
// The pure half of the upgrade rehearsal (CO-198) lives in the app since CO-364, so the runbook's script and the
// app's schema step at start judge with one code: `apps/desktop/src/shared/upgradeRehearsal.ts`.
export { PG_MAJOR, isPgMajor, dumpProblems, RESTORED_SCHEMAS, restoreList, judge, receipt } from '../../apps/desktop/src/shared/upgradeRehearsal.ts'
// #endregion rehearse-upgrade
