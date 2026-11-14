import { feature, neighbors } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, Geometry, Polygon, MultiPolygon } from 'geojson';
import countriesAtlas from 'world-atlas/countries-10m.json';
import { computeIdealZoomDistance } from '../utils/playerMath';

export interface CountryEntry {
  id: string;
  nameEn: string;
  namePt: string;
  searchKey: string;
  lon: number;
  lat: number;
  lonSpan: number;
  latSpan: number;
  areaApproxKm2: number;
  regionPt: string;
  hemispherePt: string;
  timezoneApprox: string;
  neighborsPt: string[];
  idealDistance: number;
  rings: number[][][];
}

const PT_ALIASES: Record<string, string> = {
  Brazil: 'Brasil',
  'United States of America': 'Estados Unidos',
  'United Kingdom': 'Reino Unido',
  Germany: 'Alemanha',
  France: 'França',
  Spain: 'Espanha',
  Italy: 'Itália',
  Portugal: 'Portugal',
  Japan: 'Japão',
  China: 'China',
  India: 'Índia',
  Russia: 'Rússia',
  Canada: 'Canadá',
  Mexico: 'México',
  Argentina: 'Argentina',
  Colombia: 'Colômbia',
  Peru: 'Peru',
  Chile: 'Chile',
  Venezuela: 'Venezuela',
  Bolivia: 'Bolívia',
  Paraguay: 'Paraguai',
  Uruguay: 'Uruguai',
  Ecuador: 'Equador',
  Australia: 'Austrália',
  'South Africa': 'África do Sul',
  'Dem. Rep. Congo': 'Rep. Dem. do Congo',
  Nigeria: 'Nigéria',
  Egypt: 'Egito',
  Indonesia: 'Indonésia',
  'Saudi Arabia': 'Arábia Saudita',
  Turkey: 'Turquia',
  'South Korea': 'Coreia do Sul',
  Norway: 'Noruega',
  Sweden: 'Suécia',
  Ukraine: 'Ucrânia',
  Poland: 'Polônia',
  Morocco: 'Marrocos',
  Kenya: 'Quênia',
  Ethiopia: 'Etiópia',
  Thailand: 'Tailândia',
  Vietnam: 'Vietnã',
  Philippines: 'Filipinas',
  'New Zealand': 'Nova Zelândia',
  Netherlands: 'Países Baixos',
  Belgium: 'Bélgica',
  Switzerland: 'Suíça',
  Greece: 'Grécia',
  Algeria: 'Argélia',
  Angola: 'Angola',
  Mozambique: 'Moçambique',
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function ringStats(ring: number[][]): {
  areaDeg2: number;
  areaKm2: number;
  lonCenter: number;
  latCenter: number;
  lonSpan: number;
  latSpan: number;
  crossesAntimeridian: boolean;
} {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let sumLon = 0;
  let sumLat = 0;
  let crossesAntimeridian = false;
  let shoelace = 0;

  for (let i = 0; i < ring.length; i++) {
    const [lon, lat] = ring[i];
    if (i > 0 && Math.abs(lon - ring[i - 1][0]) > 180) {
      crossesAntimeridian = true;
    }
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    sumLon += lon;
    sumLat += lat;

    const next = ring[(i + 1) % ring.length];
    if (Math.abs(next[0] - lon) <= 180) {
      shoelace += lon * next[1] - next[0] * lat;
    }
  }

  const lonSpan = maxLon - minLon;
  const latSpan = maxLat - minLat;
  const midLatRad = (((minLat + maxLat) * 0.5) * Math.PI) / 180;
  const cosLat = Math.max(0.15, Math.cos(midLatRad));
  const areaDeg2 = lonSpan * latSpan * cosLat;
  const polyDeg2 = Math.abs(shoelace) * 0.5;
  // 1 degree lat ≈ 111.32 km, 1 degree lon ≈ 111.32 * cos(lat) km
  const areaKm2 = Math.round(polyDeg2 * 111.32 * 111.32 * cosLat);

  return {
    areaDeg2,
    areaKm2,
    lonCenter: ring.length > 0 ? sumLon / ring.length : 0,
    latCenter: ring.length > 0 ? sumLat / ring.length : 0,
    lonSpan,
    latSpan,
    crossesAntimeridian,
  };
}

function inferRegionPt(lon: number, lat: number, nameEn: string): string {
  if (lat < -60) return 'Antártida';
  if (lon >= -95 && lon <= -30 && lat >= -58 && lat <= 14) return 'América do Sul';
  if (lon >= -170 && lon <= -50 && lat > 14 && lat <= 84) return 'América do Norte e Central';
  if (lon >= -25 && lon <= 45 && lat > 35 && lat <= 73) return 'Europa';
  if (lon >= -20 && lon <= 55 && lat >= -36 && lat <= 37) return 'África';
  if (lon > 110 && lat < -8 && lat > -50) return 'Oceania';
  if (nameEn === 'New Zealand' || nameEn === 'Papua New Guinea' || nameEn === 'Fiji') {
    return 'Oceania';
  }
  return 'Ásia';
}

function formatHemisphere(lon: number, lat: number): string {
  const ns = lat >= 0 ? 'Norte' : 'Sul';
  const ew = lon >= 0 ? 'Oriental' : 'Ocidental';
  return `${ns} / ${ew}`;
}

function formatTimezone(lon: number): string {
  const offset = Math.round(lon / 15);
  if (offset === 0) return 'UTC±0';
  return offset > 0 ? `UTC+${offset}` : `UTC${offset}`;
}

function extractOuterRings(geometry: Geometry): number[][][] {
  if (geometry.type === 'Polygon') {
    return (geometry as Polygon).coordinates;
  }
  if (geometry.type === 'MultiPolygon') {
    const rings: number[][][] = [];
    for (const poly of (geometry as MultiPolygon).coordinates) {
      for (const ring of poly) {
        rings.push(ring);
      }
    }
    return rings;
  }
  return [];
}

function extractMainOuterRings(geometry: Geometry): number[][][] {
  if (geometry.type === 'Polygon') {
    return [(geometry as Polygon).coordinates[0]];
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry as MultiPolygon).coordinates.map((poly) => poly[0]);
  }
  return [];
}

