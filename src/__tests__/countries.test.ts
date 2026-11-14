import { describe, expect, it } from 'vitest';
import {
  findCountryAtLonLat,
  loadWorldCountries,
  searchCountries,
} from '../geo/countries';

describe('geo/countries', () => {
  const { countries, allRings } = loadWorldCountries();

  it('loads offline world-atlas 10m high-detail countries and border rings', () => {
    expect(countries.length).toBeGreaterThan(200);
    expect(allRings.length).toBeGreaterThan(1000);
  });

  it('computes accurate mainland centroids for Brazil, USA, and Japan', () => {
    const brazil = countries.find((c) => c.nameEn === 'Brazil');
    expect(brazil).toBeDefined();
    expect(brazil!.namePt).toBe('Brasil');
    expect(brazil!.lon).toBeGreaterThan(-65);
    expect(brazil!.lon).toBeLessThan(-40);
    expect(brazil!.lat).toBeGreaterThan(-25);
    expect(brazil!.lat).toBeLessThan(0);

    const usa = countries.find((c) => c.nameEn === 'United States of America');
    expect(usa).toBeDefined();
    expect(usa!.lon).toBeGreaterThan(-120);
    expect(usa!.lon).toBeLessThan(-75);
    expect(usa!.lat).toBeGreaterThan(25);
    expect(usa!.lat).toBeLessThan(50);

    const japan = countries.find((c) => c.nameEn === 'Japan');
    expect(japan).toBeDefined();
    expect(japan!.lon).toBeGreaterThan(128);
    expect(japan!.lon).toBeLessThan(148);
  });

  it('supports bilingual search in Portuguese and English', () => {
    const resPt = searchCountries('Brasil', countries);
    expect(resPt[0]?.nameEn).toBe('Brazil');

    const resAccent = searchCountries('Japao', countries);
    expect(resAccent.some((c) => c.nameEn === 'Japan')).toBe(true);

    const resEn = searchCountries('Germany', countries);
    expect(resEn[0]?.namePt).toBe('Alemanha');
  });

  it('identifies country at geographic coordinates inside Brazil', () => {
    const hit = findCountryAtLonLat(-47.9, -15.8, countries); // Brasília
    expect(hit?.nameEn).toBe('Brazil');

    const ocean = findCountryAtLonLat(-30, 0, countries); // Mid-Atlantic
    expect(ocean).toBeNull();
  });
});
