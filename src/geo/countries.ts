import { feature, mesh, neighbors } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, Geometry, Polygon, MultiPolygon, MultiLineString } from 'geojson';
import countriesAtlas from 'world-atlas/countries-10m.json';
import { computeIdealZoomDistance } from '../utils/playerMath';
import { MINOR_UNINHABITED_EN, PT_COUNTRY_NAMES } from './ptCountryNames';

export interface CountryEntry {
  id: string;
  nameEn: string;
  namePt: string;
  searchKey: string;
  lon: number;
  lat: number;
  lonSpan: number;
  latSpan: number;
  bbox: [number, number, number, number];
  areaApproxKm2: number;
  regionPt: string;
  regionEn: string;
  hemispherePt: string;
  hemisphereEn: string;
  timezoneApprox: string;
  neighborsPt: string[];
  idealDistance: number;
  rings: number[][][];
  /** Full GeoJSON polygon list [outerRing, ...holeRings][] so enclaves (Lesotho, Vatican, San Marino) are respected */
  polygons: number[][][][];
  isMinorUninhabited?: boolean;
}

interface DetachedTerritoryRule {
  parentNameEn: string;
  idSuffix: string;
  nameEn: string;
  namePt: string;
  neighborsPt: string[];
  match: (lon: number, lat: number) => boolean;
}

/**
 * Separates geographically detached overseas territories that world-atlas merges into
 * distant European sovereign MultiPolygons (e.g. French Guiana right above Brazil!).
 */
const DETACHED_TERRITORY_RULES: DetachedTerritoryRule[] = [
  {
    parentNameEn: 'France',
    idSuffix: '250-gf',
    nameEn: 'French Guiana',
    namePt: 'Guiana Francesa',
    neighborsPt: ['Brasil', 'Suriname'],
    match: (lon, lat) => lon >= -56 && lon <= -50.5 && lat >= 1.5 && lat <= 6.5,
  },
  {
    parentNameEn: 'France',
    idSuffix: '250-gp',
    nameEn: 'Guadeloupe',
    namePt: 'Guadalupe',
    neighborsPt: ['Dominica', 'Antígua e Barbuda', 'Montserrat'],
    match: (lon, lat) => lon >= -62.1 && lon <= -60.8 && lat >= 15.7 && lat <= 16.7,
  },
  {
    parentNameEn: 'France',
    idSuffix: '250-mq',
    nameEn: 'Martinique',
    namePt: 'Martinica',
    neighborsPt: ['Santa Lúcia', 'Dominica'],
    match: (lon, lat) => lon >= -61.4 && lon <= -60.6 && lat >= 14.2 && lat <= 15.0,
  },
  {
    parentNameEn: 'France',
    idSuffix: '250-re',
    nameEn: 'Réunion',
    namePt: 'Reunião',
    neighborsPt: ['Maurício', 'Madagascar'],
    match: (lon, lat) => lon >= 55.0 && lon <= 56.1 && lat >= -21.6 && lat <= -20.7,
  },
  {
    parentNameEn: 'France',
    idSuffix: '250-yt',
    nameEn: 'Mayotte',
    namePt: 'Maiote',
    neighborsPt: ['Comores', 'Madagascar'],
    match: (lon, lat) => lon >= 44.8 && lon <= 45.5 && lat >= -13.2 && lat <= -12.5,
  },
  {
    parentNameEn: 'Norway',
    idSuffix: '578-sj',
    nameEn: 'Svalbard',
    namePt: 'Svalbard',
    neighborsPt: ['Noruega', 'Groenlândia'],
    match: (_lon, lat) => lat >= 73.5,
  },
  {
    parentNameEn: 'Netherlands',
    idSuffix: '528-bq',
    nameEn: 'Caribbean Netherlands',
    namePt: 'Caribe Neerlandês (Bonaire)',
    neighborsPt: ['Curaçao', 'Aruba', 'Venezuela'],
    match: (lon, lat) => lon <= -60 && lat >= 11 && lat <= 18.5,
  },
];

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function wrapLon180(lon: number): number {
  let l = lon;
  while (l > 180) l -= 360;
  while (l < -180) l += 360;
  return l;
}

function ringCrossesAntimeridian(ring: number[][]): boolean {
  for (let i = 1; i < ring.length; i++) {
    if (Math.abs(ring[i][0] - ring[i - 1][0]) > 180) return true;
  }
  return false;
}

function unwrapRingLon(ring: number[][]): number[][] {
  return ring.map(([lon, lat]) => [lon < 0 ? lon + 360 : lon, lat]);
}

function pointInSimpleRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (Math.abs(xi - xj) > 180) continue;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygonPlanar(x: number, y: number, poly: number[][][]): boolean {
  if (poly.length === 0 || !pointInSimpleRing(x, y, poly[0])) return false;
  for (let h = 1; h < poly.length; h++) {
    if (pointInSimpleRing(x, y, poly[h])) return false;
  }
  return true;
}

function minDistSqToRingEdges(x: number, y: number, ring: number[][]): number {
  let minSq = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const x1 = ring[i][0];
    const y1 = ring[i][1];
    const x2 = ring[j][0];
    const y2 = ring[j][1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 1e-12 ? ((x - x1) * dx + (y - y1) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const px = x1 + t * dx;
    const py = y1 + t * dy;
    const dSq = (x - px) * (x - px) + (y - py) * (y - py);
    if (dSq < minSq) minSq = dSq;
  }
  return minSq;
}

interface PolygonMetrics {
  areaDeg2: number;
  areaKm2: number;
  lonCenter: number;
  latCenter: number;
  lonSpan: number;
  latSpan: number;
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

/**
 * Computes antimeridian-safe area, span, and a guaranteed interior label point
 * (using shoelace area centroid + pole-of-inaccessibility grid search for concave shapes).
 */
function analyzePolygon(poly: number[][][]): PolygonMetrics {
  const outer = poly[0] ?? [];
  if (outer.length === 0) {
    return {
      areaDeg2: 0,
      areaKm2: 0,
      lonCenter: 0,
      latCenter: 0,
      lonSpan: 1,
      latSpan: 1,
      minLon: -0.5,
      minLat: -0.5,
      maxLon: 0.5,
      maxLat: 0.5,
    };
  }

  const crosses = ringCrossesAntimeridian(outer);
  const workPoly = crosses ? poly.map(unwrapRingLon) : poly;
  const workOuter = workPoly[0];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let signedArea2 = 0;
  let cxAcc = 0;
  let cyAcc = 0;
  let sumX = 0;
  let sumY = 0;

  for (let i = 0; i < workOuter.length; i++) {
    const [x1, y1] = workOuter[i];
    const [x2, y2] = workOuter[(i + 1) % workOuter.length];
    if (x1 < minX) minX = x1;
    if (x1 > maxX) maxX = x1;
    if (y1 < minY) minY = y1;
    if (y1 > maxY) maxY = y1;
    sumX += x1;
    sumY += y1;

    const cross = x1 * y2 - x2 * y1;
    signedArea2 += cross;
    cxAcc += (x1 + x2) * cross;
    cyAcc += (y1 + y2) * cross;
  }

  const lonSpan = Math.max(0.02, maxX - minX);
  const latSpan = Math.max(0.02, maxY - minY);
  const midLatRad = (((minY + maxY) * 0.5) * Math.PI) / 180;
  const cosLat = Math.max(0.15, Math.cos(midLatRad));
  const polyDeg2 = Math.abs(signedArea2) * 0.5;
  const areaDeg2 = polyDeg2 * cosLat;
  const areaKm2 = Math.max(1, Math.round(polyDeg2 * 111.32 * 111.32 * cosLat));

  let bestX =
    Math.abs(signedArea2) > 1e-7 ? cxAcc / (3 * signedArea2) : sumX / workOuter.length;
  let bestY =
    Math.abs(signedArea2) > 1e-7 ? cyAcc / (3 * signedArea2) : sumY / workOuter.length;

  // Verify interiority & find pole-of-inaccessibility on a 9x9 interior grid so concave
  // countries (Chile, Croatia, Vietnam, Norway, Japan, Italy) always place labels squarely on land
  let bestClearanceSq = pointInPolygonPlanar(bestX, bestY, workPoly)
    ? minDistSqToRingEdges(bestX, bestY, workOuter)
    : -1;

  if (lonSpan > 0.08 && latSpan > 0.08) {
    const steps = 9;
    for (let gx = 1; gx <= steps; gx++) {
      const tx = minX + (lonSpan * gx) / (steps + 1);
      for (let gy = 1; gy <= steps; gy++) {
        const ty = minY + (latSpan * gy) / (steps + 1);
        if (!pointInPolygonPlanar(tx, ty, workPoly)) continue;
        let clearance = minDistSqToRingEdges(tx, ty, workOuter);
        for (let h = 1; h < workPoly.length; h++) {
          clearance = Math.min(clearance, minDistSqToRingEdges(tx, ty, workPoly[h]));
        }
        if (clearance > bestClearanceSq * 1.15 || bestClearanceSq < 0) {
          bestClearanceSq = clearance;
          bestX = tx;
          bestY = ty;
        }
      }
    }
  }

  return {
    areaDeg2,
    areaKm2,
    lonCenter: wrapLon180(bestX),
    latCenter: bestY,
    lonSpan,
    latSpan,
    minLon: wrapLon180(minX),
    minLat: minY,
    maxLon: wrapLon180(maxX),
    maxLat: maxY,
  };
}

function inferRegionPt(lon: number, lat: number, nameEn: string): string {
  if (lat < -60) return 'Antártida';
  if (
    nameEn === 'French Guiana' ||
    nameEn === 'Guyana' ||
    nameEn === 'Suriname' ||
    nameEn === 'Falkland Is.' ||
    nameEn === 'Caribbean Netherlands' ||
    nameEn === 'Curaçao' ||
    nameEn === 'Aruba' ||
    nameEn === 'Trinidad and Tobago'
  ) {
    return lon < -64 && lat > 11.5 ? 'Caribe / América do Sul' : 'América do Sul';
  }
  if (lon >= -93 && lon <= -30 && lat >= -58 && lat <= 12.6) return 'América do Sul';
  if (lon >= -172 && lon <= -50 && lat > 12.6 && lat <= 84) return 'América do Norte e Central';
  if (nameEn === 'Svalbard' || nameEn === 'Iceland' || nameEn === 'Russia') {
    return nameEn === 'Russia' ? 'Europa / Ásia' : 'Europa';
  }
  if (lon >= -26 && lon <= 45 && lat > 34.5 && lat <= 82) return 'Europa';
  if (lon >= -26 && lon <= 58 && lat >= -38 && lat <= 37.5) return 'África';
  if (
    (lon > 110 && lat < -8 && lat > -52) ||
    nameEn === 'New Zealand' ||
    nameEn === 'Papua New Guinea' ||
    nameEn === 'Fiji' ||
    nameEn === 'Solomon Is.' ||
    nameEn === 'Vanuatu' ||
    nameEn === 'New Caledonia' ||
    nameEn === 'Samoa' ||
    nameEn === 'Tonga'
  ) {
    return 'Oceania';
  }
  return 'Ásia';
}

const REGION_PT_TO_EN: Record<string, string> = {
  Antártida: 'Antarctica',
  'Caribe / América do Sul': 'Caribbean / South America',
  'América do Sul': 'South America',
  'América do Norte e Central': 'North & Central America',
  'Europa / Ásia': 'Europe / Asia',
  Europa: 'Europe',
  África: 'Africa',
  Oceania: 'Oceania',
  Ásia: 'Asia',
};

function formatHemisphere(lon: number, lat: number): { pt: string; en: string } {
  const nsPt = lat >= 0 ? 'Norte' : 'Sul';
  const ewPt = lon >= 0 ? 'Oriental' : 'Ocidental';
  const nsEn = lat >= 0 ? 'Northern' : 'Southern';
  const ewEn = lon >= 0 ? 'Eastern' : 'Western';
  return {
    pt: `${nsPt} / ${ewPt}`,
    en: `${nsEn} / ${ewEn}`,
  };
}

function formatTimezone(lon: number): string {
  const offset = Math.round(lon / 15);
  if (offset === 0) return 'UTC±0';
  return offset > 0 ? `UTC+${offset}` : `UTC${offset}`;
}

function extractPolygons(geometry: Geometry): number[][][][] {
  if (geometry.type === 'Polygon') {
    return [(geometry as Polygon).coordinates];
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry as MultiPolygon).coordinates;
  }
  return [];
}

function flattenPolygonRings(polygons: number[][][][]): number[][][] {
  const rings: number[][][] = [];
  for (const poly of polygons) {
    for (const ring of poly) {
      rings.push(ring);
    }
  }
  return rings;
}

function buildEntryFromPolygons(params: {
  id: string;
  nameEn: string;
  namePt: string;
  polygons: number[][][][];
  neighborsPt: string[];
  isMinorUninhabited: boolean;
}): CountryEntry | null {
  const { id, nameEn, namePt, polygons, neighborsPt, isMinorUninhabited } = params;
  if (polygons.length === 0) return null;

  let best = analyzePolygon(polygons[0]);
  let totalAreaKm2 = best.areaKm2;

  for (let i = 1; i < polygons.length; i++) {
    const candidate = analyzePolygon(polygons[i]);
    totalAreaKm2 += candidate.areaKm2;
    if (candidate.areaKm2 > best.areaKm2) {
      best = candidate;
    }
  }

  const lon = Number(best.lonCenter.toFixed(3));
  const lat = Number(best.latCenter.toFixed(3));
  const rings = flattenPolygonRings(polygons);
  const regionPt = inferRegionPt(lon, lat, nameEn);
  const hemisphere = formatHemisphere(lon, lat);

  let minLon = best.minLon;
  let minLat = best.minLat;
  let maxLon = best.maxLon;
  let maxLat = best.maxLat;
  for (let i = 0; i < polygons.length; i++) {
    const pm = analyzePolygon(polygons[i]);
    if (pm.minLat < minLat) minLat = pm.minLat;
    if (pm.maxLat > maxLat) maxLat = pm.maxLat;
  }

  return {
    id,
    nameEn,
    namePt,
    searchKey: normalizeText(`${namePt} ${nameEn}`),
    lon,
    lat,
    lonSpan: Number(best.lonSpan.toFixed(2)),
    latSpan: Number(best.latSpan.toFixed(2)),
    bbox: [
      Number(minLon.toFixed(3)),
      Number(minLat.toFixed(3)),
      Number(maxLon.toFixed(3)),
      Number(maxLat.toFixed(3)),
    ],
    areaApproxKm2: totalAreaKm2,
    regionPt,
    regionEn: REGION_PT_TO_EN[regionPt] ?? 'World',
    hemispherePt: hemisphere.pt,
    hemisphereEn: hemisphere.en,
    timezoneApprox: formatTimezone(lon),
    neighborsPt: Array.from(new Set(neighborsPt)),
    idealDistance: computeIdealZoomDistance(best.lonSpan, best.latSpan),
    rings,
    polygons,
    isMinorUninhabited,
  };
}

let cachedWorldData: {
  countries: CountryEntry[];
  allRings: number[][][];
  landBorderRings: number[][][];
  coastlineRings: number[][][];
} | null = null;

export function loadWorldCountries(): {
  countries: CountryEntry[];
  allRings: number[][][];
  landBorderRings: number[][][];
  coastlineRings: number[][][];
} {
  if (cachedWorldData) {
    return cachedWorldData;
  }

  const topology = countriesAtlas as unknown as Topology<{
    countries: GeometryCollection<{ name?: string }>;
  }>;
  const geojson = feature(topology, topology.objects.countries) as FeatureCollection<
    Geometry,
    { name?: string }
  >;
  const neighborIndexes = neighbors(topology.objects.countries.geometries);

  // Deduplicated topological arcs: internal land borders (a !== b) vs coastlines (a === b)
  const landMesh = mesh(
    topology,
    topology.objects.countries,
    (a, b) => a !== b
  ) as MultiLineString;
  const coastMesh = mesh(
    topology,
    topology.objects.countries,
    (a, b) => a === b
  ) as MultiLineString;
  const fullMesh = mesh(topology, topology.objects.countries) as MultiLineString;

  const indexToPtName = geojson.features.map((f) => {
    const en = f.properties?.name?.trim() ?? '';
    return PT_COUNTRY_NAMES[en] ?? en;
  });

  const countries: CountryEntry[] = [];
  const usedIds = new Set<string>();

  const claimUniqueId = (preferredId: string, fallbackName: string): string => {
    const cleanBase = preferredId.trim();
    if (cleanBase && !usedIds.has(cleanBase)) {
      usedIds.add(cleanBase);
      return cleanBase;
    }
    const slug = normalizeText(fallbackName).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const candidate = cleanBase ? `${cleanBase}-${slug}` : `territory-${slug}`;
    usedIds.add(candidate);
    return candidate;
  };

  for (let featIdx = 0; featIdx < geojson.features.length; featIdx++) {
    const feat = geojson.features[featIdx];
    if (!feat.geometry) continue;
    const nameEn = feat.properties?.name?.trim();
    if (!nameEn || nameEn === 'China' || String(feat.id ?? '') === '156') continue;

    const rawPolygons = extractPolygons(feat.geometry);
    if (rawPolygons.length === 0) continue;

    const rulesForParent = DETACHED_TERRITORY_RULES.filter((r) => r.parentNameEn === nameEn);
    let remainingPolygons = rawPolygons;

    if (rulesForParent.length > 0) {
      const buckets = new Map<DetachedTerritoryRule, number[][][][]>();
      const keptForParent: number[][][][] = [];

      for (const poly of rawPolygons) {
        const metrics = analyzePolygon(poly);
        const matchedRule = rulesForParent.find((r) =>
          r.match(metrics.lonCenter, metrics.latCenter)
        );
        if (matchedRule) {
          const list = buckets.get(matchedRule) ?? [];
          list.push(poly);
          buckets.set(matchedRule, list);
        } else {
          keptForParent.push(poly);
        }
      }

      for (const [rule, detachedPolys] of buckets.entries()) {
        const detachedEntry = buildEntryFromPolygons({
          id: claimUniqueId(rule.idSuffix, rule.nameEn),
          nameEn: rule.nameEn,
          namePt: rule.namePt,
          polygons: detachedPolys,
          neighborsPt: rule.neighborsPt,
          isMinorUninhabited: false,
        });
        if (detachedEntry) {
          countries.push(detachedEntry);
        }
      }

      remainingPolygons = keptForParent.length > 0 ? keptForParent : rawPolygons;
    }

    const namePt = PT_COUNTRY_NAMES[nameEn] ?? nameEn;
    let neighborNames = (neighborIndexes[featIdx] ?? [])
      .map((idx) => indexToPtName[idx])
      .filter((n) => n && n !== namePt);

    // Fix South American / European neighbor cross-contamination caused by French Guiana in world-atlas
    if (nameEn === 'Brazil' || nameEn === 'Suriname') {
      neighborNames = neighborNames.map((n) => (n === 'França' ? 'Guiana Francesa' : n));
    } else if (nameEn === 'France') {
      neighborNames = neighborNames.filter((n) => n !== 'Brasil' && n !== 'Suriname');
    }

    const canonicalWorldAtlasId =
      feat.id !== undefined && feat.id !== null ? String(feat.id).padStart(3, '0') : '';

    const entry = buildEntryFromPolygons({
      id: claimUniqueId(canonicalWorldAtlasId, nameEn),
      nameEn,
      namePt,
      polygons: remainingPolygons,
      neighborsPt: neighborNames,
      isMinorUninhabited: MINOR_UNINHABITED_EN.has(nameEn),
    });

    if (entry) {
      countries.push(entry);
    }
  }

  countries.sort((a, b) => a.namePt.localeCompare(b.namePt, 'pt-BR'));

  cachedWorldData = {
    countries,
    allRings: fullMesh.coordinates,
    landBorderRings: landMesh.coordinates,
    coastlineRings: coastMesh.coordinates,
  };
  return cachedWorldData;
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

function pointInGeoPolygon(lon: number, lat: number, poly: number[][][]): boolean {
  if (poly.length === 0) return false;
  if (ringCrossesAntimeridian(poly[0])) {
    const testLon = lon < 0 ? lon + 360 : lon;
    const unwrapped = poly.map(unwrapRingLon);
    return pointInPolygonPlanar(testLon, lat, unwrapped);
  }
  return pointInPolygonPlanar(lon, lat, poly);
}

/**
 * Hole-aware, enclave-safe country lookup at (lon, lat).
 * - Respects interior polygon holes (so Lesotho inside South Africa & Vatican/San Marino inside Italy are selectable)
 * - Breaks ties in favor of the smaller territory (`areaApproxKm2` ascending)
 * - Supports optional `proximityDeg` tolerance for clicking small islands & microstates
 */
export function findCountryAtLonLat(
  lon: number,
  lat: number,
  countries: CountryEntry[],
  proximityDeg = 0
): CountryEntry | null {
  let bestHit: CountryEntry | null = null;

  for (const country of countries) {
    for (const poly of country.polygons) {
      if (pointInGeoPolygon(lon, lat, poly)) {
        if (!bestHit || country.areaApproxKm2 < bestHit.areaApproxKm2) {
          bestHit = country;
        }
        break;
      }
    }
  }

  if (proximityDeg > 0 && (!bestHit || bestHit.areaApproxKm2 >= 2_500)) {
    // Allow microstates / land enclaves (< 800 km², e.g. Vaticano, Mônaco, San Marino) to be hit cleanly inside a large host country,
    // and small island nations (< 12,000 km²) to be hit cleanly near their coastline whenbestHit is ocean (null).
    const maxCandidateArea = bestHit ? 800 : 12_000;
    const effectiveTol = bestHit ? Math.min(proximityDeg, 0.06) : proximityDeg;
    let nearestMicro: CountryEntry | null = null;
    let nearestDistSq = effectiveTol * effectiveTol;
    for (const country of countries) {
      if (country.areaApproxKm2 > maxCandidateArea || country.isMinorUninhabited) continue;
      let dLon = Math.abs(lon - country.lon);
      if (dLon > 180) dLon = 360 - dLon;
      const dLat = Math.abs(lat - country.lat);
      const dSq = dLon * dLon + dLat * dLat;
      if (dSq <= nearestDistSq) {
        nearestDistSq = dSq;
        nearestMicro = country;
      }
    }
    if (nearestMicro) {
      return nearestMicro;
    }
  }

  return bestHit;
}
