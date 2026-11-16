import { ALL_COUNTRY_OPTIONS, ALL_ISO_ALPHA2_CODES } from '../components/CountryFlag';
import {
  CountryStudioPayload,
  CountryTelemetrySummary,
  ExperienceCountry,
  ExperienceLayersState,
  ExperiencePlaybackState,
  LAYER_METAS,
  Lang,
  VISUAL_LAYER_ORDER,
  VisualLayerId,
} from '../experience/types';
import { COUNTRY_ID_TO_ALPHA2 } from '../scenes/studioGeometry';
import { DatasetId, NASA_DATASETS } from './nasaDatasets';

export interface CountryNasaLayerMetric {
  layerId: VisualLayerId;
  datasetId: DatasetId;
  svsId: string;
  layerLabel: string;
  phenomenonLabel: string;
  funLabel: string;
  funHint: string;
  sensorLabel: string;
  accentHex: string;
  enabled: boolean;
  /** Primary value measured for this country in the official NASA layer */
  metricHeadline: string;
  /** Complementary context extracted from meta.json / official SVS scale */
  metricSubline: string;
  /** Concise label for compact blocks and cards */
  compactLabel: string;
  /** Official NASA SVS scale / unit */
  scaleLabel: string;
  /** Normalized value [0..1] for proportional visual bar */
  normalized01: number | null;
  sourceUrl: string;
}

export interface CountryNasaReport {
  countryId: string;
  countryName: string;
  alpha2: string | null;
  coordinatesLabel: string;
  hasTelemetry: boolean;
  summaryLine: string;
  curiosityTitle: string;
  curiosityText: string;
  regionBpm: number;
  regionKeyLabel: string;
  layers: CountryNasaLayerMetric[];
  byLayerId: Record<VisualLayerId, CountryNasaLayerMetric>;
  byDatasetId: Record<DatasetId, CountryNasaLayerMetric>;
}

function normalizeNameKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

let cachedAlpha2Map: Map<string, string> | null = null;
function getAlpha2Lookup(): Map<string, string> {
  if (cachedAlpha2Map) return cachedAlpha2Map;
  const map = new Map<string, string>();
  for (const opt of ALL_COUNTRY_OPTIONS) {
    map.set(normalizeNameKey(opt.namePt), opt.code);
  }
  if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
    const enDisplay = new Intl.DisplayNames(['en'], { type: 'region' });
    for (const code of ALL_ISO_ALPHA2_CODES) {
      const enName = enDisplay.of(code);
      if (enName) map.set(normalizeNameKey(enName), code);
    }
  }
  cachedAlpha2Map = map;
  return map;
}

export function resolveCountryAlpha2(id: string, namePt: string, nameEn: string): string | null {
  if (COUNTRY_ID_TO_ALPHA2[id]) return COUNTRY_ID_TO_ALPHA2[id];
  const map = getAlpha2Lookup();
  return map.get(normalizeNameKey(nameEn)) ?? map.get(normalizeNameKey(namePt)) ?? null;
}

function classifyIndexLevel(v01: number, isPt: boolean, kind: 'co' | 'nox' | 'temp'): string {
  if (kind === 'co') {
    if (v01 < 0.35) return isPt ? 'Ar leve e limpo' : 'Clean background air';
    if (v01 < 0.65) return isPt ? 'Concentração moderada' : 'Moderate concentration';
    return isPt ? 'Pluma densa de carbono' : 'Dense carbon plume';
  }
  if (kind === 'nox') {
    if (v01 < 0.35) return isPt ? 'Céu calmo de emissões' : 'Low emission background';
    if (v01 < 0.7) return isPt ? 'Emissão urbana moderada' : 'Moderate urban emissions';
    return isPt ? 'Forte pulso das cidades' : 'Strong urban-industrial pulse';
  }
  if (v01 < 0.35) return isPt ? 'Brisa fria / polar' : 'Cold / subpolar air';
  if (v01 < 0.65) return isPt ? 'Clima ameno' : 'Temperate / mild air';
  return isPt ? 'Calor intenso de superfície' : 'Warm / tropical surface';
}

