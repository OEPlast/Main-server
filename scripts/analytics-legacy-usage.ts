/**
 * Legacy analytics endpoint usage report.
 *
 * The gate for deleting the ~95 legacy analytics endpoints is positive evidence
 * that nothing outside the admin app calls them. This reads the access log
 * (`logs/access.log`, written by `morganAccessLog`) and reports, per endpoint,
 * how often it was hit, by whom, and from what user agent.
 *
 * **The window matters more than the counts.** A report covering three days
 * proves nothing about a weekly cron or a monthly export. Check `COVERAGE`
 * in the output before acting on `UNUSED`.
 *
 * Usage:
 *   npx ts-node scripts/analytics-legacy-usage.ts
 *   npx ts-node scripts/analytics-legacy-usage.ts --days 14
 */
import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = path.resolve(process.cwd(), 'logs');

const daysArg = process.argv.indexOf('--days');
const DAYS = daysArg > -1 ? Number(process.argv[daysArg + 1]) : Infinity;

/** Endpoints served by the query engine — these are the replacement, not the legacy. */
const ENGINE_PATHS = new Set(['series', 'summary', 'breakdown', 'meta']);

interface Entry {
  t: string;
  method: string;
  url: string;
  status: number;
  userId: string;
  role: string;
  ip: string;
  ua: string;
}

const readEntries = (): Entry[] => {
  if (!fs.existsSync(LOG_DIR)) {
    console.error(`No log directory at ${LOG_DIR}. Is morganAccessLog wired up and has the server run?`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(LOG_DIR)
    .filter((f) => f.startsWith('access.log'))
    .map((f) => path.join(LOG_DIR, f));

  const cutoff = DAYS === Infinity ? 0 : Date.now() - DAYS * 24 * 60 * 60 * 1000;
  const entries: Entry[] = [];

  for (const file of files) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line) as Entry;
        if (new Date(entry.t).getTime() >= cutoff) entries.push(entry);
      } catch {
        // A partially-written final line is normal on a live log; skip it.
      }
    }
  }

  return entries;
};

const main = () => {
  const all = readEntries();
  const analytics = all.filter((e) => e.url.startsWith('/admin/analytics/'));

  if (all.length === 0) {
    console.log('Access log is empty. The 14-day clock starts once the server has run with logging enabled.');
    return;
  }

  const times = all.map((e) => new Date(e.t).getTime()).sort((a, b) => a - b);
  const spanDays = (times[times.length - 1] - times[0]) / (24 * 60 * 60 * 1000);

  console.log('='.repeat(78));
  console.log('COVERAGE');
  console.log('='.repeat(78));
  console.log(`  entries         : ${all.length} (${analytics.length} analytics)`);
  console.log(`  first           : ${new Date(times[0]).toISOString()}`);
  console.log(`  last            : ${new Date(times[times.length - 1]).toISOString()}`);
  console.log(`  span            : ${spanDays.toFixed(2)} days`);
  console.log(
    `  gate (>= 14d)   : ${spanDays >= 14 ? 'MET — deletion evidence is usable' : 'NOT MET — do not delete yet'}`
  );

  const byEndpoint = new Map<string, Entry[]>();
  for (const entry of analytics) {
    const slug = entry.url.split('?')[0].replace('/admin/analytics/', '');
    if (!byEndpoint.has(slug)) byEndpoint.set(slug, []);
    byEndpoint.get(slug)!.push(entry);
  }

  const legacy = [...byEndpoint.entries()].filter(([slug]) => !ENGINE_PATHS.has(slug));

  console.log('');
  console.log('='.repeat(78));
  console.log('LEGACY ENDPOINTS WITH TRAFFIC');
  console.log('='.repeat(78));

  if (legacy.length === 0) {
    console.log('  none — no legacy analytics endpoint was called in this window.');
  } else {
    for (const [slug, hits] of legacy.sort((a, b) => b[1].length - a[1].length)) {
      const roles = [...new Set(hits.map((h) => h.role))].join(', ');
      const agents = [...new Set(hits.map((h) => (h.ua || '').slice(0, 40)))];
      const anon = hits.filter((h) => h.userId === '-').length;

      console.log(`  ${slug.padEnd(38)} ${String(hits.length).padStart(5)} hits  roles=[${roles}]`);
      if (anon > 0) {
        console.log(`      ⚠️  ${anon} with no authenticated user — likely an external consumer`);
      }
      if (agents.length > 1 || !agents[0]?.includes('Mozilla')) {
        console.log(`      agents: ${agents.join(' | ')}`);
      }
    }
  }

  console.log('');
  console.log('='.repeat(78));
  console.log('ENGINE ENDPOINTS');
  console.log('='.repeat(78));
  for (const slug of ENGINE_PATHS) {
    const hits = byEndpoint.get(slug)?.length ?? 0;
    console.log(`  ${slug.padEnd(38)} ${String(hits).padStart(5)} hits`);
  }

  console.log('');
  console.log('VERDICT');
  if (spanDays < 14) {
    console.log('  Insufficient coverage. Re-run once the log spans at least 14 days.');
  } else if (legacy.length === 0) {
    console.log('  No legacy traffic across the full window — safe to delete the legacy block.');
  } else {
    console.log(`  ${legacy.length} legacy endpoint(s) still receiving traffic. Migrate or confirm each before deleting.`);
  }
};

main();
