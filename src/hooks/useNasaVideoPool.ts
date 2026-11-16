import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DATASET_ORDER,
  DatasetId,
  LayerConfig,
  NASA_DATASETS,
  resolveAssetUrl,
} from '../datasets/nasaDatasets';
import { ExperienceLayersState } from '../experience/types';

/**
 * Converts the state of the 5 Eyes + Solo from `useExperience()` into the `LayerConfig[]` stack
 * consumed by the `EarthCanvas` shader.
 */
export function buildGlobeLayerStack(layers: ExperienceLayersState): LayerConfig[] {
  const spkSolo = layers.melody.sparkleSolo;
  const anySolo =
    spkSolo ||
    layers.melody.solo ||
    layers.chords.solo ||
    layers.bass.solo;

  const showMelody = spkSolo
    ? layers.melody.sparkleEnabled
    : layers.melody.enabled && (!anySolo || layers.melody.solo);
  const showChords = !spkSolo && layers.chords.enabled && (!anySolo || layers.chords.solo);
  const showBass = !spkSolo && layers.bass.enabled && (!anySolo || layers.bass.solo);
  const showTemp = layers.temperature.enabled && !anySolo;
  const showWind = layers.wind.enabled && !anySolo;

  return [
    { id: 'svs5147', enabled: showTemp, opacity: 0.72, blendMode: 'normal' },
    { id: 'svs5153', enabled: showChords, opacity: 0.72, blendMode: 'screen' },
    { id: 'svs5154', enabled: showBass, opacity: 0.78, blendMode: 'add' },
    { id: 'svs5148', enabled: showWind, opacity: 0.76, blendMode: 'screen' },
    { id: 'svs5011', enabled: showMelody, opacity: 0.95, blendMode: 'screen' },
  ];
}

/**
 * Lazily and safely manages the 5 global NASA `<video>` elements for `EarthCanvas`:
 * - Resolves URLs via `VITE_ASSETS_BASE_URL` (supporting local LAN `/nasa/*.mp4` and CDN/R2 on Vercel);
 * - Only initializes/decodes videos whose Eye toggle is enabled;
 * - Automatically pauses disabled videos to protect GPU and battery on the Tablet.
 */
export function useNasaVideoPool(
  layerStack: LayerConfig[],
  isPlaying = true
): Partial<Record<DatasetId, HTMLVideoElement | null>> {
  const videosRef = useRef<Partial<Record<DatasetId, HTMLVideoElement | null>>>({});
  const [, forceTick] = useState(0);

  const enabledMap = useMemo(() => {
    const map: Record<DatasetId, boolean> = {
      svs5011: false,
      svs5147: false,
      svs5148: false,
      svs5153: false,
      svs5154: false,
    };
    for (const item of layerStack) {
      map[item.id] = item.enabled;
    }
    return map;
  }, [layerStack]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    let createdNew = false;
    for (const id of DATASET_ORDER) {
      const shouldBeActive = enabledMap[id];
      let vid = videosRef.current[id] ?? null;

      if (shouldBeActive && !vid) {
        vid = document.createElement('video');
        vid.crossOrigin = 'anonymous';
        vid.muted = true;
        vid.loop = true;
        vid.playsInline = true;
        vid.preload = 'auto';
        vid.src = resolveAssetUrl(NASA_DATASETS[id].videoUrl);
        videosRef.current[id] = vid;
        createdNew = true;
      }

      if (vid) {
        if (shouldBeActive && isPlaying) {
          if (vid.paused) {
            void vid.play().catch(() => {
              // Ignore if the MP4 file is not yet present or autoplay awaits user gesture
            });
          }
        } else if (!vid.paused) {
          vid.pause();
        }
      }
    }

    if (createdNew) {
      forceTick((n) => n + 1);
    }
  }, [enabledMap, isPlaying]);

  useEffect(() => {
    const pool = videosRef.current;
    return () => {
      for (const id of DATASET_ORDER) {
        const vid = pool[id];
        if (vid) {
          vid.pause();
          vid.removeAttribute('src');
          vid.load();
          pool[id] = null;
        }
      }
    };
  }, []);

  return videosRef.current;
}