function classifyWindMs(ms: number, isPt: boolean): string {
  if (ms < 5) return isPt ? 'Ar calmo a brisa leve' : 'Calm to light breeze';
  if (ms < 12) return isPt ? 'Brisas em movimento' : 'Steady moving breeze';
  if (ms < 20) return isPt ? 'Ventos fortes de superfície' : 'Strong surface winds';
  return isPt ? 'Rajadas velozes' : 'High-speed wind gusts';
}

function buildFunNasaCuriosity(params: {
  countryName: string;
  telemetrySummary: CountryTelemetrySummary | null;
  regionBpm: number;
  coordinatesLabel: string;
  isPt: boolean;
}): { title: string; text: string } {
  const { countryName, telemetrySummary, regionBpm, coordinatesLabel, isPt } = params;
  if (!telemetrySummary) {
    return {
      title: isPt ? 'Curiosidade da Órbita · NASA' : 'Orbital Curiosity · NASA',
      text: isPt
        ? `Sincronizando as 5 leituras de satélite sobre ${countryName} (${coordinatesLabel}) para revelar os destaques atmosféricos deste território.`
        : `Syncing all 5 NASA satellite layers over ${countryName} (${coordinatesLabel}) to reveal atmospheric highlights.`,
    };
  }

  const flashes = telemetrySummary.lightningHotspotCount;
  const flashStr = flashes.toLocaleString(isPt ? 'pt-BR' : 'en-US');
  const tempPct = Math.round(telemetrySummary.meanTemperature01 * 100);
  const coPct = Math.round(telemetrySummary.meanCo01 * 100);
  const noxPct = Math.round(telemetrySummary.meanNox01 * 100);
  const windMs = telemetrySummary.windMeanSpeedMs;
  const windKmh = Math.round(windMs * 3.6);

  if (flashes >= 700 && tempPct >= 65) {
    return {
      title: isPt ? 'Você sabia? · Céu Elétrico' : 'Did You Know? · Electric Sky',
      text: isPt
        ? `Do espaço, a Estação Espacial (ISS) registrou ${flashStr} flashes de raios sobre ${countryName} — combinados a ${tempPct}% de índice térmico, acelerando a música para ${regionBpm} BPM!`
        : `From space, the ISS counted ${flashStr} lightning flashes over ${countryName} — paired with a ${tempPct}% thermal index, driving the soundtrack to ${regionBpm} BPM!`,
    };
  }

  if (flashes >= 700 && tempPct < 65) {
    return {
      title: isPt ? 'Você sabia? · Surpresa de Raios' : 'Did You Know? · Lightning Surprise',
      text: isPt
        ? `Mesmo com temperatura amena (${tempPct}% no GEOS-FP e ${regionBpm} BPM), ${countryName} acumulou ${flashStr} registros elétricos na janela orbital da ISS!`
        : `Even with milder air (${tempPct}% in GEOS-FP at ${regionBpm} BPM), ${countryName} lit up with ${flashStr} orbital lightning events from the ISS!`,
    };
  }

  if (flashes <= 25 && tempPct >= 70) {
    return {
      title: isPt ? 'Você sabia? · Calor sem Tempestades' : 'Did You Know? · Sun & Calm Skies',
      text: isPt
        ? `Quase nenhum raio detectado pela ISS sobre ${countryName} (apenas ${flashStr} flashes!), mas o termômetro orbital T2M marca ${tempPct}%, embalando o ritmo em ${regionBpm} BPM.`
        : `Almost zero lightning detected by the ISS over ${countryName} (only ${flashStr} flashes!), yet the T2M thermal map glows at ${tempPct}% setting a ${regionBpm} BPM groove.`,
    };
  }

  if (windMs >= 15) {
    return {
      title: isPt ? 'Você sabia? · Corredor dos Ventos' : 'Did You Know? · Wind Corridor',
      text: isPt
        ? `O modelo GEOS-FP registra ventos médios de ${windMs.toFixed(1)} m/s (${windKmh} km/h!) sobre ${countryName} — é por isso que a camada 8D passeia com tanta força pela sala.`
        : `NASA GEOS-FP captures surface winds averaging ${windMs.toFixed(1)} m/s (${windKmh} km/h!) over ${countryName} — swirling the 8D spatial audio around the room.`,
    };
  }

  if (noxPct >= 85 && coPct >= 70) {
    return {
      title: isPt ? 'Você sabia? · Assinatura Urbana' : 'Did You Know? · City Signature',
      text: isPt
        ? `Os mapas químicos da NASA destacam ${noxPct}% de NO₂ urbano e ${coPct}% de CO sobre ${countryName}, transformando o pulsar das metrópoles em acordes e graves contínuos.`
        : `NASA atmospheric chemistry highlights ${noxPct}% urban NO₂ and ${coPct}% CO over ${countryName}, turning bustling city corridors into deep chords and bass.`,
    };
  }

  return {
    title: isPt ? 'Curiosidade da Órbita · NASA' : 'Orbital Curiosity · NASA',
    text: isPt
      ? `Sobre ${countryName}, a ISS flagrou ${flashStr} pontos de raios enquanto ventos de ${windMs.toFixed(1)} m/s (${windKmh} km/h) cruzam o mapa térmico (${tempPct}% T2M · ${regionBpm} BPM).`
      : `Over ${countryName}, the ISS spotted ${flashStr} lightning points while ${windMs.toFixed(1)} m/s (${windKmh} km/h) winds sweep across the thermal field (${tempPct}% T2M · ${regionBpm} BPM).`,
  };
}

