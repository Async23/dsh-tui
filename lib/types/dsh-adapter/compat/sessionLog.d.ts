/**
 * Legacy third-party session-event types the TUI vouches for as ephemeral
 * UI frames — safe for the strict read path to accept and skip. Exported
 * for the regression verifier; grow it only with proof the type was always
 * inert (never load-bearing for session reconstruction).
 */
export declare const LEGACY_SESSION_EVENT_TYPES: readonly string[];
/**
 * Session-log storage roots, in priority order, mirroring the persistence
 * backend's `root` resolution: cordis.patch.yml sets `DSH_TUI_SESSION_ROOT ?? dshHomePath(
 * 'sessions')` where dshHomePath is `$DSH_HOME ?? ~/.dsh`; the unpatched
 * cordis.yml base falls back to ~/.dsh-tui/sessions, kept here as the legacy
 * last resort. Every candidate is scanned — the first hit wins, so an
 * explicit DSH_TUI_SESSION_ROOT always outranks the defaults.
 */
export declare function sessionsRoots(): string[];
/**
 * Register every {@link LEGACY_SESSION_EVENT_TYPES} type as known in EVERY
 * reachable KNOWN_SESSION_EVENT_TYPES copy, ahead of the strict read path
 * (`agents.resume` seed validation, `persistence.load`). Idempotent; never
 * throws.
 *
 * Why "every reachable copy": a runtime can load dsh-session more than once
 * (CLI tree vs plugin profile tree, or version overlap during upgrades), and
 * the strict validator consults only ITS copy's Set. Anchors: this module
 * (the dsh-tui tree), the process entry point (the launcher tree the
 * backend hangs off), and the installed dsh-session-persistence package
 * (the tree the validator itself resolves from). A copy that cannot be
 * resolved from an anchor simply is not there.
 */
export declare function ensureLegacySessionEventTypes(): void;
/**
 * Read a session's display title from its persisted log, tolerantly.
 *
 * Why not `persistence.load()`: the backend validates every event against
 * KNOWN_SESSION_EVENT_TYPES and throws the WHOLE load when a third-party
 * plugin wrote an unmarked unknown type. A picker label is
 * read-only UI state: decoding frames directly here keeps titles working
 * for logs the strict path refuses, now and for future plugin event types.
 *
 * Title precedence: the LAST `session/title` event wins (a /rename append
 * overrides the first-prompt auto title), falling back to the first user
 * message text. `hasUserMessage` drives the picker's launch-artifact filter.
 * @param sessionId - Session whose log should be read.
 * @returns The title info, or undefined when the log is absent/undecodable.
 */
export declare function readSessionTitleFromLog(sessionId: string): {
    title?: string;
    hasUserMessage: boolean;
} | undefined;
/**
 * Append a `session/title` event to a persisted session's log — the
 * `/resume` picker rename for a NON-LIVE session (the live one goes through
 * `session.append` in the channel). The backend flushes by appending zstd
 * frames, so the new event lands as one more frame: existing bytes stay
 * untouched (the frame-0 header invariant holds), and `last title wins` in
 * {@link readSessionTitleFromLog} surfaces the new name. The seq continues
 * the log's contiguity contract (seq = event count) by taking maxSeq + 1.
 * The frame is APPEND-ONLY (O_APPEND), matching the backend's own flush
 * discipline: this store is shared with dsh web (#24), and a
 * read-concat-rewrite (tmp + rename) would silently drop a frame another
 * writer lands between our read and replace. A single append never rewrites
 * existing bytes, so concurrent frames all survive; the worst remaining
 * race is a duplicate seq when the maxSeq read above passes another
 * appender — benign next to lost frames, since last-title-wins keeps the
 * rename semantics. Never throws.
 * @param sessionId - Session to rename.
 * @param title - New display title (already trimmed by the caller).
 * @returns 'appended', or 'unavailable' when the log is absent/undecodable.
 */
export declare function appendSessionTitle(sessionId: string, title: string): 'appended' | 'unavailable';
/**
 * Delete a persisted session's log directory (`<root>/<workspace>/<id>/`),
 * the `/resume` picker delete. The directory holds only session.jsonl.zstd
 * today; removing it whole keeps future sidecar files from orphaning. The
 * backend's list() materializes entries from these logs, so the session
 * drops out of the picker on the next refresh. Never throws.
 * @param sessionId - Session to delete (must not be the live session).
 * @returns 'deleted', or 'unavailable' when the log is absent.
 */
export declare function deleteSessionLog(sessionId: string): 'deleted' | 'unavailable';
//# sourceMappingURL=sessionLog.d.ts.map