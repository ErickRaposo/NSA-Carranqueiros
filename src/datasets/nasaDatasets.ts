export type DatasetId = 'svs5011' | 'svs5147' | 'svs5148' | 'svs5153' | 'svs5154';
export type BlendMode = 'normal' | 'screen' | 'add' | 'multiply' | 'overlay' | 'difference';

export interface LayerConfig {
  id: DatasetId;
  enabled: boolean;
  opacity: number;
  blendMode: BlendMode;
}

export const BLEND_MODE_OPTIONS: { value: BlendMode; labelPt: string; labelEn: string }[] = [
  { value: 'normal', labelPt: 'Normal (Alpha)', labelEn: 'Normal (Alpha)' },
  { value: 'screen', labelPt: 'Screen (Clarear)', labelEn: 'Screen (Lighten)' },
  { value: 'add', labelPt: 'Add (Soma/Brilho)', labelEn: 'Add (Glow)' },
  { value: 'multiply', labelPt: 'Multiply (Multiplicar)', labelEn: 'Multiply' },
  { value: 'overlay', labelPt: 'Overlay (Contraste)', labelEn: 'Overlay (Contrast)' },
  { value: 'difference', labelPt: 'Difference (Diferença)', labelEn: 'Difference' },
];

export const DEFAULT_LAYER_STACK: LayerConfig[] = [
  { id: 'svs5011', enabled: true, opacity: 1.0, blendMode: 'normal' },
  { id: 'svs5148', enabled: false, opacity: 0.78, blendMode: 'screen' },
  { id: 'svs5147', enabled: false, opacity: 0.72, blendMode: 'overlay' },
  { id: 'svs5153', enabled: false, opacity: 0.68, blendMode: 'screen' },
  { id: 'svs5154', enabled: false, opacity: 0.78, blendMode: 'add' },
];

export function resolveAssetUrl(relativePath: string): string {
  const env =
    typeof import.meta !== 'undefined'
      ? ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {})
      : {};
  const rawBase = env.VITE_ASSETS_BASE_URL || env.BASE_URL || '';
  const cleanBase = rawBase.replace(/\/+$/, '');
  const cleanPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return cleanBase ? `${cleanBase}${cleanPath}` : cleanPath;
}