export function buildCountryNasaReport(params: {
  country: ExperienceCountry | null;
  telemetrySummary: CountryTelemetrySummary | null;
  studioData: CountryStudioPayload | null;
  playback: Pick<ExperiencePlaybackState, 'bpm' | 'keyRoot' | 'keyRootPt' | 'windMeanSpeed'>;
  layers: ExperienceLayersState;
  lang: Lang;
}): CountryNasaReport | null {
  const { country, telemetrySummary, studioData, playback, layers, lang } = params;
  if (!country) return null;

  const isPt = lang === 'pt';
  const countryName = isPt ? country.namePt : country.nameEn;
  const alpha2 = resolveCountryAlpha2(country.id, country.namePt, country.nameEn);
  const latAbs = Math.abs(country.lat).toFixed(1);
  const lonAbs = Math.abs(country.lon).toFixed(1);
  const latHem = country.lat >= 0 ? 'N' : 'S';
  const lonHem = country.lon >= 0 ? 'E' : 'W';
  const coordinatesLabel = `${latAbs}°${latHem} · ${lonAbs}°${lonHem}`;

  const regionSession = studioData?.sessions?.region;
  const melParams = regionSession?.musicalParameters?.melody;
  const regionBpm = regionSession?.bpm ?? playback.bpm;
  const regionKeyLabel = regionSession
    ? isPt
      ? regionSession.keyRootPt
      : regionSession.keyRoot
    : isPt
      ? playback.keyRootPt
      : playback.keyRoot;

  const hasTelemetry = Boolean(telemetrySummary);
  const curiosity = buildFunNasaCuriosity({
    countryName,
    telemetrySummary,
    regionBpm,
    coordinatesLabel,
    isPt,
  });

  const items: CountryNasaLayerMetric[] = VISUAL_LAYER_ORDER.map((layerId) => {
    const meta = LAYER_METAS[layerId];
    const ds = NASA_DATASETS[meta.datasetId];
    const layerLabel = isPt ? meta.labelPt : meta.labelEn;
    const phenomenonLabel = isPt ? meta.phenomenonPt : meta.phenomenonEn;
    const sensorLabel = isPt ? ds.sensorLabel : ds.sensorLabelEn;
    const scaleLabel = isPt ? ds.unitLabel : ds.unitLabelEn;
    const enabled = layers[layerId].enabled;

    const funMeta: Record<VisualLayerId, { label: string; hint: string }> = {
      melody: {
        label: isPt ? 'Raios vistos da ISS' : 'Lightning from ISS',
        hint: isPt ? 'Céu elétrico captado em órbita' : 'Orbital flashes spotted above',
      },
      chords: {
        label: isPt ? 'Rastro de Carbono (CO)' : 'Carbon Trail (CO)',
        hint: isPt ? 'Plumas viajando na atmosfera' : 'Atmospheric plumes drifting across',
      },
      bass: {
        label: isPt ? 'Pulso Urbano (NO₂)' : 'City Pulse (NO₂)',
        hint: isPt ? 'Sinal de cidades e rotas' : 'Cities & shipping lanes glow',
      },
      wind: {
        label: isPt ? 'Correntes de Vento' : 'Wind Streams',
        hint: isPt ? 'Ar em movimento a 10 m' : 'Surface winds at 10 m height',
      },
      temperature: {
        label: isPt ? 'Termômetro & Ritmo' : 'Thermal & Tempo',
        hint: isPt ? 'Calor define o BPM da música' : 'Heat sets the musical BPM',
      },
    };

    if (!telemetrySummary) {
      const pendingText = isPt ? 'Lendo satélite NASA...' : 'Reading NASA satellite...';
      return {
        layerId,
        datasetId: meta.datasetId,
        svsId: ds.svsId,
        layerLabel,
        phenomenonLabel,
        funLabel: funMeta[layerId].label,
        funHint: funMeta[layerId].hint,
        sensorLabel,
        accentHex: meta.accentHex,
        enabled,
        metricHeadline: pendingText,
        metricSubline: `${ds.svsId} · ${sensorLabel}`,
        compactLabel: `${ds.svsId} · ${pendingText}`,
        scaleLabel,
        normalized01: null,
        sourceUrl: ds.sourceUrl,
      };
    }

    if (layerId === 'melody') {
      const count = telemetrySummary.lightningHotspotCount;
      const numFmt = count.toLocaleString(isPt ? 'pt-BR' : 'en-US');
      const sparkleSuffix = melParams
        ? isPt
          ? ` · ${melParams.sparkleCount} picos densos`
          : ` · ${melParams.sparkleCount} dense bursts`
        : '';
      return {
        layerId,
        datasetId: meta.datasetId,
        svsId: ds.svsId,
        layerLabel,
        phenomenonLabel,
        funLabel: funMeta.melody.label,
        funHint: funMeta.melody.hint,
        sensorLabel,
        accentHex: meta.accentHex,
        enabled,
        metricHeadline: isPt ? `${numFmt} focos elétricos` : `${numFmt} lightning flashes`,
        metricSubline: isPt
          ? `Janela orbital ISS-LIS (±55°)${sparkleSuffix}`
          : `ISS-LIS orbital window (±55°)${sparkleSuffix}`,
        compactLabel: isPt
          ? `SVS 5011 · ${numFmt} focos ISS`
          : `SVS 5011 · ${numFmt} ISS flashes`,
        scaleLabel,
        normalized01: Math.min(1, count / 1000),
        sourceUrl: ds.sourceUrl,
      };
    }

    if (layerId === 'chords') {
      const pct = Math.round(telemetrySummary.meanCo01 * 100);
      const levelDesc = classifyIndexLevel(telemetrySummary.meanCo01, isPt, 'co');
      return {
        layerId,
        datasetId: meta.datasetId,
        svsId: ds.svsId,
        layerLabel,
        phenomenonLabel,
        funLabel: funMeta.chords.label,
        funHint: funMeta.chords.hint,
        sensorLabel,
        accentHex: meta.accentHex,
        enabled,
        metricHeadline: isPt ? `CO médio: ${pct}%` : `Mean CO: ${pct}%`,
        metricSubline: `${levelDesc} · 40–500 ppbv`,
        compactLabel: `SVS 5153 · CO ${pct}% (40–500 ppbv)`,
        scaleLabel,
        normalized01: Math.max(0, Math.min(1, telemetrySummary.meanCo01)),
        sourceUrl: ds.sourceUrl,
      };
    }

    if (layerId === 'bass') {
      const pct = Math.round(telemetrySummary.meanNox01 * 100);
      const levelDesc = classifyIndexLevel(telemetrySummary.meanNox01, isPt, 'nox');
      return {
        layerId,
        datasetId: meta.datasetId,
        svsId: ds.svsId,
        layerLabel,
        phenomenonLabel,
        funLabel: funMeta.bass.label,
        funHint: funMeta.bass.hint,
        sensorLabel,
        accentHex: meta.accentHex,
        enabled,
        metricHeadline: isPt ? `NO₂ médio: ${pct}%` : `Mean NO₂: ${pct}%`,
        metricSubline: `${levelDesc} · 10⁻³–10¹+ ppbv`,
        compactLabel: `SVS 5154 · NO₂ ${pct}% (log ppbv)`,
        scaleLabel,
        normalized01: Math.max(0, Math.min(1, telemetrySummary.meanNox01)),
        sourceUrl: ds.sourceUrl,
      };
    }

    if (layerId === 'wind') {
      const ms = telemetrySummary.windMeanSpeedMs;
      const kmh = Math.round(ms * 3.6);
      const levelDesc = classifyWindMs(ms, isPt);
      return {
        layerId,
        datasetId: meta.datasetId,
        svsId: ds.svsId,
        layerLabel,
        phenomenonLabel,
        funLabel: funMeta.wind.label,
        funHint: funMeta.wind.hint,
        sensorLabel,
        accentHex: meta.accentHex,
        enabled,
        metricHeadline: `${ms.toFixed(1)} m/s (${kmh} km/h)`,
        metricSubline: `${levelDesc} · 0–40 m/s`,
        compactLabel: `SVS 5148 · ${ms.toFixed(1)} m/s (${kmh} km/h)`,
        scaleLabel,
        normalized01: Math.min(1, ms / 40),
        sourceUrl: ds.sourceUrl,
      };
    }

    const pct = Math.round(telemetrySummary.meanTemperature01 * 100);
    const levelDesc = classifyIndexLevel(telemetrySummary.meanTemperature01, isPt, 'temp');
    return {
      layerId,
      datasetId: meta.datasetId,
      svsId: ds.svsId,
      layerLabel,
      phenomenonLabel,
      funLabel: funMeta.temperature.label,
      funHint: funMeta.temperature.hint,
      sensorLabel,
      accentHex: meta.accentHex,
      enabled,
      metricHeadline: isPt ? `${pct}% T2M · ${regionBpm} BPM` : `${pct}% T2M · ${regionBpm} BPM`,
      metricSubline: `${levelDesc} · -40 °C a +40 °C`,
      compactLabel: `SVS 5147 · T2M ${pct}% · ${regionBpm} BPM`,
      scaleLabel,
      normalized01: Math.max(0, Math.min(1, telemetrySummary.meanTemperature01)),
      sourceUrl: ds.sourceUrl,
    };
  });

  const byLayerId = {} as Record<VisualLayerId, CountryNasaLayerMetric>;
  const byDatasetId = {} as Record<DatasetId, CountryNasaLayerMetric>;
  for (const item of items) {
    byLayerId[item.layerId] = item;
    byDatasetId[item.datasetId] = item;
  }

  const summaryLine = telemetrySummary
    ? isPt
      ? `${telemetrySummary.lightningHotspotCount.toLocaleString('pt-BR')} raios ISS · ${telemetrySummary.windMeanSpeedMs.toFixed(1)} m/s vento · CO ${Math.round(telemetrySummary.meanCo01 * 100)}% · NO₂ ${Math.round(telemetrySummary.meanNox01 * 100)}%`
      : `${telemetrySummary.lightningHotspotCount.toLocaleString('en-US')} ISS flashes · ${telemetrySummary.windMeanSpeedMs.toFixed(1)} m/s wind · CO ${Math.round(telemetrySummary.meanCo01 * 100)}% · NO₂ ${Math.round(telemetrySummary.meanNox01 * 100)}%`
    : isPt
      ? `Coordenadas ${coordinatesLabel} · 5 bases oficiais NASA SVS`
      : `Coordinates ${coordinatesLabel} · 5 official NASA SVS datasets`;

  return {
    countryId: country.id,
    countryName,
    alpha2,
    coordinatesLabel,
    hasTelemetry,
    summaryLine,
    curiosityTitle: curiosity.title,
    curiosityText: curiosity.text,
    regionBpm,
    regionKeyLabel,
    layers: items,
    byLayerId,
    byDatasetId,
  };
}
