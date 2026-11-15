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

  it('interprets NASA RGB colors into scientifically calibrated PT-BR atmospheric readings', () => {
    const lightningFlash = interpretDatasetRgb('svs5011', 255, 220, 40);
    expect(lightningFlash.intensity01).toBeGreaterThan(0.7);
    expect(lightningFlash.labelPt).toContain('ISS-LIS');

    const lightningNone = interpretDatasetRgb('svs5011', 20, 20, 20);
    expect(lightningNone.intensity01).toBeLessThan(0.2);
    expect(lightningNone.labelPt).toContain('Sem eventos');

    const coClean = interpretDatasetRgb('svs5153', 255, 245, 190);
    expect(coClean.intensity01).toBeLessThan(0.3);
    expect(coClean.labelPt).toContain('Baixa');

    const coPlume = interpretDatasetRgb('svs5153', 188, 12, 15);
    expect(coPlume.intensity01).toBeGreaterThan(0.8);
    expect(coPlume.labelPt).toContain('elevada de CO');

    // SVS 5154 NOx scale: white/pale mint (10⁻³ ppbv) = LOW; dark forest green (10¹+ ppbv) = HIGH
    const noxCleanOcean = interpretDatasetRgb('svs5154', 210, 245, 210);
    expect(noxCleanOcean.intensity01).toBeLessThan(0.3);
    expect(noxCleanOcean.labelPt).toContain('Baixa concentração de NOx');

    const noxMidContinent = interpretDatasetRgb('svs5154', 45, 165, 45);
    expect(noxMidContinent.intensity01).toBeGreaterThan(0.4);
    expect(noxMidContinent.intensity01).toBeLessThan(0.8);
    expect(noxMidContinent.labelPt).toContain('moderada de NOx');

    const noxUrbanMetropolis = interpretDatasetRgb('svs5154', 2, 42, 2);
    expect(noxUrbanMetropolis.intensity01).toBeGreaterThan(0.8);
    expect(noxUrbanMetropolis.labelPt).toContain('elevada de NOx');
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
