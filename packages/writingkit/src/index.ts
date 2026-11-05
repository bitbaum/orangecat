/** The host's identity must distinguish accounts, tenants and drafts where relevant. */
export interface WritingRevision {
  readonly documentId: string;
  readonly revision: string | number;
}

export interface WritingOperation {
  readonly base: WritingRevision;
  readonly signal: AbortSignal;
}

export type WritingOutcome =
  | { readonly status: 'applied' | 'stale' | 'cancelled' | 'busy' }
  | { readonly status: 'failed'; readonly error: unknown };

type Pending = WritingOperation & { readonly epoch: number };

/**
 * One operation owner per editing workspace. The host supplies transport and
 * a synchronous apply callback; only a response for the current revision applies.
 * This is a browser/editing guard, never a replacement for server authorization
 * or an optimistic database revision check.
 */
export class WritingSession {
  private current: WritingRevision;
  private epoch = 0;
  private pending: (Pending & { readonly controller: AbortController }) | null = null;
  private closed = false;

  constructor(base: WritingRevision) {
    this.current = Object.freeze({ ...base });
  }

  get busy(): boolean {
    return this.pending !== null;
  }

  /** Call on every committed revision, including changes later reverted. */
  update(next: WritingRevision): boolean {
    if (this.closed) {
      return false;
    }
    const switched = next.documentId !== this.current.documentId;
    if (!switched && next.revision === this.current.revision) {
      return false;
    }
    this.current = Object.freeze({ ...next });
    this.epoch++;
    if (switched) {
      this.cancel();
    }
    return true;
  }

  /**
   * A provider may ignore AbortSignal: identity/revision checks still reject its
   * answer. Keep apply synchronous so no await separates validation from editing.
   */
  async run<T>(
    work: (operation: WritingOperation) => Promise<T>,
    apply: (value: T, base: WritingRevision) => undefined
  ): Promise<WritingOutcome> {
    if (this.closed) {
      return { status: 'cancelled' };
    }
    if (this.pending) {
      return { status: 'busy' };
    }
    const controller = new AbortController();
    const operation = {
      base: this.current,
      epoch: this.epoch,
      signal: controller.signal,
      controller,
    };
    this.pending = operation;
    try {
      const value = await work({ base: operation.base, signal: operation.signal });
      const status = this.status(operation);
      if (status !== 'current') {
        return { status };
      }
      apply(value, operation.base);
      return { status: 'applied' };
    } catch (error) {
      const status = this.status(operation);
      return status === 'current' ? { status: 'failed', error } : { status };
    } finally {
      // An old cancellation/completion must never clear the next operation.
      if (this.pending === operation) {
        this.pending = null;
      }
    }
  }

  cancel(): void {
    const pending = this.pending;
    this.pending = null;
    pending?.controller.abort();
  }

  /** Dispose synchronously when the editor/account/draft is removed. */
  dispose(): void {
    this.closed = true;
    this.cancel();
  }

  private status(operation: Pending): 'current' | 'stale' | 'cancelled' {
    if (this.closed || this.pending !== operation || operation.signal.aborted) {
      return 'cancelled';
    }
    return operation.epoch === this.epoch ? 'current' : 'stale';
  }
}
