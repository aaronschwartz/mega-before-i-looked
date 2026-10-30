import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';

function appWithRuns(runsDir: string) {
  return createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
}

describe('digest routes', () => {
  it('renders /digest/2026-10-28 and matches /api/digest jobs and order', async () => {
    const app = appWithRuns('runs');
    const page = await app.request('/digest/2026-10-28');
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain('digest · 2026-10-28');
    expect(html).toContain('notes/backup');
    expect(html).toContain('—'); // null owner

    const api = await app.request('/api/digest/2026-10-28');
    expect(api.status).toBe(200);
    const rows = (await api.json()) as { job: string }[];
    const expected = readNight('runs', '2026-10-28')!.rows.map((r) => r.job);
    expect(rows.map((r) => r.job)).toEqual(expected);

    // Same order on the page: first job appears before last.
    expect(html.indexOf(expected[0]!)).toBeGreaterThan(-1);
    expect(html.indexOf(expected[0]!)).toBeLessThan(html.indexOf(expected[expected.length - 1]!));
  });

  it('returns 404 when the night file is missing', async () => {
    const app = appWithRuns('runs');
    expect((await app.request('/digest/1999-01-01')).status).toBe(404);
    expect((await app.request('/api/digest/1999-01-01')).status).toBe(404);
  });

  it('renders empty night as nothing ran', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(join(dir, '2026-10-01.jsonl'), '');
    const app = appWithRuns(dir);
    const res = await app.request('/digest/2026-10-01');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
    expect(await (await app.request('/api/digest/2026-10-01')).json()).toEqual([]);
  });

  it('still renders a night that has a bad line', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(
      join(dir, '2026-10-02.jsonl'),
      [
        '{"at":"2026-10-02T01:00:00+01:00","job":"a/job","status":"ok","owner":"rook"}',
        'not-json',
        '',
      ].join('\n'),
    );
    const app = appWithRuns(dir);
    const res = await app.request('/digest/2026-10-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('a/job');
  });
});

describe('status board digest links', () => {
  it('links both nights on disk to their digests with counts', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await appWithRuns('runs').request('/');
    const html = await res.text();
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('href="/digest/2026-10-27"');
    expect(html).toMatch(/ok \/ .* retry \/ .* fail/);
  });
});
