import { describe, expect, it } from 'vitest';
import { interpretDatasetRgb } from '../accessibility/a11yEngine';
import { loadWorldCountries } from '../geo/countries';
import { getCountryLogistics } from '../geo/countryLogistics';
import { splitAntimeridianRing } from '../geo/countryMask';

describe('accessibility & logistics & mask', () => {
  const { countries } = loadWorldCountries();

  it('computes region, area, timezone, and bordering neighbors for Brazil', () => {
    const brazil = countries.find((c) => c.nameEn === 'Brazil');
    expect(brazil).toBeDefined();
    expect(brazil!.regionPt).toBe('América do Sul');
    expect(brazil!.areaApproxKm2).toBeGreaterThan(5_000_000);
    expect(brazil!.neighborsPt).toContain('Argentina');
    expect(brazil!.neighborsPt).toContain('Colômbia');

    const profile = getCountryLogistics(brazil!);
    expect(profile.isCurated).toBe(true);
    expect(profile.maritimePortsPt).toContain('Santos');
  });

  it('provides automatic offline logistics fallback for non-curated countries', () => {
    const peru = countries.find((c) => c.nameEn === 'Peru');
    expect(peru).toBeDefined();
    const profile = getCountryLogistics(peru!);
    expect(profile.isCurated).toBe(false);
    expect(profile.subregionPt).toContain('América do Sul');
    expect(profile.airAndLandCorridorsPt).toContain('Brasil');
  });

  it('interprets NASA RGB colors into accessible PT-BR atmospheric readings', () => {
    const lightningHigh = interpretDatasetRgb('svs5011', 255, 220, 40);
    expect(lightningHigh.intensity01).toBeGreaterThan(0.6);
    expect(lightningHigh.labelPt).toContain('Alta atividade');

    const coPlume = interpretDatasetRgb('svs5153', 210, 40, 20);
    expect(coPlume.intensity01).toBeGreaterThan(0.8);
    expect(coPlume.labelPt).toContain('CO');

    const noxUrban = interpretDatasetRgb('svs5154', 210, 250, 210);
    expect(noxUrban.intensity01).toBeGreaterThan(0.8);
    expect(noxUrban.labelPt).toContain('NOx');
  });

  it('splits polygon rings cleanly across antimeridian jumps', () => {
    const ring = [
      [175, 60],
      [178, 62],
      [179, 59],
      [175, 60],
      [-179, 59], // antimeridian jump!
      [-176, 61],
      [-177, 58],
      [-179, 59],
    ];
    const parts = splitAntimeridianRing(ring);
    expect(parts.length).toBe(2);
    expect(parts[0].length).toBe(4);
    expect(parts[1].length).toBe(4);
  });
});
