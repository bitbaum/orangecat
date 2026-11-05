/** The host's identity must distinguish accounts, tenants and drafts where relevant. */
export interface WritingRevision {
    readonly documentId: string;
    readonly revision: string | number;
}
export interface WritingOperation {
    readonly base: WritingRevision;
    readonly signal: AbortSignal;
}
export type WritingOutcome = {
    readonly status: 'applied' | 'stale' | 'cancelled' | 'busy';
} | {
    readonly status: 'failed';
    readonly error: unknown;
};
/**
 * One operation owner per editing workspace. The host supplies transport and
 * a synchronous apply callback; only a response for the current revision applies.
 * This is a browser/editing guard, never a replacement for server authorization
 * or an optimistic database revision check.
 */
export declare class WritingSession {
    private current;
    private epoch;
    private pending;
    private closed;
    constructor(base: WritingRevision);
    get busy(): boolean;
    /** Call on every committed revision, including changes later reverted. */
    update(next: WritingRevision): boolean;
    /**
     * A provider may ignore AbortSignal: identity/revision checks still reject its
     * answer. Keep apply synchronous so no await separates validation from editing.
     */
    run<T>(work: (operation: WritingOperation) => Promise<T>, apply: (value: T, base: WritingRevision) => undefined): Promise<WritingOutcome>;
    cancel(): void;
    /** Dispose synchronously when the editor/account/draft is removed. */
    dispose(): void;
    private status;
}
