import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SampledReading,
  playSonificationTone,
  sampleVideoAtLonLat,
  speakTextPt,
  stopSpeech,
} from '../accessibility/a11yEngine';
import { AstronautCopilot } from './AstronautCopilot';
import { CountryDetailCard } from './CountryDetailCard';
import { CameraViewTarget, EarthCanvas, HoverInfo } from './EarthCanvas';
import { HudOverlay } from './HudOverlay';
import { PlayerBar } from './PlayerBar';
import {
  BlendMode,
  DATASET_ORDER,
  DEFAULT_LAYER_STACK,
  DatasetId,
  LayerConfig,
  NASA_DATASETS,
  QuickPreset,
} from '../datasets/nasaDatasets';
import { CountryEntry, loadWorldCountries } from '../geo/countries';
import { getCountryLogistics } from '../geo/countryLogistics';
import { formatLatLon } from '../geo/projection';
import { clampVideoTime, stepVideoTime } from '../utils/playerMath';

interface EarthExplorerViewProps {
  userName: string;
  highContrast: boolean;
  onToggleHighContrast: () => void;
  fontScale: number;
  onCycleFontScale: () => void;
  onReopenTour: () => void;
  onLogout: () => void;
}

export const EarthExplorerView: React.FC<EarthExplorerViewProps> = ({
  userName,
  highContrast,
  onToggleHighContrast,
  fontScale,
  onCycleFontScale,
  onReopenTour,
  onLogout,
}) => {
  const { countries, allRings } = useMemo(() => loadWorldCountries(), []);

  const videoRefs = useRef<Partial<Record<DatasetId, HTMLVideoElement | null>>>({});
  const [videoElements, setVideoElements] = useState<
    Partial<Record<DatasetId, HTMLVideoElement | null>>
  >({});
  const [readyMap, setReadyMap] = useState<Partial<Record<DatasetId, boolean>>>({});

  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [layers, setLayers] = useState<LayerConfig[]>(DEFAULT_LAYER_STACK);
  const [primaryTrackId, setPrimaryTrackId] = useState<DatasetId>('svs5148');

  const [showBorders, setShowBorders] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [hdEnhance, setHdEnhance] = useState(true);

  const [copilotOpen, setCopilotOpen] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [sonifyEnabled, setSonifyEnabled] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState(
    'Explorador EARTHSONG carregado. Use Tab para navegar ou setas para mover o globo.'
  );

  const [selectedCountry, setSelectedCountry] = useState<CountryEntry | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [cameraDistance, setCameraDistance] = useState(2.55);
  const cameraCenterRef = useRef({ lon: -35, lat: -5 });

  const [flyTarget, setFlyTarget] = useState<CameraViewTarget | null>(null);
  const [zoomCommand, setZoomCommand] = useState<{ delta: number; nonce: number } | null>(null);
  const [panCommand, setPanCommand] = useState<{
    dLon: number;
    dLat: number;
    nonce: number;
  } | null>(null);
  const nonceRef = useRef(1);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(NASA_DATASETS.svs5148.durationHintSeconds);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoop, setIsLoop] = useState(true);

  const [sampleTick, setSampleTick] = useState(0);

  const enabledDatasetIds = useMemo(
    () => layers.filter((l) => l.enabled).map((l) => l.id),
    [layers]
  );

  useEffect(() => {
    if (enabledDatasetIds.length > 0 && !enabledDatasetIds.includes(primaryTrackId)) {
      setPrimaryTrackId(enabledDatasetIds[0]);
    }
  }, [enabledDatasetIds, primaryTrackId]);

  const setVideoRef = useCallback((id: DatasetId, el: HTMLVideoElement | null) => {
    videoRefs.current[id] = el;
  }, []);

  useEffect(() => {
    setVideoElements({ ...videoRefs.current });
    return () => {
      stopSpeech();
    };
  }, []);

  const announce = useCallback(
    (msg: string, forceSpeak = false) => {
      setLiveAnnouncement(msg);
      if (voiceEnabled || forceSpeak) {
        speakTextPt(msg);
      }
    },
    [voiceEnabled]
  );

  const handleToggleLayer = useCallback(
    (id: DatasetId) => {
      setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, enabled: !l.enabled } : l)));
      const ds = NASA_DATASETS[id];
      announce(`Camada ${ds.shortName} alternada.`);
    },
    [announce]
  );

  const handleSoloLayer = useCallback(
    (id: DatasetId) => {
      setLayers((prev) =>
        prev.map((l) =>
          l.id === id
            ? { ...l, enabled: true, opacity: 1, blendMode: 'normal' }
            : { ...l, enabled: false }
        )
      );
      setPrimaryTrackId(id);
      announce(`Exibindo somente a camada ${NASA_DATASETS[id].shortName}.`);
    },
    [announce]
  );

  const handleChangeLayerOpacity = useCallback((id: DatasetId, opacity: number) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, opacity } : l)));
  }, []);

  const handleChangeLayerBlendMode = useCallback((id: DatasetId, blendMode: BlendMode) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, blendMode } : l)));
  }, []);

  const handleMoveLayer = useCallback((id: DatasetId, direction: -1 | 1) => {
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      if (idx === -1) return prev;
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
  }, []);

  const handleMixAllPreset = useCallback(() => {
    setLayers([
      { id: 'svs5148', enabled: true, opacity: 1.0, blendMode: 'normal' },
      { id: 'svs5147', enabled: true, opacity: 0.55, blendMode: 'overlay' },
      { id: 'svs5153', enabled: true, opacity: 0.65, blendMode: 'screen' },
      { id: 'svs5154', enabled: true, opacity: 0.65, blendMode: 'screen' },
      { id: 'svs5011', enabled: true, opacity: 0.85, blendMode: 'add' },
    ]);
    announce('Todas as 5 camadas da NASA ativadas em modo mesclado.');
  }, [announce]);

  const getActiveVideos = useCallback((): HTMLVideoElement[] => {
    const list: HTMLVideoElement[] = [];
    for (const id of enabledDatasetIds) {
      const v = videoRefs.current[id];
      if (v) list.push(v);
    }
    return list;
  }, [enabledDatasetIds]);

  const getPrimaryVideo = useCallback((): HTMLVideoElement | null => {
    return videoRefs.current[primaryTrackId] ?? null;
  }, [primaryTrackId]);

  useEffect(() => {
    for (const id of DATASET_ORDER) {
      const vid = videoRefs.current[id];
      if (vid) {
        vid.loop = isLoop;
        vid.playbackRate = playbackRate;
      }
    }
  }, [isLoop, playbackRate]);

  useEffect(() => {
    const activeSet = new Set<DatasetId>(enabledDatasetIds);
    for (const id of DATASET_ORDER) {
      const vid = videoRefs.current[id];
      if (!vid) continue;
      if (activeSet.has(id)) {
        if (isPlaying) void vid.play().catch(() => {});
      } else {
        vid.pause();
      }
    }

    const primary = getPrimaryVideo();
    if (primary) {
      setCurrentTime(primary.currentTime || 0);
      setDuration(
        Number.isFinite(primary.duration) && primary.duration > 0
          ? primary.duration
          : NASA_DATASETS[primaryTrackId].durationHintSeconds
      );
    }
  }, [enabledDatasetIds, primaryTrackId, getPrimaryVideo, isPlaying]);

  useEffect(() => {
    let raf = 0;
    let lastSampleMs = 0;
    const sync = () => {
      const primary = getPrimaryVideo();
      if (primary) {
        setCurrentTime(primary.currentTime);
        if (Number.isFinite(primary.duration) && primary.duration > 0) {
          setDuration(primary.duration);
        }
        if (primary.ended && !isLoop) {
          setIsPlaying(false);
        }
      }
      const now = performance.now();
      if (now - lastSampleMs > 500) {
        lastSampleMs = now;
        setSampleTick((t) => t + 1);
      }
      if (isPlaying) {
        raf = requestAnimationFrame(sync);
      }
    };
    if (isPlaying) {
      raf = requestAnimationFrame(sync);
    }
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, isLoop, getPrimaryVideo]);

  const sampleReadingsAt = useCallback(
    (lon: number, lat: number): SampledReading[] => {
      const readings: SampledReading[] = [];
      for (const id of enabledDatasetIds) {
        const reading = sampleVideoAtLonLat(videoRefs.current[id] ?? null, lon, lat, id);
        if (reading) readings.push(reading);
      }
      return readings;
    },
    [enabledDatasetIds]
  );

  const selectedCountryReadings = useMemo(() => {
    void sampleTick;
    if (!selectedCountry) return [];
    return sampleReadingsAt(selectedCountry.lon, selectedCountry.lat);
  }, [selectedCountry, sampleReadingsAt, sampleTick]);

  const hoverReadings = useMemo(() => {
    void sampleTick;
    if (!hoverInfo) return [];
    return sampleReadingsAt(hoverInfo.lon, hoverInfo.lat);
  }, [hoverInfo, sampleReadingsAt, sampleTick]);

  useEffect(() => {
    if (!sonifyEnabled || hoverReadings.length === 0) return;
    playSonificationTone(hoverReadings[0].intensity01);
  }, [sonifyEnabled, hoverReadings]);

  const buildCountryAudioSummary = useCallback(
    (country: CountryEntry): string => {
      const log = getCountryLogistics(country);
      const readings = sampleReadingsAt(country.lon, country.lat);
      const readingsText =
        readings.length > 0
          ? `Leitura atual nas camadas: ${readings
              .map((r) => `${r.svsId}, ${r.labelPt}`)
              .join('. ')}.`
          : '';
      return `País selecionado: ${country.namePt}. Região: ${log.subregionPt}. ${log.summaryPt} Logística marítima: ${log.maritimePortsPt} Corredores: ${log.airAndLandCorridorsPt} ${readingsText}`;
    },
    [sampleReadingsAt]
  );

  const handleSelectCountry = useCallback(
    (country: CountryEntry | null) => {
      setSelectedCountry(country);
      if (!country) {
        announce('Seleção de país removida.');
        return;
      }
      nonceRef.current += 1;
      setFlyTarget({
        lon: country.lon,
        lat: country.lat,
        distance: country.idealDistance,
        nonce: nonceRef.current,
      });
      announce(buildCountryAudioSummary(country));
    },
    [announce, buildCountryAudioSummary]
  );

  const handleSpeakNow = useCallback(() => {
    if (selectedCountry) {
      announce(buildCountryAudioSummary(selectedCountry), true);
      return;
    }
    const targetLon = hoverInfo?.lon ?? cameraCenterRef.current.lon;
    const targetLat = hoverInfo?.lat ?? cameraCenterRef.current.lat;
    const readings = sampleReadingsAt(targetLon, targetLat);
    const countryName = hoverInfo?.country ? `Sobre ${hoverInfo.country.namePt}. ` : '';
    const coordsText = `Posição ${formatLatLon(targetLat, targetLon)}. `;
    const readingsText =
      readings.length > 0
        ? readings.map((r) => `${r.svsId}: ${r.labelPt}`).join('. ')
        : 'Nenhuma camada ativa pronta para leitura.';
    announce(`${countryName}${coordsText}${readingsText}`, true);
  }, [announce, buildCountryAudioSummary, hoverInfo, sampleReadingsAt, selectedCountry]);

  const handleTogglePlay = useCallback(() => {
    const videos = getActiveVideos();
    if (videos.length === 0) return;

    if (isPlaying) {
      videos.forEach((v) => v.pause());
      setIsPlaying(false);
      announce('Animação pausada.');
    } else {
      Promise.all(videos.map((v) => v.play().catch(() => {}))).then(() => {
        setIsPlaying(true);
        announce('Animação em reprodução.');
      });
    }
  }, [announce, getActiveVideos, isPlaying]);

  const handleSeek = useCallback(
    (time: number) => {
      const primary = getPrimaryVideo();
      if (!primary) return;
      const dur =
        Number.isFinite(primary.duration) && primary.duration > 0 ? primary.duration : duration;
      const clamped = clampVideoTime(time, dur);
      primary.currentTime = clamped;
      setCurrentTime(clamped);

      for (const id of enabledDatasetIds) {
        if (id === primaryTrackId) continue;
        const secondary = videoRefs.current[id];
        if (
          secondary &&
          Number.isFinite(secondary.duration) &&
          secondary.duration > 0 &&
          dur > 0
        ) {
          secondary.currentTime = (clamped / dur) * secondary.duration;
        }
      }
      setSampleTick((t) => t + 1);
    },
    [duration, enabledDatasetIds, getPrimaryVideo, primaryTrackId]
  );

  const handleStepFrame = useCallback(
    (direction: 1 | -1) => {
      const videos = getActiveVideos();
      videos.forEach((v) => v.pause());
      setIsPlaying(false);

      const primary = getPrimaryVideo();
      if (!primary) return;
      const dur =
        Number.isFinite(primary.duration) && primary.duration > 0 ? primary.duration : duration;
      const fps = NASA_DATASETS[primaryTrackId].fpsEstimate;
      const next = stepVideoTime(primary.currentTime, dur, direction, fps);
      primary.currentTime = next;
      setCurrentTime(next);
      setSampleTick((t) => t + 1);
    },
    [duration, getActiveVideos, getPrimaryVideo, primaryTrackId]
  );

  const handleRestart = useCallback(() => {
    getActiveVideos().forEach((v) => {
      v.currentTime = 0;
    });
    setCurrentTime(0);
    setSampleTick((t) => t + 1);
  }, [getActiveVideos]);

  const handleFlyPreset = useCallback(
    (preset: QuickPreset) => {
      setSelectedCountry(null);
      nonceRef.current += 1;
      setFlyTarget({
        lon: preset.lon,
        lat: preset.lat,
        distance: preset.distance,
        nonce: nonceRef.current,
      });
      announce(`Movendo visualização para ${preset.label}.`);
    },
    [announce]
  );

  const handleZoomStep = useCallback((delta: number) => {
    nonceRef.current += 1;
    setZoomCommand({ delta, nonce: nonceRef.current });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        nonceRef.current += 1;
        setPanCommand({ dLon: -10, dLat: 0, nonce: nonceRef.current });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nonceRef.current += 1;
        setPanCommand({ dLon: 10, dLat: 0, nonce: nonceRef.current });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        nonceRef.current += 1;
        setPanCommand({ dLon: 0, dLat: 8, nonce: nonceRef.current });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        nonceRef.current += 1;
        setPanCommand({ dLon: 0, dLat: -8, nonce: nonceRef.current });
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomStep(-0.24);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomStep(0.24);
      } else if (e.key.toLowerCase() === 'v') {
        setVoiceEnabled((prev) => {
          const next = !prev;
          if (!next) stopSpeech();
          else speakTextPt('Narração por voz ativada.');
          return next;
        });
      } else if (e.key.toLowerCase() === 'r') {
        handleSpeakNow();
      } else if (e.key.toLowerCase() === 's') {
        setSonifyEnabled((prev) => !prev);
      } else if (e.key.toLowerCase() === 'c') {
        onToggleHighContrast();
      } else if (e.key.toLowerCase() === 'h') {
        setHdEnhance((prev) => {
          const next = !prev;
          announce(next ? 'Nitidez HD por GPU ativada.' : 'Nitidez HD por GPU desativada.');
          return next;
        });
      } else if (e.key === 'Escape' && selectedCountry) {
        handleSelectCountry(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleSelectCountry,
    handleSpeakNow,
    handleTogglePlay,
    handleZoomStep,
    onToggleHighContrast,
    selectedCountry,
  ]);

  const isPrimaryReady = Boolean(readyMap[primaryTrackId]);

  return (
    <main
      id="main-earth-region"
      className={`app-shell ${highContrast ? 'high-contrast' : ''}`}
      style={{ fontSize: `${Math.round(fontScale * 100)}%` }}
    >
      <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="a11y-live-region">
        {liveAnnouncement}
      </div>

      {DATASET_ORDER.map((id) => {
        const ds = NASA_DATASETS[id];
        const isActive = enabledDatasetIds.includes(id);
        return (
          <video
            key={id}
            ref={(el) => setVideoRef(id, el)}
            data-dataset-id={id}
            src={ds.videoUrl}
            muted
            playsInline
            loop={isLoop}
            preload={isActive ? 'auto' : 'metadata'}
            onLoadedData={() => {
              setReadyMap((prev) => ({ ...prev, [id]: true }));
              const vid = videoRefs.current[id];
              if (id === primaryTrackId && vid && Number.isFinite(vid.duration) && vid.duration > 0) {
                setDuration(vid.duration);
              }
            }}
            onCanPlay={() => setReadyMap((prev) => ({ ...prev, [id]: true }))}
            style={{ display: 'none' }}
          />
        );
      })}

      <EarthCanvas
        videoElements={videoElements}
        layers={layers}
        viewMode={viewMode}
        showBorders={showBorders}
        showGrid={showGrid}
        showLabels={showLabels}
        highContrast={highContrast}
        hdEnhance={hdEnhance}
        countries={countries}
        allRings={allRings}
        selectedCountry={selectedCountry}
        flyTarget={flyTarget}
        zoomCommand={zoomCommand}
        panCommand={panCommand}
        onHoverChange={setHoverInfo}
        onCameraDistanceChange={setCameraDistance}
        onCameraCenterChange={(lon, lat) => {
          cameraCenterRef.current = { lon, lat };
        }}
        onSelectCountry={handleSelectCountry}
      />

      <HudOverlay
        viewMode={viewMode}
        onToggleViewMode={(mode) => {
          setViewMode(mode);
          announce(mode === '3d' ? 'Modo Globo 3D ativado.' : 'Modo Mapa 2D plano ativado.');
        }}
        layers={layers}
        onToggleLayer={handleToggleLayer}
        onSoloLayer={handleSoloLayer}
        onChangeLayerOpacity={handleChangeLayerOpacity}
        onChangeLayerBlendMode={handleChangeLayerBlendMode}
        onMoveLayer={handleMoveLayer}
        onMixAllPreset={handleMixAllPreset}
        showBorders={showBorders}
        onToggleBorders={() => setShowBorders((v) => !v)}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid((v) => !v)}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels((v) => !v)}
        hdEnhance={hdEnhance}
        onToggleHdEnhance={() =>
          setHdEnhance((prev) => {
            const next = !prev;
            announce(next ? 'Nitidez HD por GPU ativada.' : 'Nitidez HD por GPU desativada.');
            return next;
          })
        }
        voiceEnabled={voiceEnabled}
        onToggleVoice={() =>
          setVoiceEnabled((prev) => {
            const next = !prev;
            if (!next) stopSpeech();
            else speakTextPt('Narração por voz em português ativada.');
            return next;
          })
        }
        sonifyEnabled={sonifyEnabled}
        onToggleSonify={() => setSonifyEnabled((v) => !v)}
        highContrast={highContrast}
        onToggleHighContrast={onToggleHighContrast}
        fontScale={fontScale}
        onCycleFontScale={onCycleFontScale}
        onSpeakNow={handleSpeakNow}
        countries={countries}
        selectedCountry={selectedCountry}
        onSelectAndFlyCountry={handleSelectCountry}
        onFlyPreset={handleFlyPreset}
        onZoomStep={handleZoomStep}
        hoverInfo={hoverInfo}
        hoverReadings={hoverReadings}
        cameraDistance={cameraDistance}
        userName={userName}
        copilotOpen={copilotOpen}
        onToggleCopilot={() => setCopilotOpen((v) => !v)}
        onReopenTour={() => {
          stopSpeech();
          onReopenTour();
        }}
        onLogout={() => {
          stopSpeech();
          onLogout();
        }}
        copilotWidget={
          copilotOpen ? (
            <AstronautCopilot
              selectedCountry={selectedCountry}
              voiceEnabled={voiceEnabled}
              sonifyEnabled={sonifyEnabled}
              liveAnnouncement={liveAnnouncement}
              onSpeakNow={handleSpeakNow}
              onToggleSonify={() => setSonifyEnabled((v) => !v)}
              onReopenTour={() => {
                stopSpeech();
                onReopenTour();
              }}
              onMinimize={() => setCopilotOpen(false)}
            />
          ) : null
        }
        detailCard={
          selectedCountry ? (
            <CountryDetailCard
              country={selectedCountry}
              liveReadings={selectedCountryReadings}
              onClose={() => handleSelectCountry(null)}
              onZoomIntoCountry={() => {
                nonceRef.current += 1;
                setFlyTarget({
                  lon: selectedCountry.lon,
                  lat: selectedCountry.lat,
                  distance: Math.max(1.12, selectedCountry.idealDistance * 0.78),
                  nonce: nonceRef.current,
                });
              }}
              onSpeakSummary={() => announce(buildCountryAudioSummary(selectedCountry), true)}
            />
          ) : null
        }
        playerBar={
          <PlayerBar
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            playbackRate={playbackRate}
            isLoop={isLoop}
            isReady={isPrimaryReady}
            enabledDatasetIds={enabledDatasetIds}
            primaryTrackId={primaryTrackId}
            onChangePrimaryTrack={setPrimaryTrackId}
            onTogglePlay={handleTogglePlay}
            onSeek={handleSeek}
            onStepFrame={handleStepFrame}
            onChangeRate={setPlaybackRate}
            onToggleLoop={() => setIsLoop((v) => !v)}
            onRestart={handleRestart}
          />
        }
      />
    </main>
  );
};