let cachedCountries: CountryEntry[] | null = null;
let cachedAllRings: number[][][] | null = null;

export function loadWorldCountries(): {
  countries: CountryEntry[];
  allRings: number[][][];
} {
  if (cachedCountries && cachedAllRings) {
    return { countries: cachedCountries, allRings: cachedAllRings };
  }

  const topology = countriesAtlas as unknown as Topology<{
    countries: GeometryCollection<{ name?: string }>;
  }>;
  const geojson = feature(topology, topology.objects.countries) as FeatureCollection<
    Geometry,
    { name?: string }
  >;
  const neighborIndexes = neighbors(topology.objects.countries.geometries);

  const indexToPtName = geojson.features.map((f) => {
    const en = f.properties?.name?.trim() ?? '';
    return PT_ALIASES[en] ?? en;
  });

  const countries: CountryEntry[] = [];
  const allRings: number[][][] = [];

  for (let featIdx = 0; featIdx < geojson.features.length; featIdx++) {
    const feat = geojson.features[featIdx];
    if (!feat.geometry) continue;
    const rings = extractOuterRings(feat.geometry);
    for (const ring of rings) {
      allRings.push(ring);
    }

    const nameEn = feat.properties?.name?.trim();
    if (!nameEn) continue;

    const mainRings = extractMainOuterRings(feat.geometry);
    if (mainRings.length === 0) continue;

    let best = ringStats(mainRings[0]);
    let totalAreaKm2 = best.crossesAntimeridian ? 0 : best.areaKm2;
    for (let i = 1; i < mainRings.length; i++) {
      const candidate = ringStats(mainRings[i]);
      if (!candidate.crossesAntimeridian) totalAreaKm2 += candidate.areaKm2;
      if (best.crossesAntimeridian && !candidate.crossesAntimeridian) {
        best = candidate;
      } else if (
        candidate.crossesAntimeridian === best.crossesAntimeridian &&
        candidate.areaDeg2 > best.areaDeg2
      ) {
        best = candidate;
      }
    }

    const namePt = PT_ALIASES[nameEn] ?? nameEn;
    const lon = Number(best.lonCenter.toFixed(3));
    const lat = Number(best.latCenter.toFixed(3));
    const neighborNames = (neighborIndexes[featIdx] ?? [])
      .map((idx) => indexToPtName[idx])
      .filter((n) => n && n !== namePt);

    countries.push({
      id: `${feat.id ?? nameEn}-${featIdx}`,
      nameEn,
      namePt,
      searchKey: normalizeText(`${namePt} ${nameEn}`),
      lon,
      lat,
      lonSpan: Number(best.lonSpan.toFixed(2)),
      latSpan: Number(best.latSpan.toFixed(2)),
      areaApproxKm2: totalAreaKm2 || best.areaKm2,
      regionPt: inferRegionPt(lon, lat, nameEn),
      hemispherePt: formatHemisphere(lon, lat),
      timezoneApprox: formatTimezone(lon),
      neighborsPt: Array.from(new Set(neighborNames)),
      idealDistance: computeIdealZoomDistance(best.lonSpan, best.latSpan),
      rings,
    });
  }

  countries.sort((a, b) => a.namePt.localeCompare(b.namePt, 'pt-BR'));
  cachedCountries = countries;
  cachedAllRings = allRings;
  return { countries, allRings };
}

export function searchCountries(
  query: string,
  countries: CountryEntry[],
  limit = 8
): CountryEntry[] {
  const q = normalizeText(query);
  if (!q) return [];
  const startsWith: CountryEntry[] = [];
  const includes: CountryEntry[] = [];

  for (const country of countries) {
    if (
      normalizeText(country.namePt).startsWith(q) ||
      normalizeText(country.nameEn).startsWith(q)
    ) {
      startsWith.push(country);
    } else if (country.searchKey.includes(q)) {
      includes.push(country);
    }
  }

  return [...startsWith, ...includes].slice(0, limit);
}

function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (Math.abs(xi - xj) > 180) continue;
    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function findCountryAtLonLat(
  lon: number,
  lat: number,
  countries: CountryEntry[]
): CountryEntry | null {
  for (const country of countries) {
    for (const ring of country.rings) {
      if (pointInRing(lon, lat, ring)) {
        return country;
      }
    }
  }
  return null;
}
