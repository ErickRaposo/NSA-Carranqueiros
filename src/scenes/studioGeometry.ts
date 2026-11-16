const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export const PNG_MARGIN_RATIO = 0.08;

export const COUNTRY_ID_TO_ALPHA2: Record<string, string> = {
  '076': 'BR',
  '840': 'US',
  '250': 'FR',
  '392': 'JP',
  '276': 'DE',
  '818': 'EG',
  '356': 'IN',
  '484': 'MX',
  '036': 'AU',
  '710': 'ZA',
  '620': 'PT',
  '826': 'GB',
  '643': 'RU',
  '410': 'KR',
  '032': 'AR',
  '124': 'CA',
  '170': 'CO',
  '152': 'CL',
  '604': 'PE',
  '724': 'ES',
  '380': 'IT',
  '024': 'AO',
  '508': 'MZ',
};

/**
 * Converts a MIDI pitch integer (e.g. 60 -> "C4", 66 -> "F#4") into scientific pitch notation.
 */
export function midiToNoteName(midi: number): string {
  const m = Math.round(midi);
  const name = NOTE_NAMES[((m % 12) + 12) % 12];
  const octave = Math.floor(m / 12) - 1;
  return `${name}${octave}`;
}

export interface CountryPngFrameMetrics {
  offsetX01: number;
  offsetY01: number;
  drawnW01: number;
  drawnH01: number;
}

/**
 * Computes the normalized [0..1] framing rectangle of a country's silhouette inside its
 * 1024x1024 RGBA PNG, matching `scripts/render_country_layers.py` and `render_country_layers.swift`.
 */
export function computeCountryPngFrameMetrics(
  bbox: readonly [number, number, number, number]
): CountryPngFrameMetrics {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const midLatRad = (((minLat + maxLat) * 0.5) * Math.PI) / 180.0;
  const cosLat = Math.max(0.18, Math.cos(midLatRad));
  const geoW = Math.max(0.05, (maxLon - minLon) * cosLat);
  const geoH = Math.max(0.05, maxLat - minLat);

  const usable = 1.0 - 2.0 * PNG_MARGIN_RATIO;
  const scale = usable / Math.max(geoW, geoH);
  const drawnW01 = geoW * scale;
  const drawnH01 = geoH * scale;
  const offsetX01 = (1.0 - drawnW01) * 0.5;
  const offsetY01 = (1.0 - drawnH01) * 0.5;

  return { offsetX01, offsetY01, drawnW01, drawnH01 };
}

/**
 * Maps normalized `nasa-geo-sonification` coordinates `(source_x, source_y) ∈ [0..1]²`
 * (where `source_x = 0..1` is West->East and `source_y = 0..1` is North->South / top->bottom)
 * onto the exact `[0..1]²` UV coordinates of the 1024x1024 country silhouette PNG.
 */
export function projectBboxNormToCountryPng01(
  sourceX: number,
  sourceY: number,
  bbox?: readonly [number, number, number, number] | null
): { x01: number; y01: number } {
  const sx = Math.max(0, Math.min(1, sourceX));
  const sy = Math.max(0, Math.min(1, sourceY));
  if (!bbox) {
    return { x01: sx, y01: sy };
  }
  const { offsetX01, offsetY01, drawnW01, drawnH01 } = computeCountryPngFrameMetrics(bbox);
  return {
    x01: offsetX01 + sx * drawnW01,
    y01: offsetY01 + sy * drawnH01,
  };
}
