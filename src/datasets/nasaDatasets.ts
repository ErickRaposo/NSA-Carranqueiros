export type DatasetId = 'svs5011' | 'svs5147' | 'svs5148' | 'svs5153' | 'svs5154';
export type BlendMode = 'normal' | 'screen' | 'add' | 'multiply' | 'overlay' | 'difference';

export interface LayerConfig {
  id: DatasetId;
  enabled: boolean;
  opacity: number;
  blendMode: BlendMode;
}

export const BLEND_MODE_OPTIONS: { value: BlendMode; labelPt: string }[] = [
  { value: 'normal', labelPt: 'Normal (Alpha)' },
  { value: 'screen', labelPt: 'Screen (Clarear)' },
  { value: 'add', labelPt: 'Add (Soma/Brilho)' },
  { value: 'multiply', labelPt: 'Multiply (Multiplicar)' },
  { value: 'overlay', labelPt: 'Overlay (Contraste)' },
  { value: 'difference', labelPt: 'Difference (Diferença)' },
];

export const DEFAULT_LAYER_STACK: LayerConfig[] = [
  { id: 'svs5148', enabled: true, opacity: 0.94, blendMode: 'normal' },
  { id: 'svs5147', enabled: false, opacity: 0.72, blendMode: 'overlay' },
  { id: 'svs5153', enabled: true, opacity: 0.56, blendMode: 'screen' },
  { id: 'svs5154', enabled: false, opacity: 0.75, blendMode: 'screen' },
  { id: 'svs5011', enabled: true, opacity: 0.92, blendMode: 'add' },
];

export interface NasaDatasetMeta {
  id: DatasetId;
  svsId: string;
  shortName: string;
  title: string;
  subtitle: string;
  videoUrl: string;
  resolution: string;
  aspect: string;
  fpsEstimate: number;
  durationHintSeconds: number;
  accentCategory: 'lightning' | 'temperature' | 'wind' | 'co' | 'nox';
  colorbarUrl?: string;
  colorbarCaption?: string;
  descriptionPt: string;
  scientificNotesPt: string;
  credit: string;
  sourceUrl: string;
}

export const DATASET_ORDER: DatasetId[] = [
  'svs5011',
  'svs5147',
  'svs5148',
  'svs5153',
  'svs5154',
];