export interface NasaDatasetMeta {
  id: DatasetId;
  svsId: string;
  shortName: string;
  shortNameEn: string;
  title: string;
  subtitle: string;
  sensorLabel: string;
  sensorLabelEn: string;
  videoUrl: string;
  resolution: string;
  aspect: string;
  fpsEstimate: number;
  durationHintSeconds: number;
  accentCategory: 'lightning' | 'temperature' | 'wind' | 'co' | 'nox';
  representationType: 'colorbar' | 'discrete_events';
  colorbarUrl?: string;
  colorbarCaption: string;
  colorbarCaptionEn: string;
  scaleMinLabel: string;
  scaleMinLabelEn: string;
  scaleMaxLabel: string;
  scaleMaxLabelEn: string;
  unitLabel: string;
  unitLabelEn: string;
  howToReadPt: string;
  howToReadEn: string;
  descriptionPt: string;
  descriptionEn: string;
  scientificNotesPt: string;
  scientificNotesEn: string;
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
    shortNameEn: 'ISS Lightning (LIS)',
    title: 'Lightning Events Detected from the ISS (2017–2023)',
    subtitle: '4096×2048 • 2017–2023 (SOS)',
    sensorLabel: 'ISS · Sensor Óptico LIS',
    sensorLabelEn: 'ISS · Optical LIS Sensor',
    videoUrl: '/nasa/svs5011_lightning_sos_4096x2048.mp4',
    resolution: '4096 × 2048',
    aspect: '2:1 Equiretangular Global',
    fpsEstimate: 60,
    durationHintSeconds: 100.034,
    accentCategory: 'lightning',
    representationType: 'discrete_events',
    colorbarCaption:
      'Mapa de eventos ópticos discretos detectados pelo sensor ISS-LIS (sem escala contínua)',
    colorbarCaptionEn:
      'Discrete optical flash events detected by the ISS-LIS sensor (no continuous scale)',
    scaleMinLabel: 'Fundo escuro: sem registro na janela',
    scaleMinLabelEn: 'Dark base: no flashes recorded in window',
    scaleMaxLabel: 'Ponto amarelo: descarga óptica LIS',
    scaleMaxLabelEn: 'Yellow point: LIS optical lightning flash',
    unitLabel: 'Eventos discretos · Janela de 10 dias',
    unitLabelEn: 'Discrete events · 10-day rolling window',
    howToReadPt:
      'Esta visualização oficial da NASA não possui barra de escala contínua: cada ponto amarelo luminoso representa a ocorrência real de descargas elétricas registradas pelo sensor LIS na ISS dentro da janela móvel de 10 dias (~±55° de latitude).',
    howToReadEn:
      'This official NASA visualization has no continuous colorbar: each bright yellow dot marks real lightning flashes recorded by the ISS LIS sensor within a 10-day rolling window (~±55° latitude).',
    descriptionPt:
      'Observações globais de relâmpagos captadas pelo Lightning Imaging Sensor (LIS) a bordo da Estação Espacial Internacional (ISS) entre 2017 e julho de 2023.',
    descriptionEn:
      'Global lightning observations captured by the Lightning Imaging Sensor (LIS) aboard the International Space Station (ISS) from 2017 to July 2023.',
    scientificNotesPt:
      'Cobertura na faixa orbital da ISS (~±55°), revelando a migração sazonal de tempestades sobre bacias continentais como Amazônia, Bacia do Congo e Sudeste Asiático.',
    scientificNotesEn:
      'Covers the ISS orbital band (~±55°), revealing seasonal thunderstorm migration across the Amazon, Congo Basin, and Southeast Asia.',
    credit: "NASA's Scientific Visualization Studio / Richard J. Blakeslee (GHRC DAAC)",
    sourceUrl: 'https://svs.gsfc.nasa.gov/5011/',
  },
  svs5147: {
    id: 'svs5147',
    svsId: 'SVS 5147',
    shortName: 'Temperatura (GEOS-FP · T2M)',
    shortNameEn: 'Temperature (GEOS-FP · T2M)',
    title: 'GEOS-FP Near-Surface Temperature (T2M)',
    subtitle: '2048×1024 • 2 m superfície (T2M)',
    sensorLabel: 'NASA GMAO · Modelo GEOS-FP',
    sensorLabelEn: 'NASA GMAO · GEOS-FP Model',
    videoUrl: '/nasa/svs5147_temp_2048x1024.mp4',
    resolution: '2048 × 1024',
    aspect: '2:1 Equiretangular Global',
    fpsEstimate: 30,
    durationHintSeconds: 31,
    accentCategory: 'temperature',
    representationType: 'colorbar',
    colorbarUrl: '/nasa/NearSurfaceTemperature_colorbar.png',
    colorbarCaption: 'Temperatura do ar próximo à superfície (T2M — de -40 °C a +40 °C)',
    colorbarCaptionEn: 'Near-surface air temperature (T2M — from -40 °C to +40 °C)',
    scaleMinLabel: '-40 °C (Muito frio)',
    scaleMinLabelEn: '-40 °C (Extreme cold)',
    scaleMaxLabel: '+40 °C (Muito quente)',
    scaleMaxLabelEn: '+40 °C (Extreme heat)',
    unitLabel: 'Graus Celsius (°C · T2M)',
    unitLabelEn: 'Degrees Celsius (°C · T2M)',
    howToReadPt:
      'Azul-ardósia, branco-gelo (-25 °C), violeta (-20 °C) e azul (-10 °C) marcam ar abaixo de zero; ciano indica o ponto de congelamento (0 °C); amarelo (+10 °C), laranja/vermelho (+20 °C) e marrom/cinza (+30 a +40 °C) revelam calor intenso.',
    howToReadEn:
      'Slate blue, ice white (-25 °C), violet (-20 °C), and blue (-10 °C) mark sub-freezing air; cyan marks freezing (0 °C); yellow (+10 °C), orange/red (+20 °C), and dark red/grey (+30 to +40 °C) reveal intense heat.',
    descriptionPt:
      'Temperatura do ar próximo à superfície (T2M) simulada pelo sistema GEOS-FP da NASA (GMAO), assimilando observações de satélites, radiossondas, aeronaves e estações meteorológicas.',
    descriptionEn:
      'Near-surface air temperature (T2M) simulated by NASA GMAO GEOS-FP, assimilating satellite, radiosonde, aircraft, and surface weather station observations.',
    scientificNotesPt:
      'Permite observar o ciclo térmico diurno sobre os continentes, frentes polares, ponto de congelamento (0 °C) e contrastes térmicos terra-oceano.',
    scientificNotesEn:
      'Highlights diurnal continental heating cycles, polar fronts, the 0 °C freezing line, and land-ocean thermal contrasts.',
    credit: "NASA's Global Modeling and Assimilation Office (GMAO) / Joseph V. Ardizzone",
    sourceUrl: 'https://svs.gsfc.nasa.gov/5147/',
  },
  svs5148: {
    id: 'svs5148',
    svsId: 'SVS 5148',
    shortName: 'Ventos GEOS-FP (10 m)',
    shortNameEn: 'Surface Winds GEOS-FP (10 m)',
    title: 'GEOS-FP Near-Surface Wind Speed',
    subtitle: '2048×1024 • 10 m superfície',
    sensorLabel: 'NASA GMAO · Modelo GEOS-FP',
    sensorLabelEn: 'NASA GMAO · GEOS-FP Model',
    videoUrl: '/nasa/svs5148_wind_2048x1024.mp4',
    resolution: '2048 × 1024',
    aspect: '2:1 Equiretangular Global',
    fpsEstimate: 30,
    durationHintSeconds: 31,
    accentCategory: 'wind',
    representationType: 'colorbar',
    colorbarUrl: '/nasa/NearSurfaceWindSpeed_colorbar.png',
    colorbarCaption: 'Velocidade do vento próximo à superfície (0 a 40 m/s — GEOS-FP)',
    colorbarCaptionEn: 'Near-surface wind speed (0 to 40 m/s — GEOS-FP)',
    scaleMinLabel: '0 m/s (Calmo)',
    scaleMinLabelEn: '0 m/s (Calm)',
    scaleMaxLabel: '40 m/s (Força de furacão)',
    scaleMaxLabelEn: '40 m/s (Hurricane force)',
    unitLabel: 'Metros por segundo (m/s)',
    unitLabelEn: 'Meters per second (m/s)',
    howToReadPt:
      'Preto sobre oceanos (e cinza-claro sobre continentes) indica calmaria (0–4 m/s); azul e ciano marcam brisas de 5–12 m/s; amarelo e vermelho indicam ventos fortes (~20 m/s); marrom-escuro e cinza apontam ciclones (30–40 m/s).',
    howToReadEn:
      'Black over oceans (and light grey over land) indicates calm air (0–4 m/s); blue and cyan mark breezes (5–12 m/s); yellow and red show strong winds (~20 m/s); maroon and grey pinpoint cyclones (30–40 m/s).',
    descriptionPt:
      'Velocidade do vento a 10 metros acima da superfície modelada pelo sistema GEOS-FP da NASA (GMAO) a partir de assimilação global de dados atmosféricos.',
    descriptionEn:
      'Wind speed 10 meters above the surface modeled by NASA GMAO GEOS-FP using global atmospheric data assimilation.',
    scientificNotesPt:
      'Os ventos mais velozes concentram-se sobre os oceanos (menor atrito superficial), nos ventos de oeste subantárticos e em ciclones tropicais e extratropicais.',
    scientificNotesEn:
      'Fastest winds concentrate over open oceans (lower surface friction), sub-Antarctic westerlies, and tropical/extratropical cyclones.',
    credit: "NASA's Global Modeling and Assimilation Office (GMAO) / Joseph V. Ardizzone",
    sourceUrl: 'https://svs.gsfc.nasa.gov/5148/',
  },
  svs5153: {
    id: 'svs5153',
    svsId: 'SVS 5153',
    shortName: 'Monóxido de Carbono (CO)',
    shortNameEn: 'Carbon Monoxide (CO)',
    title: 'Carbon Monoxide (CO) — GEOS-CF',
    subtitle: '2048×1024 • Química Atmosférica',
    sensorLabel: 'NASA GMAO · Química GEOS-CF',
    sensorLabelEn: 'NASA GMAO · GEOS-CF Chemistry',
    videoUrl: '/nasa/svs5153_co_2048x1024.mp4',
    resolution: '2048 × 1024',
    aspect: '2:1 Equiretangular Global',
    fpsEstimate: 30,
    durationHintSeconds: 31,
    accentCategory: 'co',
    representationType: 'colorbar',
    colorbarUrl: '/nasa/CO_colorbar.png',
    colorbarCaption: 'Concentração de Monóxido de Carbono próximo à superfície (40 a 500 ppbv)',
    colorbarCaptionEn: 'Near-surface Carbon Monoxide concentration (40 to 500 ppbv)',
    scaleMinLabel: '40 ppbv (Claro · Baixo)',
    scaleMinLabelEn: '40 ppbv (Pale · Low)',
    scaleMaxLabel: '500 ppbv (Vinho · Alto)',
    scaleMaxLabelEn: '500 ppbv (Maroon · High)',
    unitLabel: 'Partes por bilhão em volume (ppbv)',
    unitLabelEn: 'Parts per billion by volume (ppbv)',
    howToReadPt:
      'Amarelo-claro/creme (40 ppbv) indica ar limpo de fundo; laranja (100 ppbv) e vermelho vivo (130–200 ppbv) mostram concentração moderada a alta; vermelho-vinho escuro (500 ppbv) destaca plumas densas de queimadas e combustão.',
    howToReadEn:
      'Pale cream-yellow (40 ppbv) indicates clean background air; orange (100 ppbv) and bright red (130–200 ppbv) show moderate-to-high levels; dark maroon (500 ppbv) highlights dense wildfire and combustion plumes.',
    descriptionPt:
      'Concentração de monóxido de carbono (CO) próximo à superfície estimada pelo modelo químico-meteorológico NASA GEOS-CF (Composition Forecasting).',
    descriptionEn:
      'Near-surface carbon monoxide (CO) concentration estimated by the NASA GEOS-CF (Composition Forecasting) chemistry-meteorology model.',
    scientificNotesPt:
      'Como o CO permanece semanas na atmosfera, suas plumas vermelhas revelam o transporte intercontinental da fumaça de incêndios florestais e emissões urbano-industriais.',
    scientificNotesEn:
      'Because CO persists for weeks in the atmosphere, its red plumes trace intercontinental smoke transport from wildfires and urban-industrial emissions.',
    credit: "NASA's Global Modeling and Assimilation Office (GMAO) / GEOS-CF",
    sourceUrl: 'https://svs.gsfc.nasa.gov/5153/',
  },
  svs5154: {
    id: 'svs5154',
    svsId: 'SVS 5154',
    shortName: 'Óxidos de Nitrogênio (NO₂)',
    shortNameEn: 'Nitrogen Oxides (NO₂)',
    title: 'Nitrogen Oxides (NOx) — GEOS-CF',
    subtitle: '2048×1024 • Emissões Urbanas/Industriais',
    sensorLabel: 'NASA GMAO · Química GEOS-CF',
    sensorLabelEn: 'NASA GMAO · GEOS-CF Chemistry',
    videoUrl: '/nasa/svs5154_nox_2048x1024.mp4',
    resolution: '2048 × 1024',
    aspect: '2:1 Equiretangular Global',
    fpsEstimate: 30,
    durationHintSeconds: 31,
    accentCategory: 'nox',
    representationType: 'colorbar',
    colorbarUrl: '/nasa/NOx_colorbar.png',
    colorbarCaption: 'Concentração logarítmica de NOx próximo à superfície (10⁻³ a 10¹+ ppbv)',
    colorbarCaptionEn: 'Logarithmic near-surface NOx concentration (10⁻³ to 10¹+ ppbv)',
    scaleMinLabel: '10⁻³ ppbv (Branco · Baixo)',
    scaleMinLabelEn: '10⁻³ ppbv (White · Low)',
    scaleMaxLabel: '10¹+ ppbv (Verde-escuro · Alto)',
    scaleMaxLabelEn: '10¹+ ppbv (Dark green · High)',
    unitLabel: 'Escala logarítmica (10⁻³ a 10¹ ppbv)',
    unitLabelEn: 'Logarithmic scale (10⁻³ to 10¹ ppbv)',
    howToReadPt:
      'Atenção à direção da escala: branco e verde-menta claro (10⁻³ a 10⁻² ppbv) indicam ar oceânico limpo (baixo); verde médio (10⁻¹ ppbv) mostra fundo continental; manchas verde-floresta escuras (1 a 10+ ppbv) marcam alta concentração em metrópoles, polos industriais e rotas navais.',
    howToReadEn:
      'Note the scale direction: white and pale mint (10⁻³ to 10⁻² ppbv) indicate clean ocean air (low); medium green (10⁻¹ ppbv) shows continental background; dark forest green spots (1 to 10+ ppbv) mark high concentrations over metropolises, industrial hubs, and shipping lanes.',
    descriptionPt:
      'Concentração de óxidos de nitrogênio (NO + NO2) próximo à superfície estimada pelo sistema NASA GEOS-CF, refletindo combustão veicular, termelétricas, indústria e navios.',
    descriptionEn:
      'Near-surface nitrogen oxides (NO + NO2) concentration estimated by NASA GEOS-CF, reflecting vehicular traffic, power plants, industry, and shipping lanes.',
    scientificNotesPt:
      'Por ter vida química curta (horas) na baixa troposfera, o NOx concentra-se próximo às fontes emissoras, delineando com precisão grandes áreas metropolitanas.',
    scientificNotesEn:
      'Due to its short chemical lifetime (hours) in the lower troposphere, NOx stays tightly clustered around emission sources, outlining major metropolitan areas.',
    credit: "NASA's Global Modeling and Assimilation Office (GMAO) / GEOS-CF",
    sourceUrl: 'https://svs.gsfc.nasa.gov/5154/',
  },
};

export interface QuickPreset {
  id: string;
  label: string;
  labelEn: string;
  lon: number;
  lat: number;
  distance: number;
}

export const QUICK_PRESETS: QuickPreset[] = [
  { id: 'global', label: 'Globo Completo', labelEn: 'Full Globe', lon: -55, lat: 8, distance: 2.98 },
  { id: 'brazil', label: 'Brasil', labelEn: 'Brazil', lon: -51.9, lat: -14.2, distance: 1.78 },
  { id: 'usa', label: 'Estados Unidos', labelEn: 'United States', lon: -98.5, lat: 39.5, distance: 1.82 },
  { id: 'mexico', label: 'México', labelEn: 'Mexico', lon: -102.5, lat: 23.6, distance: 1.62 },
];
