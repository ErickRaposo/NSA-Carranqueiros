import { CountryEntry } from './countries';

export interface CountryLogisticsProfile {
  subregionPt: string;
  summaryPt: string;
  maritimePortsPt: string;
  airAndLandCorridorsPt: string;
  climateAndRiskImpactPt: string;
  isCurated: boolean;
}

const CURATED_PROFILES: Record<string, Omit<CountryLogisticsProfile, 'isCurated'>> = {
  Brazil: {
    subregionPt: 'América do Sul • Bacia Atlântica & Amazônica',
    summaryPt:
      'Economia de escala continental conectada por corredores agroindustriais Centro-Oeste/Sudeste, hidrovias amazônicas e extensa faixa litorânea no Atlântico Sul.',
    maritimePortsPt:
      'Principais hubs: Santos (SP), Paranaguá (PR), Itaqui (MA), Suape (PE), Rio Grande (RS) e terminal fluvial de Manaus (AM).',
    airAndLandCorridorsPt:
      'Hubs aéreos em Guarulhos/Viracopos (SP) e Brasília (DF); malha rodoviária predominante (BR-101, BR-116, BR-163) integrada às hidrovias Tapajós/Amazonas.',
    climateAndRiskImpactPt:
      'Alta incidência de raios na Amazônia e Centro-Oeste (SVS 5011) exige proteção em linhas de transmissão e aeroportos; plumas sazonais de CO (SVS 5153) afetam visibilidade e qualidade do ar regional.',
  },
  'United States of America': {
    subregionPt: 'América do Norte • Atlântico, Golfo e Pacífico',
    summaryPt:
      'Rede logística multimodal altamente integrada entre costa Leste, Golfo do México, Meio-Oeste ferroviário e portos da costa Oeste.',
    maritimePortsPt:
      'Portos de Los Angeles/Long Beach (CA), Nova York/Nova Jersey, Houston (TX) e Savannah (GA).',
    airAndLandCorridorsPt:
      'Hubs de carga aérea em Memphis, Louisville e Anchorage; malha interestadual rodoviária e ferroviária Classe I conectando interior aos portos.',
    climateAndRiskImpactPt:
      'Tempestades convectivas e raios no Sudeste/Meio-Oeste (5011), ventos intensos oceânicos (5148) e contraste térmico continental marcado (5147) impactam rotas aéreas e marítimas.',
  },
  Japan: {
    subregionPt: 'Ásia Oriental • Arquipélago do Pacífico',
    summaryPt:
      'Logística insular de alta precisão baseada em cabotagem marítima, trens de carga/alta velocidade e cadeias industriais just-in-time.',
    maritimePortsPt: 'Tóquio, Yokohama, Nagoya, Osaka e Kobe no cinturão industrial do Pacífico.',
    airAndLandCorridorsPt:
      'Aeroportos Narita, Haneda e Kansai integrados por túneis e pontes inter-ilhas (Honshu–Kyushu–Hokkaido).',
    climateAndRiskImpactPt:
      'Exposto a ventos costeiros intensos no Pacífico Noroeste (5148) e concentrações urbanas de NOx (5154) nos corredores metropolitanos.',
  },
  Germany: {
    subregionPt: 'Europa Central • Eixo Reno–Danúbio',
    summaryPt:
      'Principal entroncamento logístico terrestre da União Europeia, ligando o Mar do Norte à Europa Central e Oriental.',
    maritimePortsPt:
      'Hamburgo, Bremerhaven e acesso fluvial direto a Roterdã via Rio Reno.',
    airAndLandCorridorsPt:
      'Hub aéreo de carga em Frankfurt e Leipzig/Halle; extensa malha ferroviária e rodoviária (Autobahn) trans-europeia.',
    climateAndRiskImpactPt:
      'Sistemas frontais atlânticos (5147/5148) e densos corredores de NOx (5154) monitorados para gestão de emissões e mobilidade urbana.',
  },
  France: {
    subregionPt: 'Europa Ocidental • Fachada Atlântica & Mediterrânea',
    summaryPt:
      'Plataforma logística estratégica conectando o Canal da Mancha, Atlântico e bacia do Mediterrâneo.',
    maritimePortsPt: 'Marselha-Fos (Mediterrâneo) e HAROPA / Le Havre–Ruão–Paris (Sena).',
    airAndLandCorridorsPt:
      'Hub de carga Paris–Charles de Gaulle e rede ferroviária/rodoviária radial conectada à Espanha, Alemanha e Reino Unido.',
    climateAndRiskImpactPt:
      'Ventos de oeste do Atlântico Norte (5148) e atividade urbana de NOx (5154) concentrada na região metropolitana de Paris e vale do Ródano.',
  },
  'United Kingdom': {
    subregionPt: 'Europa Noroeste • Ilhas Britânicas',
    summaryPt:
      'Economia insular dependente de conexões marítimas de contêineres, Eurotúnel ferroviário e grandes hubs aéreos.',
    maritimePortsPt: 'Felixstowe, Southampton, London Gateway e Immingham.',
    airAndLandCorridorsPt:
      'Londres Heathrow/East Midlands para carga aérea; ligação terrestre continental via Eurotúnel (Folkestone–Calais).',
    climateAndRiskImpactPt:
      'Forte exposição a ciclones extratropicais e ventos de superfície elevados no Atlântico Norte/Mar do Norte (5148).',
  },
  Portugal: {
    subregionPt: 'Europa Sudoeste • Península Ibérica & Atlântico',
    summaryPt:
      'Porta atlântica da Europa para rotas transoceânicas rumo às Américas e África Ocidental.',
    maritimePortsPt: 'Sines (águas profundas), Leixões (Porto) e Lisboa.',
    airAndLandCorridorsPt:
      'Aeroportos de Lisboa e Porto conectados ao corredor ibérico rodoviário e ferroviário rumo à Espanha.',
    climateAndRiskImpactPt:
      'Ventos atlânticos costeiros (5148), ondas de calor estivais (5147) e episódios sazonais de CO por incêndios florestais (5153).',
  },
  China: {
    subregionPt: 'Ásia Oriental • Litoral do Pacífico & Rota Terrestre',
    summaryPt:
      'Maior polo manufatureiro e portuário global, combinando megaportos costeiros, ferrovias transcontinentais e grandes hidrovias internas.',
    maritimePortsPt: 'Xangai, Ningbo-Zhoushan, Shenzhen, Guangzhou, Qingdao e Tianjin.',
    airAndLandCorridorsPt:
      'Rede ferroviária de alta capacidade e corredores Eurásia; bacia fluvial do Yangtzé e hubs aéreos em Pequim, Xangai e Hong Kong.',
    climateAndRiskImpactPt:
      'Concentrações marcantes de NOx (5154) e CO (5153) nas planícies industriais orientais, além de monções e ventos costeiros no Mar da China.',
  },
  India: {
    subregionPt: 'Ásia Meridional • Subcontinente Indiano',
    summaryPt:
      'Corredor estratégico entre o Oceano Índico, Golfo Pérsico e Sudeste Asiático com forte expansão ferroviária dedicada a cargas.',
    maritimePortsPt: 'Mundra, Nhava Sheva (Mumbai), Chennai e Visakhapatnam.',
    airAndLandCorridorsPt:
      'Corredores dedicados de frete ferroviário (DFC) ligando Delhi–Mumbai–Calcutá e hubs aéreos em Nova Délhi e Mumbai.',
    climateAndRiskImpactPt:
      'Tempestades pré-monção com elevada atividade elétrica (5011), extremos térmicos na planície indo-gangética (5147) e acúmulo sazonal de CO/NOx (5153/5154).',
  },
  Australia: {
    subregionPt: 'Oceania • Continente Australiano',
    summaryPt:
      'Logística orientada à exportação mineral/agrícola de longa distância por ferrovias pesadas e cabotagem entre centros costeiros.',
    maritimePortsPt: 'Port Hedland, Melbourne, Sydney (Port Botany) e Brisbane.',
    airAndLandCorridorsPt:
      'Ferrovias pesadas em Pilbara e eixo transcontinental Sydney–Perth; dependência aérea para regiões remotas do interior.',
    climateAndRiskImpactPt:
      'Ventos oceânicos intensos no Oceano Antártico (5148), extremos de calor no Outback (5147) e plumas de CO em temporadas de incêndios (5153).',
  },
  Argentina: {
    subregionPt: 'América do Sul • Cone Sul & Bacia do Prata',
    summaryPt:
      'Logística agroexportadora centrada na Hidrovia Paraná–Paraguai e eixos bioceânicos rumo ao Pacífico.',
    maritimePortsPt: 'Complexo portuário de Rosário (fluvial), Buenos Aires e Bahía Blanca.',
    airAndLandCorridorsPt:
      'Eixo rodoviário/ferroviário pampeano e passagens andinas (Cristo Redentor) conectando ao Chile.',
    climateAndRiskImpactPt:
      'Frentes frias austrais com ventos fortes na Patagônia e Atlântico Sul (5148) e tempestades convectivas no norte/litoral (5011).',
  },
};

