import 'dotenv/config';

import axios from 'axios';
import mongoose from 'mongoose';
import LogisticsConfig from '../src/models/LogisticsConfig';

type Coordinate = {
  latitude: number;
  longitude: number;
};

type NigeriaStateRecord = {
  originalName: string;
  displayName: string;
  lgas: string[];
};

type LogisticsLocationSeed = {
  name: string;
  price: number;
  etaDays: number;
};

type LogisticsStateSeed = {
  name: string;
  fallbackPrice: number;
  fallbackEtaDays: number;
  cities: LogisticsLocationSeed[];
  lgas: LogisticsLocationSeed[];
};

type LogisticsConfigSeed = {
  countryCode: string;
  countryName: string;
  states: LogisticsStateSeed[];
};

const NIGERIA_COUNTRY_CODE = 'NG';
const NIGERIA_COUNTRY_NAME = 'Nigeria';
const STATES_ENDPOINT = 'https://nga-states-lga.onrender.com/fetch';
const LGAS_ENDPOINT = 'https://nga-states-lga.onrender.com/';

const HOME_COORDINATE: Coordinate = { latitude: 6.6059, longitude: 3.349 }; // Ikeja, Lagos
const HOME_LGA_NAME = 'Ikeja';
const HOME_LGA_PRICE = 3000;
const HOME_LGA_ETA_DAYS = 2;
const PRICE_PER_KM = 12;
const PRICE_ROUNDING_STEP = 50;
const INTRA_STATE_DISTANCE_KM = 25;
const DEFAULT_DISTANCE_KM = 450;
const ETA_DISTANCE_STEP_KM = 350;
const ETA_MAX_DAYS = 10;
const DEFAULT_FALLBACK_PRICE = HOME_LGA_PRICE;
const DEFAULT_FALLBACK_ETA_DAYS = HOME_LGA_ETA_DAYS;

