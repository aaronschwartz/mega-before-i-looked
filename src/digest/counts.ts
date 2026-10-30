import { readNight } from './read.js';
import type { DigestStatus } from './types.js';

export type NightCounts = { ok: number; retry: number; fail: number };

export function countsForNight(runsDir: string, night: string): NightCounts {
  const digest = readNight(runsDir, night);
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  if (!digest) return counts;
  for (const row of digest.rows) {
    const key = row.lastStatus as DigestStatus;
    counts[key] += 1;
  }
  return counts;
}