function getClimateBeltPt(lat: number): string {
  const absLat = Math.abs(lat);
  if (absLat < 23.5) return 'Faixa Tropical (alta convecção e umidade)';
  if (absLat < 40) return 'Faixa Subtropical (transição de frentes e massas de ar)';
  if (absLat < 60) return 'Faixa Temperada (forte influência de ventos de oeste e frentes)';
  return 'Faixa Polar / Subpolar (gradientes térmicos acentuados)';
}

export function getCountryLogistics(country: CountryEntry): CountryLogisticsProfile {
  const curated = CURATED_PROFILES[country.nameEn];
  if (curated) {
    return { ...curated, isCurated: true };
  }

  const hasBorders = country.neighborsPt.length > 0;
  const climateBelt = getClimateBeltPt(country.lat);
  const neighborsList = hasBorders
    ? country.neighborsPt.slice(0, 5).join(', ')
    : 'Território insular / sem fronteira terrestre direta mapeada';

  return {
    subregionPt: `${country.regionPt} • ${climateBelt}`,
    summaryPt: `Localizado no hemisfério ${country.hemispherePt} (fuso aproximado ${country.timezoneApprox}), com extensão estimada de ${country.areaApproxKm2.toLocaleString('pt-BR')} km².`,
    maritimePortsPt: hasBorders
      ? 'Acesso logístico combinado por corredores terrestres transfronteiriços e rotas marítimas regionais.'
      : 'Logística predominantemente marítima e aérea devido ao caráter insular/costeiro.',
    airAndLandCorridorsPt: `Conexões diretas com: ${neighborsList}.`,
    climateAndRiskImpactPt:
      'Use os seletores de camadas da NASA (5011, 5147, 5148, 5153, 5154) e a leitura por voz para inspecionar tempestades, ventos, temperatura e plumas atmosféricas em tempo real sobre esta região.',
    isCurated: false,
  };
}
