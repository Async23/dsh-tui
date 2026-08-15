/**
 * Compat boundary — every inelegant patch aimed at the harness core lives
 * here, behind one import seam, so the render/interaction code stays clean.
 *
 * House rules for modules in this directory:
 *  - Each patch carries its own capability probe and self-disables or
 *    degrades to pre-patch behavior when upstream absorbs the quirk.
 *  - A patch must never throw into the caller: failure means "act as if the
 *    patch did not exist".
 *  - A patch states plainly which upstream change would retire it.
 *
 * Current residents:
 *  - sessionLog: tolerant title reads plus offline rename/delete helpers for
 *    persisted sessions that are not currently owned by a live Agent, and
 *    the pre-resume repair marking third-party session-event types
 *    `ignorable` — retiring the day `session.append` exposes `ignorable`
 *    or the types enter KNOWN_SESSION_EVENT_TYPES upstream (issue #153).
 * @module @deepseek-harness-tui/dsh-tui/compat
 */
export { appendSessionTitle, deleteSessionLog, prepareSessionForResume, readSessionTitleFromLog, repairSessionLogForResume, sessionsRoots, } from './sessionLog.js';
export type { ResumeRepairOutcome } from './sessionLog.js';
//# sourceMappingURL=index.d.ts.map