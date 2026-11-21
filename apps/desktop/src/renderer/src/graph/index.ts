// #region graph-views — docs: docs/evidence/specs/2026-11-20-memory-dashboard.md#6-one-graph-module
// @fabric/graph's views in Fabric's window: one module for Memory, the decision graph and every page that draws a graph.
import './graph.css'
export { GraphMap, type GraphMapProps } from './GraphMap'
export { GraphTable, type GraphTableColumn, type GraphTableProps } from './GraphTable'
export { GraphTimeline, type GraphTimelineProps } from './GraphTimeline'
export * from '@fabric/graph/model'
// #endregion graph-views
