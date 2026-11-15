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
  { id: 'svs5011', enabled: true, opacity: 1.0, blendMode: 'normal' },
  { id: 'svs5148', enabled: false, opacity: 0.78, blendMode: 'screen' },
  { id: 'svs5147', enabled: false, opacity: 0.72, blendMode: 'overlay' },
  { id: 'svs5153', enabled: false, opacity: 0.68, blendMode: 'screen' },
  { id: 'svs5154', enabled: false, opacity: 0.78, blendMode: 'add' },
];

export interface NasaDatasetMeta {
  id: DatasetId;
  svsId: string;
  shortName: string;
  title: string;
  subtitle: string;
  sensorLabel: string;
  videoUrl: string;
  resolution: string;
  aspect: string;
  fpsEstimate: number;
  durationHintSeconds: number;
  accentCategory: 'lightning' | 'temperature' | 'wind' | 'co' | 'nox';
  representationType: 'colorbar' | 'discrete_events';
  colorbarUrl?: string;
  colorbarCaption: string;
  scaleMinLabel: string;
  scaleMaxLabel: string;
  unitLabel: string;
  howToReadPt: string;
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
    sensorLabel: 'ISS · Sensor Óptico LIS',
    videoUrl: '/nasa/svs5011_lightning_sos_4096x2048.mp4',
    resolution: '4096 × 2048',
    aspect: '2:1 Equiretangular Global',
    fpsEstimate: 60,
    durationHintSeconds: 100.034,
    accentCategory: 'lightning',
    representationType: 'discrete_events',
    colorbarCaption: 'Mapa de eventos ópticos discretos detectados pelo sensor ISS-LIS (sem escala contínua)',
    scaleMinLabel: 'Fundo escuro: sem registro na janela',
    scaleMaxLabel: 'Ponto amarelo: descarga óptica LIS',
    unitLabel: 'Eventos discretos · Janela de 10 dias',
    howToReadPt:
      'Esta visualização oficial da NASA não possui barra de escala contínua: cada ponto amarelo luminoso representa a ocorrência real de descargas elétricas registradas pelo sensor LIS na ISS dentro da janela móvel de 10 dias (~±55° de latitude).',
    descriptionPt:
      'Observações globais de relâmpagos captadas pelo Lightning Imaging Sensor (LIS) a bordo da Estação Espacial Internacional (ISS) entre 2017 e julho de 2023.',
    scientificNotesPt:
      'Cobertura na faixa orbital da ISS (~±55°), revelando a migração sazonal de tempestades sobre bacias continentais como Amazônia, Bacia do Congo e Sudeste Asiático.',
    credit: "NASA's Scientific Visualization Studio / Richard J. Blakeslee (GHRC DAAC)",
    sourceUrl: 'https://svs.gsfc.nasa.gov/5011/',
  },
  svs5147: {
    id: 'svs5147',
    svsId: 'SVS 5147',
    shortName: 'Temperatura (GEOS-FP · T2M)',
    title: 'GEOS-FP Near-Surface Temperature (T2M)',
    subtitle: '2048×1024 • 2 m superfície (T2M)',
    sensorLabel: 'NASA GMAO · Modelo GEOS-FP',
    videoUrl: '/nasa/svs5147_temp_2048x1024.mp4',
    resolution: '2048 × 1024',
    aspect: '2:1 Equiretangular Global',
    fpsEstimate: 30,
    durationHintSeconds: 31,
    accentCategory: 'temperature',
    representationType: 'colorbar',
    colorbarUrl: '/nasa/NearSurfaceTemperature_colorbar.png',
    colorbarCaption: 'Temperatura do ar próximo à superfície (T2M — de -40 °C a +40 °C)',
    scaleMinLabel: '-40 °C (Muito frio)',
    scaleMaxLabel: '+40 °C (Muito quente)',
    unitLabel: 'Graus Celsius (°C · T2M)',
    howToReadPt:
      'Azul-ardósia, branco-gelo (-25 °C), violeta (-20 °C) e azul (-10 °C) marcam ar abaixo de zero; ciano indica o ponto de congelamento (0 °C); amarelo (+10 °C), laranja/vermelho (+20 °C) e marrom/cinza (+30 a +40 °C) revelam calor intenso.',
    descriptionPt:
      'Temperatura do ar próximo à superfície (T2M) simulada pelo sistema GEOS-FP da NASA (GMAO), assimilando observações de satélites, radiossondas, aeronaves e estações meteorológicas.',
    scientificNotesPt:
      'Permite observar o ciclo térmico diurno sobre os continentes, frentes polares, ponto de congelamento (0 °C) e contrastes térmicos terra-oceano.',
    credit: "NASA's Global Modeling and Assimilation Office (GMAO) / Joseph V. Ardizzone",
    sourceUrl: 'https://svs.gsfc.nasa.gov/5147/',
  },
  svs5148: {
    id: 'svs5148',
    svsId: 'SVS 5148',
    shortName: 'Ventos GEOS-FP (10 m)',
    title: 'GEOS-FP Near-Surface Wind Speed',
    subtitle: '2048×1024 • 10 m superfície',
    sensorLabel: 'NASA GMAO · Modelo GEOS-FP',
    videoUrl: '/nasa/svs5148_wind_2048x1024.mp4',
    resolution: '2048 × 1024',
    aspect: '2:1 Equiretangular Global',
    fpsEstimate: 30,
    durationHintSeconds: 31,
    accentCategory: 'wind',
    representationType: 'colorbar',
    colorbarUrl: '/nasa/NearSurfaceWindSpeed_colorbar.png',
    colorbarCaption: 'Velocidade do vento próximo à superfície (0 a 40 m/s — GEOS-FP)',
    scaleMinLabel: '0 m/s (Calmo)',
    scaleMaxLabel: '40 m/s (Força de furacão)',
    unitLabel: 'Metros por segundo (m/s)',
    howToReadPt:
      'Preto sobre oceanos (e cinza-claro sobre continentes) indica calmaria (0–4 m/s); azul e ciano marcam brisas de 5–12 m/s; amarelo e vermelho indicam ventos fortes (~20 m/s); marrom-escuro e cinza apontam ciclones (30–40 m/s).',
    descriptionPt:
      'Velocidade do vento a 10 metros acima da superfície modelada pelo sistema GEOS-FP da NASA (GMAO) a partir de assimilação global de dados atmosféricos.',
    scientificNotesPt:
      'Os ventos mais velozes concentram-se sobre os oceanos (menor atrito superficial), nos ventos de oeste subantárticos e em ciclones tropicais e extratropicais.',
    credit: "NASA's Global Modeling and Assimilation Office (GMAO) / Joseph V. Ardizzone",
    sourceUrl: 'https://svs.gsfc.nasa.gov/5148/',
  },
  svs5153: {
    id: 'svs5153',
    svsId: 'SVS 5153',
    shortName: 'Monóxido de Carbono (CO)',
    title: 'Carbon Monoxide (CO) — GEOS-CF',
    subtitle: '2048×1024 • Química Atmosférica',
    sensorLabel: 'NASA GMAO · Química GEOS-CF',
    videoUrl: '/nasa/svs5153_co_2048x1024.mp4',
    resolution: '2048 × 1024',
    aspect: '2:1 Equiretangular Global',
    fpsEstimate: 30,
    durationHintSeconds: 31,
    accentCategory: 'co',
    representationType: 'colorbar',
    colorbarUrl: '/nasa/CO_colorbar.png',
    colorbarCaption: 'Concentração de Monóxido de Carbono próximo à superfície (40 a 500 ppbv)',
    scaleMinLabel: '40 ppbv (Claro · Baixo)',
    scaleMaxLabel: '500 ppbv (Vinho · Alto)',
    unitLabel: 'Partes por bilhão em volume (ppbv)',
    howToReadPt:
      'Amarelo-claro/creme (40 ppbv) indica ar limpo de fundo; laranja (100 ppbv) e vermelho vivo (130–200 ppbv) mostram concentração moderada a alta; vermelho-vinho escuro (500 ppbv) destaca plumas densas de queimadas e combustão.',
    descriptionPt:
      'Concentração de monóxido de carbono (CO) próximo à superfície estimada pelo modelo químico-meteorológico NASA GEOS-CF (Composition Forecasting).',
    scientificNotesPt:
      'Como o CO permanece semanas na atmosfera, suas plumas vermelhas revelam o transporte intercontinental da fumaça de incêndios florestais e emissões urbano-industriais.',
    credit: "NASA's Global Modeling and Assimilation Office (GMAO) / GEOS-CF",
    sourceUrl: 'https://svs.gsfc.nasa.gov/5153/',
  },
  svs5154: {
    id: 'svs5154',
    svsId: 'SVS 5154',
    shortName: 'Óxidos de Nitrogênio (NOx)',
    title: 'Nitrogen Oxides (NOx) — GEOS-CF',
    subtitle: '2048×1024 • Emissões Urbanas/Industriais',
    sensorLabel: 'NASA GMAO · Química GEOS-CF',
    videoUrl: '/nasa/svs5154_nox_2048x1024.mp4',
    resolution: '2048 × 1024',
    aspect: '2:1 Equiretangular Global',
    fpsEstimate: 30,
    durationHintSeconds: 31,
    accentCategory: 'nox',
    representationType: 'colorbar',
    colorbarUrl: '/nasa/NOx_colorbar.png',
    colorbarCaption: 'Concentração logarítmica de NOx próximo à superfície (10⁻³ a 10¹+ ppbv)',
    scaleMinLabel: '10⁻³ ppbv (Branco · Baixo)',
    scaleMaxLabel: '10¹+ ppbv (Verde-escuro · Alto)',
    unitLabel: 'Escala logarítmica (10⁻³ a 10¹ ppbv)',
    howToReadPt:
      'Atenção à direção da escala: branco e verde-menta claro (10⁻³ a 10⁻² ppbv) indicam ar oceânico limpo (baixo); verde médio (10⁻¹ ppbv) mostra fundo continental; manchas verde-floresta escuras (1 a 10+ ppbv) marcam alta concentração em metrópoles, polos industriais e rotas navais.',
    descriptionPt:
      'Concentração de óxidos de nitrogênio (NO + NO2) próximo à superfície estimada pelo sistema NASA GEOS-CF, refletindo combustão veicular, termelétricas, indústria e navios.',
    scientificNotesPt:
      'Por ter vida química curta (horas) na baixa troposfera, o NOx concentra-se próximo às fontes emissoras, delineando com precisão grandes áreas metropolitanas.',
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
