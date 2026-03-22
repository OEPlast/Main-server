/**
 * GIG Stations Lookup Script
 *
 * Fetches all GIG logistics stations and prints them as a table.
 * Use this to find the correct StationId for your warehouse location,
 * then enter that number in Admin → GIG Settings → "Sender Station ID".
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/list-gig-stations.ts
 *
 * Filter by name/state (case-insensitive):
 *   npx ts-node -r tsconfig-paths/register scripts/list-gig-stations.ts --filter lagos
 *   npx ts-node -r tsconfig-paths/register scripts/list-gig-stations.ts --filter abuja
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

interface GIGStation {
  StationId: number;
  StationName: string;
  StationCode?: string;
  StateName?: string;
  IsDeleted?: boolean;
  IsPublic?: boolean;
  GiggoActive?: boolean;
}

interface GIGV3DataWrapper<T> {
  message: string;
  apiId: string;
  status: number;
  data: T;
}

interface GIGV3APIResponse<T> {
  success: boolean;
  data: GIGV3DataWrapper<T>;
}

const GIG_API_URL = process.env.GIG_API_URL || 'https://dev-thirdpartynode.theagilitysystems.com';
const GIG_ACCESS_TOKEN = process.env.GIG_ACCESS_TOKEN || '';

async function fetchStations(): Promise<GIGStation[]> {
  if (!GIG_ACCESS_TOKEN) {
    console.error('❌  GIG_ACCESS_TOKEN is not set in .env');
    process.exit(1);
  }

  const url = `${GIG_API_URL}/localstations/get`;
  console.log(`📡  Fetching stations from: ${url}\n`);

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'access-token': GIG_ACCESS_TOKEN,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    console.error(`❌  GIG API error (${response.status}): ${text}`);
    process.exit(1);
  }

  const data = (await response.json()) as GIGV3APIResponse<GIGStation[]>;

  if (!data.success) {
    console.error(`❌  GIG API returned error: ${data.data?.message || 'Unknown error'}`);
    process.exit(1);
  }

  return data.data.data ?? [];
}

function printTable(stations: GIGStation[]): void {
  if (stations.length === 0) {
    console.log('⚠️   No stations found.');
    return;
  }

  // Column widths
  const idWidth = 10;
  const nameWidth = 40;
  const stateWidth = 25;
  const activeWidth = 8;

  const divider =
    '-'.repeat(idWidth) + '+' + '-'.repeat(nameWidth) + '+' + '-'.repeat(stateWidth) + '+' + '-'.repeat(activeWidth);

  const header =
    'StationId'.padEnd(idWidth) +
    '|' +
    'StationName'.padEnd(nameWidth) +
    '|' +
    'StateName'.padEnd(stateWidth) +
    '|' +
    'Active'.padEnd(activeWidth);

  console.log(divider);
  console.log(header);
  console.log(divider);

  for (const s of stations) {
    const isActive = s.IsDeleted === true ? 'No' : 'Yes';
    const row =
      String(s.StationId).padEnd(idWidth) +
      '|' +
      (s.StationName || '').substring(0, nameWidth - 1).padEnd(nameWidth) +
      '|' +
      (s.StateName || '').substring(0, stateWidth - 1).padEnd(stateWidth) +
      '|' +
      isActive.padEnd(activeWidth);
    console.log(row);
  }

  console.log(divider);
  console.log(`\n✅  Total: ${stations.length} stations`);
}

async function main(): Promise<void> {
  // Parse --filter argument
  const filterIdx = process.argv.indexOf('--filter');
  const filterTerm = filterIdx !== -1 && process.argv[filterIdx + 1] ? process.argv[filterIdx + 1].toLowerCase() : null;

  const all = await fetchStations();

  const stations = filterTerm
    ? all.filter(
        (s) => s.StationName?.toLowerCase().includes(filterTerm) || s.StateName?.toLowerCase().includes(filterTerm)
      )
    : all;

  if (filterTerm) {
    console.log(`🔍  Filtering by: "${filterTerm}" — ${stations.length} match(es)\n`);
  } else {
    console.log(`📋  Showing all ${stations.length} stations\n`);
  }

  printTable(stations);

  console.log('\n💡  Next step:');
  console.log('    Copy the StationId for your warehouse city/state and enter it in:');
  console.log('    Admin Panel → GIG Settings → Sender Station ID\n');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
