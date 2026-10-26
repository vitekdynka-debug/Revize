import { describe, expect, it } from 'vitest';
import { ConstraintQueue } from './camera.js';

/** Fake track whose applyConstraints resolves only when the test says so. */
function fakeTrack() {
  const calls: unknown[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const pending: (() => void)[] = [];
  const track = {
    applyConstraints(constraints: { advanced: unknown[] }) {
      calls.push(constraints.advanced[0]);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise<void>((resolve) =>
        pending.push(() => {
          inFlight -= 1;
          resolve();
        }),
      );
    },
  } as unknown as MediaStreamTrack;
  const flush = async () => {
    while (pending.length) {
      pending.shift()!();
      await new Promise((r) => setTimeout(r, 0));
    }
  };
  return { track, calls, flush, maxInFlight: () => maxInFlight };
}

describe('ConstraintQueue', () => {
  it('never overlaps calls and coalesces a burst of zoom changes', async () => {
    const t = fakeTrack();
    const queue = new ConstraintQueue(t.track);
    void queue.set({ torch: true });
    for (let zoom = 1; zoom <= 3; zoom += 0.1) void queue.set({ zoom });
    const done = queue.set({ zoom: 3 });
    await t.flush();
    await done;

    expect(t.maxInFlight()).toBe(1);
    // First call with torch only, then one call carrying the final state of the whole burst.
    expect(t.calls).toEqual([{ torch: true }, { torch: true, zoom: 3 }]);
  });
});
