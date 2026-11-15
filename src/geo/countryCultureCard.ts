import { ExperienceCountry, Lang } from '../experience/types';

export interface CountryCultureCardData {
  countryId: string;
  categoryPt: string;
  categoryEn: string;
  titlePt: string;
  titleEn: string;
  curiosityPt: string;
  curiosityEn: string;
  imageUrl: string;
  author: string;
  license: string;
  sourceName: string;
  referenceUrl: string;
}

const CURATED_COUNTRY_CARDS: Record<string, CountryCultureCardData> = {
  '076': {
    countryId: '076',
    categoryPt: 'Cultura & Patrimônio',
    categoryEn: 'Culture & Landmark',
    titlePt: 'Cristo Redentor · Rio de Janeiro',
    titleEn: 'Christ the Redeemer · Rio de Janeiro',
    curiosityPt:
      'No Brasil, a Amazônia e o Cerrado concentram uma das maiores incidências de raios do planeta — por isso a camada Melodia (SVS 5011) brilha tão forte sobre o país.',
    curiosityEn:
      'Brazil hosts one of the highest lightning densities on Earth across the Amazon and Cerrado, making its Melody layer (SVS 5011) shimmer intensely.',
    imageUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Christ_the_Redeemer_-_Cristo_Redentor.jpg?width=640',
    author: 'Wikimedia Commons Contributor',
    license: 'CC BY-SA 3.0 DE',
    sourceName: 'Wikimedia Commons',
    referenceUrl:
      'https://commons.wikimedia.org/wiki/File:Christ_the_Redeemer_-_Cristo_Redentor.jpg',
  },
  '818': {
    countryId: '818',
    categoryPt: 'História & Paisagem',
    categoryEn: 'History & Landscape',
    titlePt: 'Pirâmides de Gizé · Egito',
    titleEn: 'Great Pyramids of Giza · Egypt',
    curiosityPt:
      'Cercado pelo Saara, o Egito registra temperaturas elevadas que aceleram o BPM da música, enquanto o corredor do rio Nilo concentra os sinais urbanos de NO₂.',
    curiosityEn:
      'Surrounded by the Sahara, Egypt reaches high surface temperatures that speed up the musical BPM, while urban NO₂ signals cluster along the Nile.',
    imageUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/All_Gizah_Pyramids.jpg?width=640',
    author: 'Ricardo Liberato',
    license: 'CC BY-SA 2.0',
    sourceName: 'Wikimedia Commons',
    referenceUrl: 'https://commons.wikimedia.org/wiki/File:All_Gizah_Pyramids.jpg',
  },
  '156': {
    countryId: '156',
    categoryPt: 'Arquitetura & Geografia',
    categoryEn: 'Architecture & Geography',
    titlePt: 'Grande Muralha · Badaling, China',
    titleEn: 'Great Wall · Badaling, China',
    curiosityPt:
      'Com cadeias de montanhas e grandes metrópoles costeiras, a China alterna ventos intensos de altitude (Bus 8D) com acordes densos de monóxido de carbono (CO).',
    curiosityEn:
      'Spanning high mountain ridges and coastal megacities, China blends brisk high-altitude winds (8D Bus) with dense carbon monoxide (CO) harmonic chords.',
    imageUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Badaling_China_Great-Wall-of-China-01.jpg?width=640',
    author: 'Cccefalon',
    license: 'CC BY-SA 3.0',
    sourceName: 'Wikimedia Commons',
    referenceUrl:
      'https://commons.wikimedia.org/wiki/File:Badaling_China_Great-Wall-of-China-01.jpg',
  },
};

const dynamicCardCache = new Map<string, CountryCultureCardData>();

export async function resolveCountryCultureCard(
  country: ExperienceCountry,
  lang: Lang
): Promise<CountryCultureCardData | null> {
  const curated = CURATED_COUNTRY_CARDS[country.id];
  if (curated) return curated;

  const cacheKey = `${country.id}:${lang}`;
  const cached = dynamicCardCache.get(cacheKey);
  if (cached) return cached;

  try {
    const wikiHost = lang === 'pt' ? 'pt.wikipedia.org' : 'en.wikipedia.org';
    const titleQuery = lang === 'pt' ? country.namePt : country.nameEn;
    const url = `https://${wikiHost}/api/rest_v1/page/summary/${encodeURIComponent(titleQuery)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      extract?: string;
      thumbnail?: { source?: string };
      content_urls?: { desktop?: { page?: string } };
    };
    const img = data.thumbnail?.source;
    if (!img) return null;

    const shortExtract = (data.extract ?? '').split('. ').slice(0, 2).join('. ').trim();
    const card: CountryCultureCardData = {
      countryId: country.id,
      categoryPt: 'Lugar & Cultura',
      categoryEn: 'Place & Culture',
      titlePt: data.title ?? country.namePt,
      titleEn: data.title ?? country.nameEn,
      curiosityPt: shortExtract || `${country.namePt} · ${country.regionPt}`,
      curiosityEn: shortExtract || `${country.nameEn} · ${country.regionEn}`,
      imageUrl: img,
      author: 'Wikipedia / Wikimedia Commons',
      license: 'CC BY-SA 4.0',
      sourceName: 'Wikimedia Commons',
      referenceUrl: data.content_urls?.desktop?.page ?? `https://${wikiHost}`,
    };
    dynamicCardCache.set(cacheKey, card);
    return card;
  } catch {
    return null;
  }
}