const STATE_COORDINATES: Record<string, Coordinate> = {
  Abia: { latitude: 5.532, longitude: 7.486 },
  Adamawa: { latitude: 9.2035, longitude: 12.4954 },
  'Akwa Ibom': { latitude: 5.0377, longitude: 7.9128 },
  Anambra: { latitude: 6.21, longitude: 7.069 },
  Bauchi: { latitude: 10.311, longitude: 9.843 },
  Bayelsa: { latitude: 4.9267, longitude: 6.2676 },
  Benue: { latitude: 7.7339, longitude: 8.5214 },
  Borno: { latitude: 11.8333, longitude: 13.15 },
  'Cross River': { latitude: 4.9589, longitude: 8.3269 },
  Delta: { latitude: 6.2018, longitude: 6.6951 },
  Ebonyi: { latitude: 6.3249, longitude: 8.1137 },
  Edo: { latitude: 6.335, longitude: 5.6037 },
  Ekiti: { latitude: 7.6233, longitude: 5.2197 },
  Rivers: { latitude: 4.8242, longitude: 7.0336 },
  Enugu: { latitude: 6.5244, longitude: 7.518 },
  FCT: { latitude: 9.0765, longitude: 7.3986 },
  Gombe: { latitude: 10.29, longitude: 11.18 },
  Imo: { latitude: 5.485, longitude: 7.0356 },
  Jigawa: { latitude: 12.0, longitude: 9.35 },
  Kaduna: { latitude: 10.5105, longitude: 7.4165 },
  Kano: { latitude: 12.0022, longitude: 8.5919 },
  Katsina: { latitude: 12.9833, longitude: 7.6333 },
  Kebbi: { latitude: 12.4537, longitude: 4.1978 },
  Kogi: { latitude: 7.799, longitude: 6.743 },
  Kwara: { latitude: 8.4966, longitude: 4.5421 },
  Lagos: { latitude: 6.5244, longitude: 3.3792 },
  Nasarawa: { latitude: 8.4939, longitude: 8.5153 },
  Niger: { latitude: 9.6134, longitude: 6.5569 },
  Ogun: { latitude: 7.1475, longitude: 3.3619 },
  Ondo: { latitude: 7.2577, longitude: 5.207 },
  Osun: { latitude: 7.782, longitude: 4.5586 },
  Oyo: { latitude: 7.3775, longitude: 3.947 },
  Plateau: { latitude: 9.8965, longitude: 8.8583 },
  Sokoto: { latitude: 13.0667, longitude: 5.2333 },
  Taraba: { latitude: 8.8937, longitude: 11.361 },
  Yobe: { latitude: 11.7463, longitude: 11.9608 },
  Zamfara: { latitude: 12.1628, longitude: 6.6614 },
};

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

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function haversineDistanceKm(origin: Coordinate, target: Coordinate): number {
  const earthRadiusKm = 6371;
  const dLat = degreesToRadians(target.latitude - origin.latitude);
  const dLon = degreesToRadians(target.longitude - origin.longitude);
  const lat1 = degreesToRadians(origin.latitude);
  const lat2 = degreesToRadians(target.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function roundUpToStep(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

function calculatePrice(distanceKm: number): number {
  const effectiveDistance = Math.max(distanceKm - INTRA_STATE_DISTANCE_KM, 0);
  const rawPrice = HOME_LGA_PRICE + effectiveDistance * PRICE_PER_KM;
  return roundUpToStep(rawPrice, PRICE_ROUNDING_STEP);
}

function calculateEta(distanceKm: number): number {
  const extraDistance = Math.max(distanceKm - INTRA_STATE_DISTANCE_KM, 0);
  const additionalDays = Math.ceil(extraDistance / ETA_DISTANCE_STEP_KM);
  const eta = HOME_LGA_ETA_DAYS + additionalDays;
  return Math.min(Math.max(eta, HOME_LGA_ETA_DAYS), ETA_MAX_DAYS);
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

    const coordinate = STATE_COORDINATES[record.displayName] ?? STATE_COORDINATES[record.originalName] ?? null;
    const distanceKm = coordinate ? haversineDistanceKm(HOME_COORDINATE, coordinate) : DEFAULT_DISTANCE_KM;
    const statePrice = calculatePrice(distanceKm);
    const stateEta = calculateEta(distanceKm);

    const lgas = uniqueLgas.map<LogisticsLocationSeed>((name) => {
      if (record.displayName === 'Lagos' && name.toLowerCase() === HOME_LGA_NAME.toLowerCase()) {
        return { name, price: HOME_LGA_PRICE, etaDays: HOME_LGA_ETA_DAYS };
      }

      return { name, price: statePrice, etaDays: stateEta };
    });

    return {
      name: record.displayName,
      fallbackPrice: statePrice || DEFAULT_FALLBACK_PRICE,
      fallbackEtaDays: stateEta || DEFAULT_FALLBACK_ETA_DAYS,
      cities: [],
      lgas,
    };
  });

  return {
    countryCode: NIGERIA_COUNTRY_CODE,
    countryName: NIGERIA_COUNTRY_NAME,
    states: transformedStates,
  } satisfies LogisticsConfigSeed;
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;

  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI / DATABASE_URL environment variable');
  }

  console.info('Connecting to MongoDB…');
  await mongoose.connect(mongoUri);
  console.info('Connected. Fetching Nigeria logistics dataset with pricing…');

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
    const created = await LogisticsConfig.create(configDocument);

    const totalStates = configDocument.states.length;
    const totalLgas = configDocument.states.reduce((acc, state) => acc + state.lgas.length, 0);

    console.info(`Nigeria logistics data created successfully with pricing (id=${created._id}).`);
    console.info(`States: ${totalStates}, LGAs: ${totalLgas}`);
  } catch (error) {
    console.error('Failed to populate Nigeria logistics data with pricing:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error in populate-nigeria-logistics-with-pricing script:', error);
    process.exit(1);
  });
}
