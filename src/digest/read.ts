import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, NightDigest } from './types.js';

type LogLine = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error?: string;
};

const STATUSES = new Set<DigestStatus>(['ok', 'retry', 'fail']);

function parseLine(line: string): LogLine | null {
  try {
    const raw = JSON.parse(line) as Record<string, unknown>;
    if (typeof raw.at !== 'string' || typeof raw.job !== 'string') return null;
    if (typeof raw.status !== 'string' || !STATUSES.has(raw.status as DigestStatus)) return null;
    const owner = raw.owner === null || raw.owner === undefined ? null : typeof raw.owner === 'string' ? raw.owner : null;
    if (raw.owner !== null && raw.owner !== undefined && typeof raw.owner !== 'string') return null;
    const error = typeof raw.error === 'string' ? raw.error : undefined;
    return { at: raw.at, job: raw.job, status: raw.status as DigestStatus, owner, error };
  } catch {
    return null;
  }
}

export function readNight(runsDir: string, night: string): NightDigest | null {
  const path = join(runsDir, `${night}.jsonl`);
  if (!existsSync(path)) return null;

  const text = readFileSync(path, 'utf8');
  if (text.length === 0) return { rows: [], badLines: 0 };

  const lines = text.split('\n');
  // Trailing newline yields an empty last segment — ignore empty segments.
  const byJob = new Map<string, DigestRow>();
  let badLines = 0;

  for (const line of lines) {
    if (line === '') continue;
    const parsed = parseLine(line);
    if (!parsed) {
      badLines += 1;
      continue;
    }
    const existing = byJob.get(parsed.job);
    if (!existing) {
      byJob.set(parsed.job, {
        job: parsed.job,
        owner: parsed.owner,
        runs: 1,
        retries: parsed.status === 'retry' ? 1 : 0,
        lastStatus: parsed.status,
        lastError: parsed.error ?? null,
        firstAt: parsed.at,
        lastAt: parsed.at,
      });
      continue;
    }
    existing.runs += 1;
    if (parsed.status === 'retry') existing.retries += 1;
    existing.lastStatus = parsed.status;
    existing.lastError = parsed.error ?? null;
    existing.lastAt = parsed.at;
    existing.owner = parsed.owner;
  }

  const rows = [...byJob.values()].sort((a, b) => a.job.localeCompare(b.job));
  return { rows, badLines };
}