export const NASA_DATASETS: Record<DatasetId, NasaDatasetMeta> = {
  svs5011: {
    id: 'svs5011',
    svsId: 'SVS 5011',
    shortName: 'Raios ISS (LIS)',
    title: 'Lightning Events Detected from the ISS (2017–2023)',
    subtitle: '4096×2048 • 2017–2023 (SOS)',
    videoUrl: '/nasa/svs5011_lightning_sos_4096x2048.mp4',
    resolution: '4096 × 2048',
    aspect: '2:1 Equiretangular Global',
    fpsEstimate: 60,
    durationHintSeconds: 100.034,
    accentCategory: 'lightning',
    descriptionPt:
      'Eventos globais de raios detectados pelo sensor Lightning Imaging Sensor (LIS) a bordo da Estação Espacial Internacional (ISS) entre 2017 e julho de 2023, usando janela móvel de 10 dias.',
    scientificNotesPt:
      'Cobertura nas regiões tropicais e de latitudes médias (~±55°), permitindo observar padrões sazonais de tempestades sobre continentes como Amazônia, África Central e Sudeste Asiático.',
    credit: "NASA's Scientific Visualization Studio / Richard J. Blakeslee (GHRC DAAC)",
    sourceUrl: 'https://svs.gsfc.nasa.gov/5011/',
  },
  svs5147: {
    id: 'svs5147',
    svsId: 'SVS 5147',
    shortName: 'Temperatura (GEOS-FP)',
    title: 'GEOS-FP Near-Surface Temperature',
    subtitle: '2048×1024 • 3 m superfície',
    videoUrl: '/nasa/svs5147_temp_2048x1024.mp4',
    resolution: '2048 × 1024',
    aspect: '2:1 Equiretangular Global',
    fpsEstimate: 30,
    durationHintSeconds: 31,
    accentCategory: 'temperature',
    colorbarUrl: '/nasa/NearSurfaceTemperature_colorbar.png',
    colorbarCaption: 'Temperatura próximo à superfície (3 m — GEOS-FP)',
    descriptionPt:
      'Temperatura do ar calculada a 3 metros acima da superfície terrestre pelo sistema GEOS-FP da NASA (GMAO), integrando observações de satélites, aeronaves, balões e estações de solo.',
    scientificNotesPt:
      'Permite acompanhar o ciclo térmico diurno sobre os continentes, massas de ar polar, frentes frias e contrastes entre oceanos e áreas continentais.',
    credit: "NASA's Global Modeling and Assimilation Office (GMAO) / Joseph V. Ardizzone",
    sourceUrl: 'https://svs.gsfc.nasa.gov/5147/',
  },
  svs5148: {
    id: 'svs5148',
    svsId: 'SVS 5148',
    shortName: 'Ventos GEOS-FP (10m)',
    title: 'GEOS-FP Near-Surface Wind Speed',
    subtitle: '2048×1024 • 10 m superfície',
    videoUrl: '/nasa/svs5148_wind_2048x1024.mp4',
    resolution: '2048 × 1024',
    aspect: '2:1 Equiretangular Global',
    fpsEstimate: 30,
    durationHintSeconds: 31,
    accentCategory: 'wind',
    colorbarUrl: '/nasa/NearSurfaceWindSpeed_colorbar.png',
    colorbarCaption: 'Velocidade do vento a 10 m acima da superfície (GEOS-FP)',
    descriptionPt:
      'Velocidade do vento próximo à superfície (10 metros de altitude) simulada pelo sistema GEOS-FP da NASA (GMAO), integrando observações de satélites, balões e estações.',
    scientificNotesPt:
      'Os ventos mais intensos aparecem sobre os oceanos (menor atrito) e em frentes e ciclones. Sobre o continente, o relevo e a rugosidade reduzem a velocidade média.',
    credit: "NASA's Global Modeling and Assimilation Office (GMAO) / Joseph V. Ardizzone",
    sourceUrl: 'https://svs.gsfc.nasa.gov/5148/',
  },
  svs5153: {
    id: 'svs5153',
    svsId: 'SVS 5153',
    shortName: 'Monóxido de Carbono (CO)',
    title: 'Carbon Monoxide (CO) — GEOS-CF',
    subtitle: '2048×1024 • Qualidade do Ar',
    videoUrl: '/nasa/svs5153_co_2048x1024.mp4',
    resolution: '2048 × 1024',
    aspect: '2:1 Equiretangular Global',
    fpsEstimate: 30,
    durationHintSeconds: 31,
    accentCategory: 'co',
    colorbarUrl: '/nasa/CO_colorbar.png',
    colorbarCaption: 'Concentração de Monóxido de Carbono (CO) próximo à superfície',
    descriptionPt:
      'Concentração de monóxido de carbono (CO) próximo à superfície estimada pelo modelo NASA GEOS-CF (Composition Forecasting), combinando meteorologia, emissões e transporte químico.',
    scientificNotesPt:
      'Plumas de CO revelam grandes focos de queimadas, incêndios florestais e emissões urbanas/industriais sendo transportadas pelos ventos através de continentes e oceanos.',
    credit: "NASA's Global Modeling and Assimilation Office (GMAO) / GEOS-CF",
    sourceUrl: 'https://svs.gsfc.nasa.gov/5153/',
  },
  svs5154: {
    id: 'svs5154',
    svsId: 'SVS 5154',
    shortName: 'Óxidos de Nitrogênio (NOx)',
    title: 'Nitrogen Oxides (NOx) — GEOS-CF',
    subtitle: '2048×1024 • Poluição Urbana/Industrial',
    videoUrl: '/nasa/svs5154_nox_2048x1024.mp4',
    resolution: '2048 × 1024',
    aspect: '2:1 Equiretangular Global',
    fpsEstimate: 30,
    durationHintSeconds: 31,
    accentCategory: 'nox',
    colorbarUrl: '/nasa/NOx_colorbar.png',
    colorbarCaption: 'Concentração de Óxidos de Nitrogênio (NOx) próximo à superfície',
    descriptionPt:
      'Concentração de óxidos de nitrogênio (NO + NO2) próximo à superfície estimada pelo sistema NASA GEOS-CF, refletindo fontes de combustão, tráfego e atividade industrial.',
    scientificNotesPt:
      'Por ter vida atmosférica mais curta que o CO, o NOx destaca com nitidez corredores urbanos, rotas marítimas e centros industriais em cada país.',
    credit: "NASA's Global Modeling and Assimilation Office (GMAO) / GEOS-CF",
    sourceUrl: 'https://svs.gsfc.nasa.gov/5154/',
  },
};

export interface QuickPreset {
  id: string;
  label: string;
  lon: number;
  lat: number;
  distance: number;
}

export const QUICK_PRESETS: QuickPreset[] = [
  { id: 'global', label: 'Globo Completo', lon: -20, lat: 8, distance: 2.98 },
  { id: 'brazil', label: 'Brasil', lon: -51.9, lat: -14.2, distance: 1.78 },
  { id: 'amazon', label: 'Amazônia', lon: -62.5, lat: -3.5, distance: 1.48 },
  { id: 'usa', label: 'EUA', lon: -98.5, lat: 39.5, distance: 1.82 },
  { id: 'europe', label: 'Europa', lon: 10.0, lat: 49.0, distance: 1.62 },
  { id: 'eastasia', label: 'Ásia Oriental', lon: 114.0, lat: 32.0, distance: 1.72 },
];
