import 'dotenv/config';

import mongoose from 'mongoose';
import axios from 'axios';
import LogisticsConfig from '../src/models/LogisticsConfig';

const NIGERIA_COUNTRY_CODE = 'NG';
const NIGERIA_COUNTRY_NAME = 'Nigeria';
const STATES_ENDPOINT = 'https://nga-states-lga.onrender.com/fetch';
const LGAS_ENDPOINT = 'https://nga-states-lga.onrender.com/';

type NigeriaStateRecord = {
  originalName: string;
  displayName: string;
  lgas: string[];
};

type LogisticsStateSeed = {
  name: string;
  fallbackPrice: number;
  fallbackEtaDays: number;
  cities: Array<{ name: string }>;
  lgas: Array<{ name: string }>;
};

type LogisticsConfigSeed = {
  countryCode: string;
  countryName: string;
  states: LogisticsStateSeed[];
};

const DEFAULT_FALLBACK_PRICE = 0;
const DEFAULT_FALLBACK_ETA_DAYS = 3;

async function fetchStateNames(): Promise<string[]> {
  const response = await axios.get<string[]>(STATES_ENDPOINT);

  if (!Array.isArray(response.data) || response.data.length === 0) {
    throw new Error('Failed to fetch Nigeria states – empty response');
  }

  return response.data;
}

async function fetchStateLgas(stateName: string): Promise<string[]> {
  const response = await axios.get<string[]>(LGAS_ENDPOINT, {
    params: { state: stateName },
  });

  if (!Array.isArray(response.data)) {
    throw new Error(`Failed to fetch LGAs for state "${stateName}"`);
  }

  return response.data;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function insertSpacesBetweenCamelCase(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function toTitleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((segment) => {
      const lower = segment.toLowerCase();

      // Preserve all-uppercase abbreviations like FCT
      if (segment === segment.toUpperCase()) {
        return segment;
      }

      return lower
        .split('-')
        .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
        .join('-');
    })
    .join(' ');
}

function formatStateDisplayName(rawName: string): string {
  const withSpacing = insertSpacesBetweenCamelCase(rawName);
  const normalized = normalizeWhitespace(withSpacing);

  if (!normalized) {
    return rawName.trim();
  }

  if (normalized === normalized.toUpperCase()) {
    return normalized;
  }

  return toTitleCase(normalized);
}

function formatLocationName(rawName: string): string {
  const normalized = normalizeWhitespace(rawName);

  if (!normalized) {
    return normalized;
  }

  if (normalized === normalized.toUpperCase()) {
    return normalized;
  }

  return toTitleCase(normalized);
}

async function fetchNigeriaLocations(): Promise<NigeriaStateRecord[]> {
  const states = await fetchStateNames();

  const results: NigeriaStateRecord[] = [];

  for (const stateName of states) {
    console.info(`Fetching LGAs for ${stateName}…`);
    const lgas = await fetchStateLgas(stateName);

    results.push({
      originalName: stateName,
      displayName: formatStateDisplayName(stateName),
      lgas,
    });
  }

  return results;
}

function buildLogisticsDocument(stateRecords: NigeriaStateRecord[]): LogisticsConfigSeed {
  const transformedStates: LogisticsStateSeed[] = stateRecords.map((record) => {
    const uniqueLgas = Array.from(
      new Set(record.lgas.map((lga) => formatLocationName(lga)).filter((lga) => Boolean(lga)))
    );

    return {
      name: record.displayName,
      fallbackPrice: DEFAULT_FALLBACK_PRICE,
      fallbackEtaDays: DEFAULT_FALLBACK_ETA_DAYS,
      // City overrides left empty intentionally; add entries manually when a city differs from its parent LGA.
      cities: [],
      lgas: uniqueLgas.map((name) => ({ name })),
    };
  });

  return {
    countryCode: NIGERIA_COUNTRY_CODE,
    countryName: NIGERIA_COUNTRY_NAME,
    states: transformedStates,
  } satisfies LogisticsConfigSeed;
}

async function upsertNigeriaLogistics(config: LogisticsConfigSeed) {
  const existing = await LogisticsConfig.findOne({ countryCode: config.countryCode });

  if (existing) {
    existing.set('states', config.states);
    existing.set('countryName', config.countryName);
    await existing.save();
    return { operation: 'update', id: existing._id } as const;
  }

  await LogisticsConfig.deleteMany({
    $or: [{ countryCode: config.countryCode }, { countryName: config.countryName }],
  });

  const created = await LogisticsConfig.create(config);
  return { operation: 'create', id: created._id } as const;
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;

  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI / DATABASE_URL environment variable');
  }

  console.info('Connecting to MongoDB…');
  await mongoose.connect(mongoUri);
  console.info('Connected. Fetching Nigeria logistics dataset…');

  try {
    const statesPayload = await fetchNigeriaLocations();

    console.info('Removing existing Nigeria logistics configuration…');
    const deleteResult = await LogisticsConfig.deleteMany({
      $or: [{ countryCode: NIGERIA_COUNTRY_CODE }, { countryName: NIGERIA_COUNTRY_NAME }],
    });
    console.info(`Removed ${deleteResult.deletedCount} existing document(s).`);

    if (statesPayload.length < 36) {
      throw new Error(`Expected at least 36 states but received ${statesPayload.length}`);
    }

    const configDocument = buildLogisticsDocument(statesPayload);
    const result = await upsertNigeriaLogistics(configDocument);

    const totalStates = configDocument.states.length;
    const totalLgas = configDocument.states.reduce((acc, state) => acc + (state.lgas?.length ?? 0), 0);
    const totalCities = configDocument.states.reduce((acc, state) => acc + (state.cities?.length ?? 0), 0);

    console.info(`Nigeria logistics data ${result.operation}d successfully (id=${result.id}).`);
    console.info(`States: ${totalStates}, LGAs: ${totalLgas}, Cities (unique): ${totalCities}`);
  } catch (error) {
    console.error('Failed to populate Nigeria logistics data:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error in populate-nigeria-logistics script:', error);
    process.exit(1);
  });
}
