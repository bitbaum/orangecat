import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WritingSession } from '@bitbaum/writingkit';

const base = { documentId: 'account-a:draft-a', revision: 0 };
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test('applies a proposal against its captured revision', async () => {
  const session = new WritingSession(base);
  const result = await session.run(
    async ({ base: captured, signal }) => {
      assert.deepEqual(captured, base);
      assert.equal(signal.aborted, false);
      return 'A draft';
    },
    (text, captured) => {
      assert.equal(text, 'A draft');
      assert.deepEqual(captured, base);
    }
  );
  assert.equal(result.status, 'applied');
  assert.equal(session.busy, false);
});

test('generation and editing cannot start together in the same tick', async () => {
  const session = new WritingSession(base);
  const waiting = deferred();
  let calls = 0;
  const first = session.run(
    () => {
      calls++;
      return waiting.promise;
    },
    () => {}
  );
  assert.equal(session.busy, true);
  assert.equal(
    (
      await session.run(
        async () => {
          calls++;
        },
        () => {}
      )
    ).status,
    'busy'
  );
  assert.equal(calls, 1);
  waiting.resolve('draft');
  assert.equal((await first).status, 'applied');
});

test('manual edits invalidate a pending answer even when later reverted', async () => {
  const session = new WritingSession(base);
  const waiting = deferred();
  let applied = false;
  const result = session.run(
    () => waiting.promise,
    () => {
      applied = true;
    }
  );
  session.update({ ...base, revision: 1 });
  session.update(base);
  waiting.resolve('old answer');
  assert.equal((await result).status, 'stale');
  assert.equal(applied, false);
  assert.equal(session.busy, false);
});

test('synchronizing the same revision does not invalidate a request', async () => {
  const session = new WritingSession(base);
  const waiting = deferred();
  const result = session.run(
    () => waiting.promise,
    () => {}
  );
  assert.equal(session.update({ ...base }), false);
  waiting.resolve('draft');
  assert.equal((await result).status, 'applied');
});

test('switching accounts or documents aborts and allows the new operation immediately', async () => {
  const session = new WritingSession(base);
  const waiting = deferred();
  let oldSignal;
  let applied = '';
  const old = session.run(
    ({ signal }) => {
      oldSignal = signal;
      return waiting.promise;
    },
    () => {
      applied = 'old';
    }
  );
  session.update({ documentId: 'account-b:draft-a', revision: 0 });
  assert.equal(oldSignal.aborted, true);
  assert.equal(session.busy, false);
  const next = await session.run(
    async ({ base: captured }) => captured.documentId,
    value => {
      applied = value;
    }
  );
  assert.equal(next.status, 'applied');
  waiting.resolve('old');
  assert.equal((await old).status, 'cancelled');
  assert.equal(applied, 'account-b:draft-a');
});

test('a cancelled provider ignoring abort cannot apply or clear the next operation', async () => {
  const session = new WritingSession(base);
  const oldResponse = deferred(),
    nextResponse = deferred();
  let applied = '';
  const old = session.run(
    () => oldResponse.promise,
    () => {
      applied = 'old';
    }
  );
  session.cancel();
  const next = session.run(
    () => nextResponse.promise,
    () => {
      applied = 'next';
    }
  );
  oldResponse.resolve('old');
  assert.equal((await old).status, 'cancelled');
  assert.equal(session.busy, true);
  assert.equal(applied, '');
  nextResponse.resolve('next');
  assert.equal((await next).status, 'applied');
  assert.equal(applied, 'next');
  assert.equal(session.busy, false);
});

test('late errors from cancelled and stale operations do not become current errors', async () => {
  for (const status of ['cancelled', 'stale']) {
    const session = new WritingSession(base);
    const waiting = deferred();
    const result = session.run(
      () => waiting.promise,
      () => assert.fail('must not apply')
    );
    if (status === 'cancelled') {
      session.cancel();
    } else {
      session.update({ ...base, revision: 1 });
    }
    waiting.reject(new Error('old provider failure'));
    assert.deepEqual(await result, { status });
  }
});

test('a current provider failure releases the workspace for retry', async () => {
  const session = new WritingSession(base);
  const error = new Error('provider unavailable');
  assert.deepEqual(
    await session.run(
      async () => {
        throw error;
      },
      () => {}
    ),
    { status: 'failed', error }
  );
  assert.equal(session.busy, false);
  assert.equal(
    (
      await session.run(
        async () => 'retry',
        () => {}
      )
    ).status,
    'applied'
  );
});

test('disposing during a request rejects late responses and all new work', async () => {
  const session = new WritingSession(base);
  const waiting = deferred();
  let signal;
  const old = session.run(
    operation => {
      signal = operation.signal;
      return waiting.promise;
    },
    () => assert.fail('disposed apply')
  );
  session.dispose();
  assert.equal(signal.aborted, true);
  assert.equal(session.update({ ...base, revision: 1 }), false);
  assert.equal(
    (
      await session.run(
        () => assert.fail('disposed work'),
        () => {}
      )
    ).status,
    'cancelled'
  );
  waiting.resolve('old');
  assert.equal((await old).status, 'cancelled');
});

test('external mutation cannot change a captured identity/revision', async () => {
  const mutable = { ...base };
  const session = new WritingSession(mutable);
  mutable.documentId = 'other';
  mutable.revision++;
  await session.run(
    async ({ base: captured }) => {
      assert.equal(Object.isFrozen(captured), true);
      assert.deepEqual(captured, base);
    },
    () => {}
  );
});

test('abort listeners cannot make cancellation clear a reentrant new request', async () => {
  const session = new WritingSession(base);
  const oldResponse = deferred(),
    nextResponse = deferred();
  let next;
  const old = session.run(
    ({ signal }) => {
      signal.addEventListener('abort', () => {
        next = session.run(
          () => nextResponse.promise,
          () => {}
        );
      });
      return oldResponse.promise;
    },
    () => assert.fail('cancelled apply')
  );
  session.cancel();
  assert.equal(session.busy, true);
  oldResponse.resolve('old');
  assert.equal((await old).status, 'cancelled');
  assert.equal(session.busy, true);
  nextResponse.resolve('next');
  assert.equal((await next).status, 'applied');
});

test('an apply callback may commit a new revision without invalidating its own result', async () => {
  const session = new WritingSession(base);
  const result = await session.run(
    async () => 'accepted',
    () => {
      session.update({ ...base, revision: 1 });
    }
  );
  assert.equal(result.status, 'applied');
  assert.equal(session.busy, false);
});
