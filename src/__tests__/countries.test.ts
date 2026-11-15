import { describe, expect, it } from 'vitest';
import {
  findCountryAtLonLat,
  loadWorldCountries,
  searchCountries,
} from '../geo/countries';
import { PT_COUNTRY_NAMES } from '../geo/ptCountryNames';
import { buildMorphLinesFromRings, GLOBE_RADIUS } from '../geo/projection';

describe('geo/countries (v2.3 cartographic integrity)', () => {
  const { countries, allRings, landBorderRings, coastlineRings } = loadWorldCountries();

  it('loads offline world-atlas 10m countries plus separated overseas territories and topological borders', () => {
    expect(countries.length).toBeGreaterThanOrEqual(260);
    expect(allRings.length).toBeGreaterThan(1000);
    expect(landBorderRings.length).toBeGreaterThan(150);
    expect(coastlineRings.length).toBeGreaterThan(1000);
  });

  it('separates French Guiana from metropolitan France so "França" never appears next to Brazil', () => {
    const frenchGuiana = countries.find((c) => c.id === '250-gf');
    expect(frenchGuiana).toBeDefined();
    expect(frenchGuiana!.namePt).toBe('Guiana Francesa');
    expect(frenchGuiana!.regionPt).toBe('América do Sul');

    // Clicking Cayenne / interior French Guiana hits Guiana Francesa, NOT França!
    const cayenneHit = findCountryAtLonLat(-53.2, 4.0, countries);
    expect(cayenneHit?.namePt).toBe('Guiana Francesa');
    expect(cayenneHit?.id).toBe('250-gf');

    // Clicking Paris hits metropolitan França in Europe
    const parisHit = findCountryAtLonLat(2.35, 48.85, countries);
    expect(parisHit?.namePt).toBe('França');
    expect(parisHit?.lon).toBeGreaterThan(-6);
    expect(parisHit?.lon).toBeLessThan(10);

    // Neighbor lists are geographically faithful on both continents
    const brazil = countries.find((c) => c.nameEn === 'Brazil')!;
    expect(brazil.neighborsPt).toContain('Guiana Francesa');
    expect(brazil.neighborsPt).not.toContain('França');

    const suriname = countries.find((c) => c.nameEn === 'Suriname')!;
    expect(suriname.neighborsPt).toContain('Guiana Francesa');
    expect(suriname.neighborsPt).not.toContain('França');

    const france = countries.find((c) => c.nameEn === 'France')!;
    expect(france.neighborsPt).not.toContain('Brasil');
    expect(france.neighborsPt).not.toContain('Suriname');
  });

  it('respects polygon holes so enclaves (Lesoto, San Marino, Vaticano) are never swallowed', () => {
    const lesothoHit = findCountryAtLonLat(28.2, -29.5, countries);
    expect(lesothoHit?.namePt).toBe('Lesoto');

    const southAfricaHit = findCountryAtLonLat(24.0, -31.0, countries);
    expect(southAfricaHit?.namePt).toBe('África do Sul');

    const sanMarinoHit = findCountryAtLonLat(12.45, 43.94, countries);
    expect(sanMarinoHit?.namePt).toBe('San Marino');

    const vaticanHit = findCountryAtLonLat(12.453, 41.903, countries, 0.05);
    expect(vaticanHit?.namePt).toBe('Vaticano');
  });

  it('unwraps antimeridian polygons so Russia keeps its true Eurasian mainland centroid and area', () => {
    const russia = countries.find((c) => c.nameEn === 'Russia');
    expect(russia).toBeDefined();
    expect(russia!.namePt).toBe('Rússia');
    expect(russia!.areaApproxKm2).toBeGreaterThan(10_000_000);
    expect(russia!.lon).toBeGreaterThan(60);
    expect(russia!.lon).toBeLessThan(135);
    expect(russia!.lat).toBeGreaterThan(52);
    expect(russia!.lat).toBeLessThan(70);
  });

  it('places concave country anchors inside their territory (Brazil, USA, Japan, Chile, Norway, Croatia)', () => {
    for (const targetEn of [
      'Brazil',
      'United States of America',
      'Japan',
      'Chile',
      'Norway',
      'Croatia',
      'Vietnam',
    ]) {
      const c = countries.find((x) => x.nameEn === targetEn);
      expect(c, `Missing ${targetEn}`).toBeDefined();
      const hitAtOwnAnchor = findCountryAtLonLat(c!.lon, c!.lat, countries, 0.12);
      expect(hitAtOwnAnchor?.id, `${targetEn} anchor (${c!.lon}, ${c!.lat}) fell outside itself`).toBe(
        c!.id
      );
    }
  });

  it('translates 100% of world countries and territories into Brazilian Portuguese', () => {
    for (const c of countries) {
      expect(PT_COUNTRY_NAMES[c.nameEn], `Missing pt-BR translation for "${c.nameEn}"`).toBeDefined();
      expect(c.namePt.length).toBeGreaterThan(1);
    }
    expect(countries.find((c) => c.nameEn === 'Guyana')?.namePt).toBe('Guiana');
    expect(countries.find((c) => c.nameEn === 'Suriname')?.namePt).toBe('Suriname');
    expect(countries.find((c) => c.nameEn === 'W. Sahara')?.namePt).toBe('Saara Ocidental');
    expect(countries.find((c) => c.nameEn === 'Central African Rep.')?.namePt).toBe(
      'Rep. Centro-Africana'
    );
    expect(countries.find((c) => c.nameEn === 'Belarus')?.namePt).toBe('Bielorrússia');
    expect(countries.find((c) => c.nameEn === 'Czechia')?.namePt).toBe('Tchéquia');
  });

  it('subdivides straight border chords so 3D sphere lines never sink below GLOBE_RADIUS', () => {
    // A 14-degree straight Sahara / 49°N parallel segment used to dip to R = 1.0024 * cos(7°) = 0.9949 < 1.0!
    const longSaharaSegment = [
      [
        [-12, 25],
        [4, 25],
      ],
    ];
    const geo = buildMorphLinesFromRings(longSaharaSegment, GLOBE_RADIUS * 1.0024);
    const pos = geo.getAttribute('position');
    expect(pos.count).toBeGreaterThanOrEqual(32); // >= 16 subdivided segments * 2 vertices
    // Check midpoint radius of every segment stays strictly above GLOBE_RADIUS (1.0)
    for (let i = 0; i < pos.count; i += 2) {
      const mx = (pos.getX(i) + pos.getX(i + 1)) * 0.5;
      const my = (pos.getY(i) + pos.getY(i + 1)) * 0.5;
      const mz = (pos.getZ(i) + pos.getZ(i + 1)) * 0.5;
      const midR = Math.hypot(mx, my, mz);
      expect(midR).toBeGreaterThan(GLOBE_RADIUS * 1.002);
    }
    geo.dispose();
  });

  it('supports bilingual search in Portuguese and English including overseas territories', () => {
    expect(searchCountries('Brasil', countries)[0]?.nameEn).toBe('Brazil');
    expect(searchCountries('Guiana Francesa', countries)[0]?.id).toBe('250-gf');
    expect(searchCountries('Japao', countries).some((c) => c.nameEn === 'Japan')).toBe(true);
    expect(searchCountries('Germany', countries)[0]?.namePt).toBe('Alemanha');
  });

  it('uses canonical world-atlas M49 IDs for the pilot countries (076 Brazil, 818 Egypt, 156 China, 840 USA, 484 Mexico) and computes bbox', () => {
    const brazil = countries.find((c) => c.id === '076');
    const egypt = countries.find((c) => c.id === '818');
    const china = countries.find((c) => c.id === '156');
    const usa = countries.find((c) => c.id === '840');
    const mexico = countries.find((c) => c.id === '484');

    expect(brazil?.namePt).toBe('Brasil');
    expect(egypt?.namePt).toBe('Egito');
    expect(china?.namePt).toBe('China');
    expect(usa?.nameEn).toBe('United States of America');
    expect(mexico?.namePt).toBe('México');

    for (const pilot of [brazil!, egypt!, china!, usa!, mexico!]) {
      expect(pilot.bbox).toHaveLength(4);
      expect(pilot.bbox[1]).toBeLessThan(pilot.bbox[3]);
      expect(pilot.regionEn.length).toBeGreaterThan(2);
    }
  });
});
