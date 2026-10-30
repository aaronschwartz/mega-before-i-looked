import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight', () => {
  it('aggregates runs/2026-10-28.jsonl into 5 jobs and counts the bad line', () => {
    const digest = readNight('runs', '2026-10-28');
    expect(digest).not.toBeNull();
    expect(digest!.badLines).toBe(1);
    expect(digest!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(digest!.rows).toHaveLength(5);

    const render = digest!.rows.find((r) => r.job === 'digest/render')!;
    expect(render.owner).toBeNull();
    expect(render.lastStatus).toBe('ok');

    const backup = digest!.rows.find((r) => r.job === 'notes/backup')!;
    expect(backup.lastStatus).toBe('fail');
    expect(backup.lastError).toBe('quota exceeded');

    const refresh = digest!.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(refresh.retries).toBe(3);
    expect(refresh.runs).toBe(4);
    expect(refresh.lastStatus).toBe('ok');
  });

  it('returns null when the night file is missing', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
  });
});
