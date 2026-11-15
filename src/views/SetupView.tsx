import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  Film,
  Grid,
  Headphones,
  LayoutDashboard,
  type LucideIcon,
  Monitor,
  Pause,
  Play,
  QrCode,
  Radio,
  RefreshCw,
  Repeat,
  RotateCcw,
  Scan,
  SkipBack,
  Sliders,
  Speaker,
  Square,
  Star,
  Volume2,
  VolumeX,
  Wifi,
  Zap,
} from 'lucide-react';
import {
  SPEAKER_IDS,
  SpeakerSlotId,
  speakerSlotIdToIndex,
} from '../audio/speakerCalibration';
import {
  useAudioAdmin,
  useExperience,
  useProjectionAdmin,
} from '../experience/ExperienceContext';
import { speakTextPt } from '../accessibility/a11yEngine';
import {
  resolveActiveMissionFrameId,
  resolveFramePrompts,
  SHAY_MISSION_FRAMES,
} from '../experience/missionFrames';
import {
  AudioOutputMode,
  LAYER_METAS,
  PILOT_COUNTRY_IDS,
  PROJECTOR_OUT_IDS,
  ProjectorOutId,
  RoomDimensions,
  SoloableLayerId,
  SURFACE_IDS,
  SurfaceId,
  VISUAL_LAYER_ORDER,
} from '../experience/types';
import { encodeQrMatrix } from '../lan/qrCodeSvg';
import {
  CalibrationSurfaceKey,
  makeSurfaceQuadKey,
  ProjectionTopologyPreset,
  QuadCorners,
} from '../projection/homography';
import { SimulatorView } from './SimulatorView';

type AdminModuleId = 'overview' | 'cues' | 'projection' | 'audio' | 'network';

interface LanServerInfo {
  lanIps: string[];
  port: number;
  renderedCountryCount: number;
  renderedCountryIds: string[];
}

const SURFACE_UI_META: Record<
  SurfaceId,
  {
    shortPt: string;
    shortEn: string;
    detailPt: string;
    detailEn: string;
    accentHex: string;
  }
> = {
  leftWall: {
    shortPt: 'Parede Esquerda',
    shortEn: 'Left Wall',
    detailPt: 'Globo 3D/2D',
    detailEn: '3D/2D Globe',
    accentHex: '#38bdf8',
  },
  rightWall: {
    shortPt: 'Parede Direita',
    shortEn: 'Right Wall',
    detailPt: 'Guia & História',
    detailEn: 'Guide & Story',
    accentHex: '#fbbf24',
  },
  ceiling: {
    shortPt: 'Teto',
    shortEn: 'Ceiling',
    detailPt: '5 Camadas PNG',
    detailEn: '5 PNG Stack',
    accentHex: '#34d399',
  },
};

export const SetupView: React.FC = () => {
  const {
    country,
    allCountries,
    roomDimensions,
    setRoomDimensions,
    storyStep,
    missionPhase,
    sceneReplayKey,
    activateMissionFrame,
    replayActiveFrame,
    loopSingleBar,
    setLoopSingleBar,
    compareCountries,
    setCompareSlot,
    swapCompareCountries,
    beatTimeline,
    speakerLiveLevels,
    layers,
    toggleEye,
    toggleSolo,
    toggleSparkle,
    audioMode,
    setAudioMode,
    masterGain,
    setMasterGain,
    localAudioMuted,
    setLocalAudioMuted,
    audioSourceKind,
    lanConnected,
    lanClients,
    playback,
    liveEvents,
    audioLevels,
    lang,
    setLang,
    selectCountryPreserveBeat,
    seekBeat,
    stepBeat,
    togglePlay,
    resetExperienceToDefault,
  } = useExperience();

  const {
    speakerCalibration,
    calibTestMode,
    outputDevices,
    outputSupportStatus,
    isSetSinkIdSupported,
    unlockOutputDevices,
    updateSpeakerConfig,
    setReferenceSpeaker,
    resetSpeakerCalibration,
    startPinkNoiseSingle,
    startPinkNoiseAB,
    startDelayClickTest,
    stopCalibrationSignal,
    refreshOutputDevices,
  } = useAudioAdmin();

  const {
    projectionState,
    selectProjectionPreset,
    toggleOutputSurface,
    updateOutputConfig,
    updateSurfaceQuad,
    resetSingleOutputQuads,
    resetAllProjectionQuads,
    triggerIdentifyOutputs,
    toggleGlobalBlackout,
    toggleGlobalShowGrid,
  } = useProjectionAdmin();

  const isPt = lang === 'pt';
  const [activeModule, setActiveModule] = useState<AdminModuleId>('overview');
  const [isAutoSequencePlaying, setIsAutoSequencePlaying] = useState<boolean>(false);

  const activeFrameId = resolveActiveMissionFrameId(missionPhase, storyStep);
  const activeFrameSpec =
    SHAY_MISSION_FRAMES.find((f) => f.id === activeFrameId) ?? SHAY_MISSION_FRAMES[0];

  useEffect(() => {
    if (!isAutoSequencePlaying) return;
    const idx = SHAY_MISSION_FRAMES.findIndex((f) => f.id === activeFrameId);
    if (idx < 0 || idx >= SHAY_MISSION_FRAMES.length - 1) {
      setIsAutoSequencePlaying(false);
      return;
    }
    const currentSpec = SHAY_MISSION_FRAMES[idx];
    const nextSpec = SHAY_MISSION_FRAMES[idx + 1];
    const timer = window.setTimeout(() => {
      activateMissionFrame(nextSpec.phase, nextSpec.storyStep, nextSpec.focusLayer);
    }, currentSpec.autoDurationMs);
    return () => window.clearTimeout(timer);
  }, [activateMissionFrame, activeFrameId, isAutoSequencePlaying]);
  const [overviewStageMode, setOverviewStageMode] = useState<'mini3d' | 'stage2d'>('mini3d');
  const [selectedWarpOut, setSelectedWarpOut] = useState<ProjectorOutId>(1);

  const [lanInfo, setLanInfo] = useState<LanServerInfo>({
    lanIps: [],
    port: 5173,
    renderedCountryCount: 3,
    renderedCountryIds: [...PILOT_COUNTRY_IDS],
  });
  const [selectedHostIp, setSelectedHostIp] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Drag state para Planta 2D das Caixas
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [draggingSpeaker, setDraggingSpeaker] = useState<SpeakerSlotId | null>(null);

  // Drag state para Canvas Remoto 16:9 de Corner-Pin
  const remoteWarpRef = useRef<HTMLDivElement | null>(null);
  const [draggingRemotePin, setDraggingRemotePin] = useState<{
    quadKey: CalibrationSurfaceKey;
    cornerIdx: 0 | 1 | 2 | 3;
  } | null>(null);

  const fetchLanDiagnostics = () => {
    if (
      typeof window === 'undefined' ||
      typeof window.fetch !== 'function' ||
      !window.location?.origin ||
      window.location.origin === 'null'
    ) {
      return;
    }
    window
      .fetch('/api/lan-info')
      .then((r) => (r.ok ? (r.json() as Promise<LanServerInfo>) : null))
      .then((info) => {
        if (!info) return;
        setLanInfo(info);
        if (!selectedHostIp && info.lanIps.length > 0) {
          setSelectedHostIp(info.lanIps[0]);
        }
      })
      .catch(() => {
        // Fallback silencioso em ambiente estático
      });
  };

  useEffect(() => {
    fetchLanDiagnostics();
    void refreshOutputDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      stopCalibrationSignal();
    };
  }, [stopCalibrationSignal]);

  // Drag global na Planta 2D Acústica
  useEffect(() => {
    if (!draggingSpeaker) return;
    const onPointerMove = (e: PointerEvent) => {
      const el = stageRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;
      // leftPct = 50 + posX * 40 => posX = (relX*100 - 50)/40
      const posX = Math.max(-1, Math.min(1, (relX * 100 - 50) / 40));
      const posY = Math.max(-1, Math.min(1, (50 - relY * 100) / 40));
      updateSpeakerConfig(draggingSpeaker, {
        posX: Number(posX.toFixed(2)),
        posY: Number(posY.toFixed(2)),
      });
    };
    const onPointerUp = () => setDraggingSpeaker(null);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [draggingSpeaker, updateSpeakerConfig]);

  // Drag global no Editor Remoto 16:9 de Corner-Pin
  useEffect(() => {
    if (!draggingRemotePin) return;
    const onPointerMove = (e: PointerEvent) => {
      const el = remoteWarpRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const ny = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      const current = [...projectionState.quads[draggingRemotePin.quadKey]] as QuadCorners;
      current[draggingRemotePin.cornerIdx] = {
        x: Number(nx.toFixed(4)),
        y: Number(ny.toFixed(4)),
      };
      updateSurfaceQuad(draggingRemotePin.quadKey, current);
    };
    const onPointerUp = () => setDraggingRemotePin(null);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [draggingRemotePin, projectionState.quads, updateSurfaceQuad]);

  const baseOrigin = useMemo(() => {
    if (selectedHostIp.trim()) {
      const portPart = lanInfo.port ? `:${lanInfo.port}` : '';
      return `http://${selectedHostIp.trim()}${portPart}`;
    }
    if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
      return window.location.origin;
    }
    return 'http://localhost:5173';
  }, [lanInfo.port, selectedHostIp]);

  const tabletUrl = `${baseOrigin}/?view=controller`;
  const qrModules = useMemo(() => encodeQrMatrix(tabletUrl), [tabletUrl]);

  const copyText = (key: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1800);
    }
  };

  const updateDimension = (
    surface: SurfaceId,
    field: 'widthCm' | 'heightCm',
    rawValue: string
  ) => {
    const val = Math.max(50, Math.min(2000, Number(rawValue) || 100));
    const next: RoomDimensions = {
      ...roomDimensions,
      [surface]: {
        ...roomDimensions[surface],
        [field]: val,
      },
    };
    setRoomDimensions(next);
  };

  const activeOutputsCount = useMemo(
    () =>
      PROJECTOR_OUT_IDS.filter((id) => projectionState.outputs[id].surfaces.length > 0).length,
    [projectionState.outputs]
  );

  const anyGridActive = useMemo(
    () =>
      projectionState.showGrid ||
      PROJECTOR_OUT_IDS.some((id) => projectionState.outputs[id].showGrid),
    [projectionState.outputs, projectionState.showGrid]
  );

  const surfaceToOutLabels = useMemo(() => {
    const map: Record<SurfaceId, string[]> = {
      leftWall: [],
      rightWall: [],
      ceiling: [],
    };
    for (const outId of PROJECTOR_OUT_IDS) {
      for (const sId of projectionState.outputs[outId].surfaces) {
        map[sId].push(`OUT ${outId}`);
      }
    }
    return map;
  }, [projectionState.outputs]);

  const handleStagePanic = () => {
    stopCalibrationSignal();
    if (projectionState.showGrid) {
      toggleGlobalShowGrid();
    }
    for (const outId of PROJECTOR_OUT_IDS) {
      if (projectionState.outputs[outId].showGrid) {
        updateOutputConfig(outId, { showGrid: false });
      }
    }
  };

  const presetLabel = (preset: ProjectionTopologyPreset): string => {
    if (preset === '3-projectors') return isPt ? '3 Projetores (1/Parede)' : '3 Projectors (1/Wall)';
    if (preset === '2-projectors') return isPt ? '2 Projetores (Canto + Teto)' : '2 Projectors (L + Ceil)';
    if (preset === '1-projector') return isPt ? '1 Projetor Único' : '1 Single Projector';
    return isPt ? 'Matriz Customizada' : 'Custom Matrix';
  };

  /**
   * Planta Interativa 2D da Sala (Paredes + Projetores atribuídos + 3 Caixas Arrastáveis + Eventos NASA)
   */
  const renderInteractiveRoomStage = (compact = false) => (
    <div className="flex flex-col gap-3">
      <div
        ref={stageRef}
        className={`relative mx-auto aspect-square w-full overflow-hidden rounded-xl border border-slate-400/20 bg-[#040710] select-none touch-none ${
          compact ? 'max-w-[330px]' : 'max-w-[380px]'
        }`}
      >
        {/* Parede Esquerda (Oeste/Noroeste) */}
        <div
          className="pointer-events-none absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold"
          style={{
            borderColor: 'rgba(56, 189, 248, 0.45)',
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            color: '#bae6fd',
          }}
        >
          <span>{isPt ? 'Parede Esq' : 'Left Wall'}</span>
          <span className="rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-sky-300 [font-variant-numeric:tabular-nums]">
            {surfaceToOutLabels.leftWall.join(',') || 'OFF'}
          </span>
        </div>

        {/* Parede Direita (Leste/Nordeste) */}
        <div
          className="pointer-events-none absolute top-2.5 right-2.5 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold"
          style={{
            borderColor: 'rgba(251, 191, 36, 0.45)',
            backgroundColor: 'rgba(251, 191, 36, 0.1)',
            color: '#fde68a',
          }}
        >
          <span>{isPt ? 'Parede Dir' : 'Right Wall'}</span>
          <span className="rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-amber-300 [font-variant-numeric:tabular-nums]">
            {surfaceToOutLabels.rightWall.join(',') || 'OFF'}
          </span>
        </div>

        {/* Teto Projetado (Centro Superior) */}
        <div
          className="pointer-events-none absolute top-11 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold"
          style={{
            borderColor: 'rgba(52, 211, 153, 0.4)',
            backgroundColor: 'rgba(52, 211, 153, 0.08)',
            color: '#a7f3d0',
          }}
        >
          <span>{isPt ? 'Teto 5 PNGs' : 'Ceiling 5 PNGs'}</span>
          <span className="rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-emerald-300 [font-variant-numeric:tabular-nums]">
            {surfaceToOutLabels.ceiling.join(',') || 'OFF'}
          </span>
        </div>

        {/* Linhas angulares de canto 90° e anéis acústicos VBAP */}
        <svg
          viewBox="0 0 200 200"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <path
            d="M 18 82 L 100 20 L 182 82"
            fill="none"
            stroke="rgba(148, 163, 184, 0.28)"
            strokeWidth="1.5"
          />
          <circle
            cx="100"
            cy="100"
            r="72"
            fill="none"
            stroke="rgba(148, 163, 184, 0.14)"
            strokeDasharray="3 4"
          />
          <circle
            cx="100"
            cy="100"
            r="42"
            fill="none"
            stroke="rgba(148, 163, 184, 0.14)"
            strokeDasharray="2 3"
          />
          <line x1="100" y1="20" x2="100" y2="188" stroke="rgba(148,163,184,0.08)" />
          <line x1="16" y1="100" x2="184" y2="100" stroke="rgba(148,163,184,0.08)" />
        </svg>

        {/* Posição Central do Visitante (Sweet-Spot) */}
        <div
          className="pointer-events-none absolute top-1/2 left-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-400/35 bg-[#0b1222] text-[10px] font-semibold text-slate-300"
          title={isPt ? 'Visitante no centro acústico' : 'Visitor acoustic sweet-spot'}
        >
          8D
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[10px] text-slate-500">
          {isPt
            ? 'Arraste C1, C2 e C3 para posicionar o VBAP na sala'
            : 'Drag C1, C2 & C3 to position room VBAP'}
        </div>

        {/* Eventos Georreferenciados NASA ao vivo (source_x, source_y) */}
        {liveEvents.map((ev, idx) => (
          <span
            key={`${ev.layer}-${idx}`}
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-150"
            style={{
              left: `${ev.source_x * 76 + 12}%`,
              top: `${(1 - ev.source_y) * 72 + 16}%`,
              backgroundColor:
                ev.layer === 'melody' || ev.layer === 'sparkle'
                  ? '#fbbf24'
                  : ev.layer === 'chords'
                    ? '#fb923c'
                    : '#34d399',
              boxShadow: '0 0 10px currentColor',
            }}
          />
        ))}

        {/* As 3 Caixas Físicas Arrastáveis */}
        {SPEAKER_IDS.map((spkId, idx) => {
          const spk = speakerCalibration.speakers[spkId];
          const isRef = speakerCalibration.referenceSpeakerId === spkId;
          const isPulsing =
            (calibTestMode.kind === 'pink-single' && calibTestMode.speakerId === spkId) ||
            (calibTestMode.kind === 'pink-ab' && calibTestMode.activeNow === spkId) ||
            (calibTestMode.kind === 'delay-click' &&
              (calibTestMode.targetSpeakerId === spkId || isRef));

          const leftPct = 50 + spk.posX * 40;
          const topPct = 50 - spk.posY * 40;

          return (
            <button
              key={spkId}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                setDraggingSpeaker(spkId);
              }}
              className={`absolute z-20 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center justify-center rounded-xl border text-[11px] font-bold transition active:cursor-grabbing ${
                spk.muted
                  ? 'border-rose-500/45 bg-rose-950/80 text-rose-300 opacity-65'
                  : isPulsing
                    ? 'scale-110 border-emerald-300 bg-emerald-400 text-slate-950'
                    : isRef
                      ? 'border-amber-400/70 bg-[#13203d] text-amber-200'
                      : 'border-sky-400/55 bg-[#0c1a36] text-sky-100 hover:border-sky-300'
              }`}
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              title={`${isPt ? spk.labelPt : spk.labelEn} (${spk.posX.toFixed(2)}, ${spk.posY.toFixed(2)})`}
            >
              <span>C{idx + 1}</span>
              <span className="text-[8px] font-medium opacity-80">
                {spk.routeTarget === 'lan-node' ? 'LAN' : isRef ? 'REF' : 'LOC'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const countrySlotA = useMemo(
    () => allCountries.find((c) => c.id === compareCountries.slotA) ?? null,
    [allCountries, compareCountries.slotA]
  );
  const countrySlotB = useMemo(
    () => allCountries.find((c) => c.id === compareCountries.slotB) ?? null,
    [allCountries, compareCountries.slotB]
  );

  /**
   * Mini-Canto 3D Ao Vivo + Verificador de Saída das 3 Caixas Físicas (C1, C2, C3):
   * Permite assistir em tempo real às 2 paredes + teto da Shay enquanto confere se o som 8D
   * está saindo exatamente das caixas esperadas.
   */
  const renderLiveRoomAndSpeakerMonitor = (heightClass = 'h-[310px]') => (
    <div className="flex flex-col gap-3" data-testid="admin-mini-canto-monitor">
      <div
        className={`w-full overflow-hidden rounded-xl border border-slate-400/20 bg-[#02040a] ${heightClass}`}
      >
        <SimulatorView key={sceneReplayKey} embedded />
      </div>

      {/* Verificador Acústico em Tempo Real por Caixa Física (C1 · C2 · C3) */}
      <div className="rounded-xl border border-slate-400/15 bg-[#060a14] p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="font-semibold text-slate-200">
            {isPt
              ? 'Saída Espacial 8D por Caixa Física (VBAP)'
              : 'Live 8D Output per Physical Speaker (VBAP)'}
          </span>
          <span className="text-slate-400 [font-variant-numeric:tabular-nums]">
            {liveEvents.length > 0
              ? `${liveEvents.length} ${isPt ? 'eventos ativos' : 'live events'} · (${liveEvents[0].source_x.toFixed(2)}, ${liveEvents[0].source_y.toFixed(2)})`
              : isPt
                ? 'Toque ou clique numa batida p/ auditar'
                : 'Play or click a beat to audit'}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {SPEAKER_IDS.map((spkId, idx) => {
            const spk = speakerCalibration.speakers[spkId];
            const level01 = speakerLiveLevels[spkId];
            const pct = Math.round(level01 * 100);
            const isPink =
              calibTestMode.kind === 'pink-single' && calibTestMode.speakerId === spkId;
            const barColor =
              idx === 0 ? '#38bdf8' : idx === 1 ? '#fbbf24' : '#34d399';

            return (
              <div key={spkId} className="flex items-center gap-2.5 text-xs">
                <div className="w-28 shrink-0">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-100 [font-variant-numeric:tabular-nums]">
                    <span>C{idx + 1}</span>
                    <span className="truncate text-[11px] font-normal text-slate-300">
                      {isPt ? spk.shortLabelPt : spk.shortLabelEn}
                    </span>
                  </div>
                </div>

                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#0b1222]">
                  <div
                    className="h-full rounded-full transition-all duration-150"
                    style={{
                      width: `${spk.muted ? 0 : pct}%`,
                      backgroundColor: isPink ? '#34d399' : barColor,
                    }}
                  />
                </div>

                <span className="w-10 shrink-0 text-right text-[11px] font-semibold text-slate-200 [font-variant-numeric:tabular-nums]">
                  {spk.muted ? 'MUTE' : `${pct}%`}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    isPink ? stopCalibrationSignal() : startPinkNoiseSingle(spkId)
                  }
                  className={`min-h-[26px] shrink-0 rounded-md border px-2 text-[10px] font-semibold transition ${
                    isPink
                      ? 'border-emerald-300 bg-emerald-400 text-slate-950'
                      : 'border-slate-400/20 bg-[#0b1222] text-slate-300 hover:text-white'
                  }`}
                  title={isPt ? 'Testar esta caixa com Ruído Rosa' : 'Test speaker with Pink Noise'}
                >
                  {isPink ? 'Stop' : isPt ? 'Rosa' : 'Pink'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const currentBeatGlobal = playback.bar * 4 + playback.beat;

  const navItems: Array<{
    id: AdminModuleId;
    Icon: LucideIcon;
    labelPt: string;
    labelEn: string;
    badge?: string;
  }> = [
    {
      id: 'overview',
      Icon: LayoutDashboard,
      labelPt: 'Visão Geral',
      labelEn: 'Room Overview',
    },
    {
      id: 'cues',
      Icon: Film,
      labelPt: 'Quadros & A⇄B',
      labelEn: 'Frames & A⇄B',
      badge: `Q${activeFrameSpec.order}`,
    },
    {
      id: 'projection',
      Icon: Monitor,
      labelPt: 'Matriz de Projeção',
      labelEn: 'Projection Matrix',
      badge: `${activeOutputsCount} OUT`,
    },
    {
      id: 'audio',
      Icon: Sliders,
      labelPt: 'Console 8D & Caixas',
      labelEn: '8D Console & Speakers',
      badge: audioMode === 'room3' ? 'VBAP' : audioMode.toUpperCase(),
    },
    {
      id: 'network',
      Icon: Wifi,
      labelPt: 'Rede LAN, Nós & QR',
      labelEn: 'LAN, Nodes & QR',
      badge: `${lanClients.length}`,
    },
  ];

  const activeWarpSurfaces = projectionState.outputs[selectedWarpOut].surfaces;

  return (
    <div
      className="flex h-dvh w-screen flex-col overflow-hidden bg-[#050811] text-slate-100"
      data-testid="setup-view"
    >
      {/* =====================================================================
          TOP SHOW-CONTROL COMMAND BAR (Fixa — nunca some ao rolar)
         ===================================================================== */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-400/15 bg-[#080d19] px-4 py-2.5 lg:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-400/30 bg-[#0c1a36] text-sky-300">
              <Radio size={16} />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-slate-50">
                Earth Jukebox · Show Control
              </h1>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 [font-variant-numeric:tabular-nums]">
                <span>{presetLabel(projectionState.preset)}</span>
                <span>·</span>
                <span>
                  {audioSourceKind === 'stems'
                    ? isPt
                      ? '8 Stems Pré-Gerados'
                      : '8 Pre-Rendered Stems'
                    : isPt
                      ? 'Motor 8D meta.json'
                      : '8D meta.json Synth'}
                </span>
              </div>
            </div>
          </div>

          {/* Telemetria Rápida de Rede */}
          <span
            className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium [font-variant-numeric:tabular-nums] sm:inline-flex ${
              lanConnected
                ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200'
                : 'border-slate-400/20 bg-[#0b1222] text-slate-400'
            }`}
          >
            <Wifi size={12} />
            {lanConnected
              ? isPt
                ? `LAN Online (${lanClients.length} disp.)`
                : `LAN Online (${lanClients.length} nodes)`
              : 'Local Sync'}
          </span>
        </div>

        {/* Transporte Musical + Comparador A⇄B na Mesma Batida + Utilitários de Palco */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Botão Instantâneo País A ⇄ País B mantendo a exata batida atual */}
          <button
            type="button"
            onClick={swapCompareCountries}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-sky-400/35 bg-[#0b1529] px-2.5 text-xs font-semibold text-sky-100 transition hover:border-sky-300 hover:bg-sky-400/15 [font-variant-numeric:tabular-nums]"
            title={
              isPt
                ? 'Alterna instantaneamente entre País A e País B sem reiniciar o compasso/batida'
                : 'Instantly swaps Country A and Country B on the exact same beat'
            }
          >
            <span className={country?.id === compareCountries.slotA ? 'text-amber-300' : 'text-slate-300'}>
              {countrySlotA ? (isPt ? countrySlotA.namePt : countrySlotA.nameEn) : 'A'}
            </span>
            <ArrowLeftRight size={13} className="text-sky-300" />
            <span className={country?.id === compareCountries.slotB ? 'text-amber-300' : 'text-slate-300'}>
              {countrySlotB ? (isPt ? countrySlotB.namePt : countrySlotB.nameEn) : 'B'}
            </span>
            <span className="hidden rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-slate-300 md:inline">
              C{playback.bar + 1}.{playback.beat + 1}
            </span>
          </button>

          <button
            type="button"
            onClick={togglePlay}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-amber-400 px-3 text-xs font-bold text-slate-950 transition hover:bg-amber-300"
          >
            {playback.isPlaying ? <Pause size={14} /> : <Play size={14} />}
            <span className="[font-variant-numeric:tabular-nums]">
              {playback.isPlaying
                ? `${isPt ? country?.namePt : country?.nameEn} · ${playback.bpm} BPM`
                : isPt
                  ? 'Testar Som 8D'
                  : 'Test 8D Sound'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => triggerIdentifyOutputs(7000)}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-400/20 bg-[#0b1222] px-2.5 text-xs font-medium text-slate-200 transition hover:border-sky-400/40 hover:text-white"
            title={
              isPt
                ? 'Exibe OUT 1..4 gigante em todos os projetores por 7 segundos para identificar cabos HDMI'
                : 'Flashes giant OUT 1..4 on all projectors for 7 seconds'
            }
          >
            <Scan size={14} className="text-sky-300" />
            <span className="hidden sm:inline">
              {isPt ? 'Identificar Telas' : 'Identify Outs'}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleGlobalBlackout}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition ${
              projectionState.globalBlackout
                ? 'border-rose-400 bg-rose-500/25 text-rose-100'
                : 'border-slate-400/20 bg-[#0b1222] text-slate-200 hover:bg-white/[0.06]'
            }`}
            title={
              isPt
                ? 'Apaga todas as projeções para preto absoluto (#000000)'
                : 'Blacks out all projectors (#000000)'
            }
          >
            {projectionState.globalBlackout ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>Blackout</span>
          </button>

          {(calibTestMode.kind !== 'off' || anyGridActive) && (
            <button
              type="button"
              onClick={handleStagePanic}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-rose-500 px-2.5 text-xs font-bold text-white transition hover:bg-rose-400"
              title={
                isPt
                  ? 'Corta Ruído Rosa/Click e esconde todas as grades de calibração imediatamente'
                  : 'Stops calibration audio and hides all grids immediately'
              }
            >
              <Square size={12} />
              <span>{isPt ? 'Cortar Testes' : 'Stop Tests'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setLocalAudioMuted(!localAudioMuted)}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition ${
              localAudioMuted
                ? 'border-rose-400/50 bg-rose-500/15 text-rose-200'
                : 'border-slate-400/20 bg-[#0b1222] text-slate-200 hover:bg-white/[0.06]'
            }`}
            title={isPt ? 'Silencia apenas este computador' : 'Mutes this local computer only'}
          >
            {localAudioMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            <span className="hidden md:inline">
              {localAudioMuted ? (isPt ? 'PC Mudo' : 'PC Muted') : 'PC Audio'}
            </span>
          </button>

          <button
            type="button"
            onClick={resetExperienceToDefault}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-400/20 bg-[#0b1222] px-2.5 text-xs font-medium text-slate-300 hover:text-white"
            title={isPt ? 'Reseta experiência para o próximo visitante' : 'Reset for next visitor'}
          >
            <RotateCcw size={13} />
            <span className="hidden md:inline">{isPt ? 'Reset' : 'Reset'}</span>
          </button>

          <button
            type="button"
            onClick={() => setLang(isPt ? 'en' : 'pt')}
            className="min-h-[36px] rounded-lg border border-slate-400/20 bg-[#0b1222] px-2.5 text-xs font-semibold text-slate-200 hover:text-white"
          >
            {isPt ? 'PT' : 'EN'}
          </button>
        </div>
      </header>

      {/* =====================================================================
          CORPO DO CONSOLE: SIDEBAR FIXA + WORKSPACE COM SCROLL (.admin-scroll)
         ===================================================================== */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Sidebar de Navegação (Desktop Vertical / Mobile Barra Horizontal) */}
        <aside className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-slate-400/15 bg-[#070b16] p-2 lg:w-56 lg:flex-col lg:justify-between lg:overflow-y-auto lg:border-r lg:border-b-0 lg:p-3">
          <nav aria-label="Show Control Modules" className="flex flex-row gap-1 lg:flex-col">
            {navItems.map(({ id, Icon, labelPt, labelEn, badge }) => {
              const active = activeModule === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveModule(id)}
                  className={`flex min-h-[42px] shrink-0 items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
                    active
                      ? 'border border-sky-400/40 bg-sky-400/12 text-white'
                      : 'border border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon size={16} className={active ? 'text-sky-300' : 'text-slate-400'} />
                    <span>{isPt ? labelPt : labelEn}</span>
                  </span>
                  {badge && (
                    <span className="hidden rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-slate-300 [font-variant-numeric:tabular-nums] lg:inline">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Lançadores Rápidos de Janelas no Rodapé da Sidebar (Desktop) */}
          <div className="hidden flex-col gap-1.5 border-t border-slate-400/15 pt-3 lg:flex">
            <div className="px-2 text-[11px] font-medium text-slate-400">
              {isPt ? 'Abrir Janelas da Sala' : 'Open Room Views'}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {PROJECTOR_OUT_IDS.map((outId) => {
                const count = projectionState.outputs[outId].surfaces.length;
                return (
                  <a
                    key={outId}
                    href={`?view=projector&out=${outId}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex min-h-[34px] items-center justify-between rounded-lg border px-2.5 text-[11px] font-semibold transition [font-variant-numeric:tabular-nums] ${
                      count > 0
                        ? 'border-slate-400/20 bg-[#0b1222] text-slate-100 hover:border-sky-400/40'
                        : 'border-slate-400/10 bg-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <span>Out {outId}</span>
                    <ExternalLink size={11} />
                  </a>
                );
              })}
            </div>
            <a
              href="?view=simulator"
              target="_blank"
              rel="noreferrer"
              className="flex min-h-[34px] items-center justify-between rounded-lg border border-slate-400/15 bg-[#0b1222] px-2.5 text-[11px] font-medium text-slate-300 hover:text-white"
            >
              <span>{isPt ? 'Simulador 3D' : '3D Simulator'}</span>
              <ExternalLink size={11} />
            </a>
            <a
              href="?view=controller"
              target="_blank"
              rel="noreferrer"
              className="flex min-h-[34px] items-center justify-between rounded-lg border border-slate-400/15 bg-[#0b1222] px-2.5 text-[11px] font-medium text-slate-300 hover:text-white"
            >
              <span>{isPt ? 'Controle Tablet' : 'Tablet Controller'}</span>
              <ExternalLink size={11} />
            </a>
          </div>
        </aside>

        {/* Área Principal com Rolagem Dedicada e Visível (.admin-scroll) */}
        <main className="admin-scroll min-h-0 flex-1 p-4 pb-20 lg:p-5 lg:pb-16">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-4">
            {/* =================================================================
                MÓDULO 1: VISÃO GERAL (COCKPIT UNIFICADO DA SALA INTEIRA)
               ================================================================= */}
            {activeModule === 'overview' && (
              <>
                {/* Faixa Única de Telemetria de 4 Células (Hairline Dividers — Zero SaaS Card Soup) */}
                <section className="grid grid-cols-1 divide-y divide-slate-400/15 rounded-xl border border-slate-400/15 bg-[#080d19] sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
                  <div className="flex items-center justify-between p-3.5">
                    <div>
                      <div className="text-xs text-slate-400">
                        {isPt ? 'Topologia de Vídeo' : 'Video Topology'}
                      </div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-50">
                        {presetLabel(projectionState.preset)}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400 [font-variant-numeric:tabular-nums]">
                        {activeOutputsCount} {isPt ? 'saídas ativas' : 'active outs'} ·{' '}
                        {projectionState.globalBlackout
                          ? 'BLACKOUT'
                          : anyGridActive
                            ? 'GRID ON'
                            : 'LIVE #000'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModule('projection')}
                      className="min-h-[32px] rounded-lg border border-slate-400/20 bg-[#0b1222] px-2.5 text-[11px] font-semibold text-sky-300 hover:bg-sky-400/10"
                    >
                      {isPt ? 'Configurar' : 'Configure'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3.5">
                    <div>
                      <div className="text-xs text-slate-400">
                        {isPt ? 'Palco Acústico 8D' : '8D Acoustic Stage'}
                      </div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-50 [font-variant-numeric:tabular-nums]">
                        {audioMode === 'room3'
                          ? '3 Caixas VBAP'
                          : audioMode === 'hrtf'
                            ? 'Fone 8D HRTF'
                            : 'Surround 5.1'}{' '}
                        · {Math.round(masterGain * 100)}%
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400 [font-variant-numeric:tabular-nums]">
                        Ref: C{speakerSlotIdToIndex(speakerCalibration.referenceSpeakerId)} ·{' '}
                        {calibTestMode.kind === 'off'
                          ? isPt
                            ? 'Calibração pronta'
                            : 'Ready'
                          : isPt
                            ? 'Sinal de teste ativo'
                            : 'Test signal active'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModule('audio')}
                      className="min-h-[32px] rounded-lg border border-slate-400/20 bg-[#0b1222] px-2.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-400/10"
                    >
                      {isPt ? 'Abrir Mesa' : 'Open Mixer'}
                    </button>
                  </div>

                  <div className="flex flex-col justify-center p-3.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-100">
                        {country ? (isPt ? country.namePt : country.nameEn) : '—'}
                      </span>
                      <span className="text-slate-400 [font-variant-numeric:tabular-nums]">
                        {playback.keyRoot} · {playback.bpm} BPM · {playback.activeChord}
                      </span>
                    </div>
                    {/* 4 Barras VU Compactas da Sessão */}
                    <div className="mt-2 grid grid-cols-4 gap-1.5">
                      {(
                        [
                          ['melody', LAYER_METAS.melody.accentHex, 'MEL'],
                          ['chords', LAYER_METAS.chords.accentHex, 'CHD'],
                          ['bass', LAYER_METAS.bass.accentHex, 'BAS'],
                          ['wind', LAYER_METAS.wind.accentHex, 'WND'],
                        ] as const
                      ).map(([k, hex, tag]) => (
                        <div key={k} className="flex flex-col gap-1">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#0b1222]">
                            <div
                              className="h-full rounded-full transition-all duration-150"
                              style={{
                                width: `${Math.round(Math.min(1, audioLevels[k]) * 100)}%`,
                                backgroundColor: hex,
                              }}
                            />
                          </div>
                          <span className="text-[9px] font-semibold text-slate-400">{tag}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3.5">
                    <div>
                      <div className="text-xs text-slate-400">
                        {isPt ? 'Rede da Sala & Lote' : 'Room LAN & Batch'}
                      </div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-50 [font-variant-numeric:tabular-nums]">
                        {selectedHostIp || 'localhost'}:{lanInfo.port}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400 [font-variant-numeric:tabular-nums]">
                        {lanInfo.renderedCountryCount}/177 {isPt ? 'países' : 'countries'} ·{' '}
                        {lanClients.length} {isPt ? 'nós WS' : 'WS nodes'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModule('network')}
                      className="min-h-[32px] rounded-lg border border-slate-400/20 bg-[#0b1222] px-2.5 text-[11px] font-semibold text-slate-200 hover:bg-white/[0.06]"
                    >
                      QR / LAN
                    </button>
                  </div>
                </section>

                {/* Grid Principal da Visão Geral: Mini-Canto Ao Vivo / Planta 2D (5 cols) + Operação Rápida (7 cols) */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                  {/* Monitor Ao Vivo da Sala (Mini-Canto 3D + Saída C1/C2/C3 ou Planta Acústica 2D) */}
                  <section className="flex flex-col justify-between rounded-xl border border-slate-400/15 bg-[#080d19] p-4 lg:col-span-5">
                    <div>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="inline-flex rounded-lg border border-slate-400/15 bg-[#0b1222] p-0.5">
                          <button
                            type="button"
                            onClick={() => setOverviewStageMode('mini3d')}
                            className={`min-h-[30px] rounded-md px-2.5 text-xs font-semibold transition ${
                              overviewStageMode === 'mini3d'
                                ? 'bg-sky-400/20 text-sky-200'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {isPt ? 'Mini-Canto 3D Ao Vivo' : 'Live 3D Corner'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setOverviewStageMode('stage2d')}
                            className={`min-h-[30px] rounded-md px-2.5 text-xs font-semibold transition ${
                              overviewStageMode === 'stage2d'
                                ? 'bg-sky-400/20 text-sky-200'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {isPt ? 'Planta 2D VBAP' : '2D VBAP Map'}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setActiveModule('cues')}
                          className="inline-flex min-h-[30px] items-center gap-1 rounded-lg border border-amber-400/35 bg-amber-400/10 px-2.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-400/20"
                        >
                          <Film size={12} />
                          <span>{isPt ? 'Cue Player & A⇄B' : 'Cue Player & A⇄B'}</span>
                        </button>
                      </div>

                      {overviewStageMode === 'mini3d'
                        ? renderLiveRoomAndSpeakerMonitor('h-[280px]')
                        : renderInteractiveRoomStage(true)}
                    </div>

                    {/* Seleção rápida do modo de saída */}
                    <div className="mt-4 grid grid-cols-3 gap-1.5 border-t border-slate-400/15 pt-3">
                      {(
                        [
                          ['room3', isPt ? '3 Caixas VBAP' : '3 Speakers VBAP'],
                          ['hrtf', isPt ? 'Fone 8D HRTF' : '8D Headphones'],
                          ['5.1', 'Surround 5.1'],
                        ] as [AudioOutputMode, string][]
                      ).map(([m, label]) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setAudioMode(m)}
                          className={`min-h-[38px] rounded-lg border px-2 text-xs font-semibold transition ${
                            audioMode === m
                              ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-100'
                              : 'border-slate-400/15 bg-[#0b1222] text-slate-300 hover:text-white'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Coluna Direita: Roteamento Rápido de Projetores + Resumo das 3 Caixas + QR Tablet */}
                  <div className="flex flex-col gap-4 lg:col-span-7">
                    {/* Bloco Rápido de Projetores */}
                    <section className="rounded-xl border border-slate-400/15 bg-[#080d19] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-400/15 pb-3">
                        <h2 className="text-sm font-semibold text-slate-100">
                          {isPt
                            ? 'Modo dos Projetores (Troca Instantânea)'
                            : 'Projector Mode (Instant Switch)'}
                        </h2>
                        <div className="flex flex-wrap gap-1.5">
                          {(
                            [
                              ['3-projectors', isPt ? '3 Proj (1/Parede)' : '3 Proj (1/Wall)'],
                              ['2-projectors', isPt ? '2 Proj (Canto+Teto)' : '2 Proj (L+Ceil)'],
                              ['1-projector', isPt ? '1 Proj Único' : '1 Single Proj'],
                            ] as const
                          ).map(([presetId, label]) => (
                            <button
                              key={presetId}
                              type="button"
                              onClick={() => selectProjectionPreset(presetId)}
                              className={`min-h-[32px] rounded-lg border px-2.5 text-[11px] font-semibold transition ${
                                projectionState.preset === presetId
                                  ? 'border-sky-400/60 bg-sky-400/15 text-sky-100'
                                  : 'border-slate-400/15 bg-[#0b1222] text-slate-300 hover:text-white'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 divide-y divide-slate-400/10">
                        {PROJECTOR_OUT_IDS.map((outId) => {
                          const cfg = projectionState.outputs[outId];
                          return (
                            <div
                              key={outId}
                              className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="inline-flex h-6 w-12 items-center justify-center rounded bg-[#0b1222] font-bold text-slate-200 [font-variant-numeric:tabular-nums]">
                                  OUT {outId}
                                </span>
                                {cfg.surfaces.length === 0 ? (
                                  <span className="text-slate-500">
                                    {isPt ? 'Sem superfície (Standby)' : 'Unassigned (Standby)'}
                                  </span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {cfg.surfaces.map((sId) => (
                                      <span
                                        key={sId}
                                        className="rounded border border-slate-400/20 bg-[#0b1222] px-2 py-0.5 text-[11px] font-medium text-slate-200"
                                      >
                                        {isPt
                                          ? SURFACE_UI_META[sId].shortPt
                                          : SURFACE_UI_META[sId].shortEn}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateOutputConfig(outId, { showGrid: !cfg.showGrid })
                                  }
                                  className={`min-h-[30px] rounded-lg border px-2 text-[11px] font-semibold transition ${
                                    cfg.showGrid || projectionState.showGrid
                                      ? 'border-amber-400/60 bg-amber-400/15 text-amber-200'
                                      : 'border-slate-400/15 bg-[#0b1222] text-slate-400 hover:text-slate-200'
                                  }`}
                                >
                                  {isPt ? 'Grade' : 'Grid'}
                                </button>
                                <a
                                  href={`?view=projector&out=${outId}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex min-h-[30px] items-center gap-1 rounded-lg border border-slate-400/20 bg-[#0b1222] px-2.5 text-[11px] font-semibold text-slate-200 hover:border-sky-400/40 hover:text-white"
                                >
                                  <span>{isPt ? 'Abrir' : 'Open'}</span>
                                  <ExternalLink size={11} />
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    {/* Resumo Compacto das 3 Caixas + QR do Tablet lado a lado */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                      <section className="rounded-xl border border-slate-400/15 bg-[#080d19] p-4 md:col-span-7">
                        <div className="mb-2.5 flex items-center justify-between">
                          <h2 className="text-sm font-semibold text-slate-100">
                            {isPt ? 'Canais das 3 Caixas' : '3 Speaker Channels'}
                          </h2>
                          <button
                            type="button"
                            onClick={() => setActiveModule('audio')}
                            className="text-xs font-semibold text-sky-300 hover:underline"
                          >
                            {isPt ? 'Calibração completa' : 'Full calibration'}
                          </button>
                        </div>

                        <div className="divide-y divide-slate-400/10">
                          {SPEAKER_IDS.map((spkId, idx) => {
                            const spk = speakerCalibration.speakers[spkId];
                            const isPink =
                              calibTestMode.kind === 'pink-single' &&
                              calibTestMode.speakerId === spkId;
                            return (
                              <div
                                key={spkId}
                                className="flex items-center justify-between gap-2 py-2 text-xs"
                              >
                                <div>
                                  <div className="font-semibold text-slate-100">
                                    C{idx + 1} · {isPt ? spk.shortLabelPt : spk.shortLabelEn}
                                  </div>
                                  <div className="text-[11px] text-slate-400 [font-variant-numeric:tabular-nums]">
                                    {Math.round(spk.calibrationGain * 100)}% · {spk.delayMs} ms ·{' '}
                                    {spk.routeTarget === 'lan-node' ? 'Nó LAN' : 'Local'}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      isPink
                                        ? stopCalibrationSignal()
                                        : startPinkNoiseSingle(spkId)
                                    }
                                    className={`min-h-[30px] rounded-lg border px-2.5 text-[11px] font-semibold transition ${
                                      isPink
                                        ? 'border-emerald-300 bg-emerald-400 text-slate-950'
                                        : 'border-slate-400/20 bg-[#0b1222] text-slate-300 hover:text-white'
                                    }`}
                                  >
                                    {isPink ? 'Stop' : isPt ? 'Rosa' : 'Pink'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateSpeakerConfig(spkId, { muted: !spk.muted })
                                    }
                                    className={`min-h-[30px] rounded-lg border px-2 text-[11px] font-semibold transition ${
                                      spk.muted
                                        ? 'border-rose-400/60 bg-rose-500/20 text-rose-200'
                                        : 'border-slate-400/20 bg-[#0b1222] text-slate-400 hover:text-white'
                                    }`}
                                  >
                                    {spk.muted ? 'Muted' : 'Mute'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>

                      {/* Pareamento Rápido do Tablet */}
                      <section className="flex flex-col items-center justify-between rounded-xl border border-slate-400/15 bg-[#080d19] p-4 text-center md:col-span-5">
                        <div className="text-xs font-semibold text-slate-200">
                          {isPt ? 'QR Controle Tablet (LAN)' : 'Tablet QR Pairing'}
                        </div>
                        <div className="my-2 rounded-xl bg-white p-2.5">
                          <svg
                            viewBox={`0 0 ${qrModules.length + 4} ${qrModules.length + 4}`}
                            className="h-28 w-28"
                            role="img"
                            aria-label="Tablet QR Code"
                          >
                            <rect
                              x={0}
                              y={0}
                              width={qrModules.length + 4}
                              height={qrModules.length + 4}
                              fill="#ffffff"
                            />
                            {qrModules.map((row, r) =>
                              row.map((dark, c) =>
                                dark ? (
                                  <rect
                                    key={`${r}-${c}`}
                                    x={c + 2}
                                    y={r + 2}
                                    width={1}
                                    height={1}
                                    fill="#050811"
                                  />
                                ) : null
                              )
                            )}
                          </svg>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyText('overview-qr', tabletUrl)}
                          className="inline-flex min-h-[32px] w-full items-center justify-center gap-1.5 rounded-lg border border-slate-400/20 bg-[#0b1222] px-2.5 text-[11px] font-semibold text-slate-200 hover:text-white"
                        >
                          {copiedKey === 'overview-qr' ? (
                            <Check size={12} className="text-emerald-400" />
                          ) : (
                            <Copy size={12} />
                          )}
                          <span>
                            {copiedKey === 'overview-qr'
                              ? isPt
                                ? 'Link copiado'
                                : 'Copied'
                              : isPt
                                ? 'Copiar Link do Tablet'
                                : 'Copy Tablet URL'}
                          </span>
                        </button>
                      </section>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* =================================================================
                MÓDULO 1.5: CUE PLAYER, MINI-CANTO AO VIVO & COMPARADOR PAÍS A ⇄ B
               ================================================================= */}
            {activeModule === 'cues' && (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-12" data-testid="admin-cues-module">
                {/* Coluna Esquerda (5 cols): Display Mini-Canto Ao Vivo + Verificador C1/C2/C3 + Coordenadas */}
                <div className="flex flex-col gap-4 xl:col-span-5">
                  <section className="rounded-xl border border-slate-400/15 bg-[#080d19] p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-100">
                          {isPt
                            ? 'Monitor Ao Vivo do Quarto (2 Paredes + Teto)'
                            : 'Live Room Display (2 Walls + Ceiling)'}
                        </h2>
                        <p className="text-xs text-slate-400">
                          {isPt
                            ? 'Inspecione as animações da Shay e confira em tempo real de qual caixa o áudio 8D está saindo.'
                            : 'Inspect live room animations and verify which physical speaker outputs the 8D audio.'}
                        </p>
                      </div>
                      <span className="rounded-md border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-[11px] font-semibold text-sky-200 [font-variant-numeric:tabular-nums]">
                        C{playback.bar + 1}.{playback.beat + 1} · {playback.bpm} BPM
                      </span>
                    </div>

                    {renderLiveRoomAndSpeakerMonitor('h-[340px]')}

                    {/* Telemetria Fina das Coordenadas Geográficas (source_x, source_y) na Batida */}
                    <div className="mt-3 rounded-xl border border-slate-400/15 bg-[#060a14] p-3">
                      <div className="mb-1.5 flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-300">
                          {isPt
                            ? 'Eventos Georreferenciados na Batida Atual'
                            : 'Georeferenced Events on Current Beat'}
                        </span>
                        <span className="text-slate-400 [font-variant-numeric:tabular-nums]">
                          {playback.keyRoot} · {playback.activeChord} · Vento {playback.windMeanSpeed} m/s
                        </span>
                      </div>

                      {liveEvents.length === 0 ? (
                        <div className="text-[11px] text-slate-500">
                          {isPt
                            ? 'Clique em qualquer uma das 32 batidas ao lado ou aperte Play para auditar os vetores (x, y) nas caixas.'
                            : 'Click any of the 32 beats or press Play to audit (x, y) spatial vectors across speakers.'}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {liveEvents.map((ev, i) => {
                            const dotHex =
                              ev.layer === 'melody' || ev.layer === 'sparkle'
                                ? '#fbbf24'
                                : ev.layer === 'chords'
                                  ? '#fb923c'
                                  : '#34d399';
                            return (
                              <span
                                key={`${ev.layer}-${i}`}
                                className="inline-flex items-center gap-1.5 rounded-md border border-slate-400/15 bg-[#0b1222] px-2 py-1 text-[11px] text-slate-200 [font-variant-numeric:tabular-nums]"
                              >
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: dotHex }}
                                />
                                <span className="font-semibold uppercase">{ev.layer}</span>
                                <span className="text-slate-400">
                                  x:{ev.source_x.toFixed(2)} y:{ev.source_y.toFixed(2)}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                {/* Coluna Direita (7 cols): Comparador A⇄B na Mesma Batida + Cue Player 32 Batidas + Quadros */}
                <div className="flex flex-col gap-4 xl:col-span-7">
                  {/* 1. Comparador Científico Instantâneo País A ⇄ País B na Mesma Batida */}
                  <section
                    className="rounded-xl border border-slate-400/15 bg-[#080d19] p-4"
                    data-testid="country-ab-comparator"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-400/15 pb-3">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-100">
                          {isPt
                            ? 'Comparador Instantâneo País A ⇄ País B na Mesma Batida'
                            : 'Same-Beat Country A ⇄ Country B Comparator'}
                        </h2>
                        <p className="text-xs text-slate-400">
                          {isPt
                            ? 'Troca os 5 PNGs, BPM, escala e espacialização 8D mantendo exatamente o compasso e a batida atuais.'
                            : 'Swaps all 5 PNGs, BPM, musical mode, and 8D audio without resetting the current bar or beat.'}
                        </p>
                      </div>

                      {/* Atalhos Rápidos de Duplas Piloto */}
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            ['076', '818', 'Brasil ⇄ Egito'],
                            ['076', '156', 'Brasil ⇄ China'],
                            ['818', '156', 'Egito ⇄ China'],
                          ] as const
                        ).map(([idA, idB, label]) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => {
                              setCompareSlot('A', idA);
                              setCompareSlot('B', idB);
                              if (country?.id !== idA && country?.id !== idB) {
                                selectCountryPreserveBeat(idA);
                              }
                            }}
                            className="min-h-[30px] rounded-lg border border-slate-400/20 bg-[#0b1222] px-2.5 text-[11px] font-semibold text-slate-300 hover:border-sky-400/40 hover:text-white"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3.5 grid grid-cols-1 items-stretch gap-3 md:grid-cols-11">
                      {/* Deck A */}
                      <div
                        className={`flex flex-col justify-between rounded-xl border p-3 md:col-span-4 ${
                          country?.id === compareCountries.slotA
                            ? 'border-amber-400/60 bg-amber-400/[0.07]'
                            : 'border-slate-400/15 bg-[#0b1222]'
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-200">PAÍS A</span>
                          <button
                            type="button"
                            onClick={() => selectCountryPreserveBeat(compareCountries.slotA)}
                            className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                              country?.id === compareCountries.slotA
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-white/[0.06] text-slate-300 hover:text-white'
                            }`}
                          >
                            {country?.id === compareCountries.slotA
                              ? isPt
                                ? 'NO AR'
                                : 'LIVE'
                              : isPt
                                ? 'Ativar A'
                                : 'Cue A'}
                          </button>
                        </div>
                        <select
                          aria-label="País A"
                          value={compareCountries.slotA}
                          onChange={(e) => setCompareSlot('A', e.target.value)}
                          className="h-9 w-full rounded-lg border border-slate-400/20 bg-[#070c18] px-2.5 text-xs font-medium text-slate-100"
                        >
                          {allCountries.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.isPilot ? '★ ' : ''}
                              {isPt ? c.namePt : c.nameEn}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Botão Central Tátil de Virada na Mesma Batida */}
                      <div className="flex flex-col items-center justify-center md:col-span-3">
                        <button
                          type="button"
                          onClick={swapCompareCountries}
                          className="flex min-h-[54px] w-full flex-col items-center justify-center gap-0.5 rounded-xl border border-sky-400/60 bg-sky-400/15 px-3 py-2 text-xs font-bold text-sky-100 transition hover:bg-sky-400/25"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <ArrowLeftRight size={14} />
                            <span>{isPt ? 'Virar A ⇄ B' : 'Flip A ⇄ B'}</span>
                          </span>
                          <span className="text-[10px] font-medium text-sky-300 [font-variant-numeric:tabular-nums]">
                            {isPt ? 'Manter' : 'Keep'} C{playback.bar + 1}.{playback.beat + 1} (
                            {currentBeatGlobal + 1}/32)
                          </span>
                        </button>
                      </div>

                      {/* Deck B */}
                      <div
                        className={`flex flex-col justify-between rounded-xl border p-3 md:col-span-4 ${
                          country?.id === compareCountries.slotB
                            ? 'border-amber-400/60 bg-amber-400/[0.07]'
                            : 'border-slate-400/15 bg-[#0b1222]'
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-200">PAÍS B</span>
                          <button
                            type="button"
                            onClick={() => selectCountryPreserveBeat(compareCountries.slotB)}
                            className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                              country?.id === compareCountries.slotB
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-white/[0.06] text-slate-300 hover:text-white'
                            }`}
                          >
                            {country?.id === compareCountries.slotB
                              ? isPt
                                ? 'NO AR'
                                : 'LIVE'
                              : isPt
                                ? 'Ativar B'
                                : 'Cue B'}
                          </button>
                        </div>
                        <select
                          aria-label="País B"
                          value={compareCountries.slotB}
                          onChange={(e) => setCompareSlot('B', e.target.value)}
                          className="h-9 w-full rounded-lg border border-slate-400/20 bg-[#070c18] px-2.5 text-xs font-medium text-slate-100"
                        >
                          {allCountries.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.isPilot ? '★ ' : ''}
                              {isPt ? c.namePt : c.nameEn}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </section>

                  {/* 2. Diretor de Quadros Reais da Shay (10 Fases/Quadros + Prompts Somente Leitura) */}
                  <section
                    className="rounded-xl border border-slate-400/15 bg-[#080d19] p-4"
                    data-testid="shay-frames-director"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-400/15 pb-3">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-100">
                          {isPt
                            ? 'Diretor de Quadros da Shay (10 Fases Reais) & Prompts'
                            : "Shay's Scene Frame Director (10 Real Phases) & Prompts"}
                        </h2>
                        <p className="text-xs text-slate-400">
                          {isPt
                            ? 'Teste cada quadro da jornada de forma independente nas 2 paredes + teto e visualize as falas reais do Robozinho.'
                            : 'Test each mission frame independently across 2 walls + ceiling and inspect the exact robot prompts.'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={replayActiveFrame}
                          className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-slate-400/20 bg-[#0b1222] px-2.5 text-xs font-semibold text-slate-200 hover:border-sky-400/50 hover:text-white"
                          title={
                            isPt
                              ? 'Reinicia as animações deste quadro (ex.: contagem 5..1 ou cabine 4s)'
                              : 'Restart animations for the active frame'
                          }
                        >
                          <RotateCcw size={13} />
                          <span>{isPt ? 'Reiniciar Animação' : 'Replay Frame'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (isAutoSequencePlaying) {
                              setIsAutoSequencePlaying(false);
                            } else {
                              if (activeFrameId === 'ended') {
                                activateMissionFrame('idle');
                              }
                              setIsAutoSequencePlaying(true);
                            }
                          }}
                          className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition ${
                            isAutoSequencePlaying
                              ? 'bg-rose-500 text-white hover:bg-rose-400'
                              : 'bg-sky-400 text-slate-950 hover:bg-sky-300'
                          }`}
                        >
                          {isAutoSequencePlaying ? <Square size={12} /> : <Play size={13} />}
                          <span>
                            {isAutoSequencePlaying
                              ? isPt
                                ? 'Parar Sequência'
                                : 'Stop Sequence'
                              : isPt
                                ? 'Rodar Sequência Completa'
                                : 'Play Full Sequence'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Grade dos 12 Quadros Reais (incluindo 1 cena por camada) */}
                    <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                      {SHAY_MISSION_FRAMES.map((frame) => {
                        const isActive = activeFrameId === frame.id;
                        return (
                          <button
                            key={frame.id}
                            type="button"
                            onClick={() => {
                              setIsAutoSequencePlaying(false);
                              activateMissionFrame(frame.phase, frame.storyStep, frame.focusLayer);
                            }}
                            className={`flex flex-col items-start justify-between rounded-xl border p-2.5 text-left transition ${
                              isActive
                                ? 'border-amber-400/70 bg-amber-400/12 text-amber-100'
                                : 'border-slate-400/15 bg-[#0b1222] text-slate-300 hover:border-sky-400/40 hover:text-white'
                            }`}
                          >
                            <span className="text-[11px] font-semibold leading-tight">
                              {isPt ? frame.titlePt : frame.titleEn}
                            </span>
                            <span className="mt-1 text-[10px] text-slate-400">
                              {frame.phase}
                              {typeof frame.storyStep === 'number' ? ` · step ${frame.storyStep}` : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Visualizador Somente Leitura do Quadro Ativo & Prompts Reais */}
                    {(() => {
                      const firstLayer =
                        VISUAL_LAYER_ORDER.find((id) => layers[id].enabled) ?? 'melody';
                      const layerMeta = LAYER_METAS[firstLayer];
                      const prompts = resolveFramePrompts(activeFrameId, {
                        lang,
                        countryName: country
                          ? isPt
                            ? country.namePt
                            : country.nameEn
                          : isPt
                            ? 'a Terra'
                            : 'Earth',
                        activeLayerLabel: isPt ? layerMeta.labelPt : layerMeta.labelEn,
                        bpm: playback.bpm,
                        keyRoot: playback.keyRoot,
                        keyRootPt: playback.keyRootPt,
                        activeChord: playback.activeChord,
                        windMeanSpeed: playback.windMeanSpeed,
                      });

                      return (
                        <div className="mt-3.5 rounded-xl border border-slate-400/15 bg-[#060a14] p-3.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-400/15 pb-2.5">
                            <span className="text-xs font-semibold text-slate-100">
                              {isPt ? activeFrameSpec.titlePt : activeFrameSpec.titleEn}
                            </span>
                            {prompts.spoken && (
                              <button
                                type="button"
                                onClick={() => speakTextPt(prompts.spoken, true, { maleVoice: true })}
                                className="inline-flex min-h-[28px] items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-400/20"
                              >
                                <Volume2 size={12} />
                                <span>{isPt ? 'Ouvir Fala (TTS)' : 'Preview Voice (TTS)'}</span>
                              </button>
                            )}
                          </div>

                          {/* O que aparece nas 3 superfícies neste quadro */}
                          <div className="mt-2.5 grid grid-cols-1 gap-2 md:grid-cols-3">
                            <div className="rounded-lg border border-sky-400/20 bg-[#0b1222] p-2">
                              <div className="text-[10px] font-bold uppercase text-sky-300">
                                {isPt ? 'Parede Esquerda' : 'Left Wall'}
                              </div>
                              <div className="mt-0.5 text-[11px] text-slate-300">
                                {isPt ? activeFrameSpec.leftWallPt : activeFrameSpec.leftWallEn}
                              </div>
                            </div>
                            <div className="rounded-lg border border-amber-400/20 bg-[#0b1222] p-2">
                              <div className="text-[10px] font-bold uppercase text-amber-300">
                                {isPt ? 'Parede Direita' : 'Right Wall'}
                              </div>
                              <div className="mt-0.5 text-[11px] text-slate-300">
                                {isPt ? activeFrameSpec.rightWallPt : activeFrameSpec.rightWallEn}
                              </div>
                            </div>
                            <div className="rounded-lg border border-emerald-400/20 bg-[#0b1222] p-2">
                              <div className="text-[10px] font-bold uppercase text-emerald-300">
                                {isPt ? 'Teto' : 'Ceiling'}
                              </div>
                              <div className="mt-0.5 text-[11px] text-slate-300">
                                {isPt ? activeFrameSpec.ceilingPt : activeFrameSpec.ceilingEn}
                              </div>
                            </div>
                          </div>

                          {/* Prompts Reais (Balão + TTS) */}
                          <div className="mt-2.5 grid grid-cols-1 gap-2 md:grid-cols-2">
                            <div className="rounded-lg border border-slate-400/15 bg-[#0b1222] p-2.5">
                              <div className="text-[10px] font-bold uppercase text-slate-400">
                                {isPt ? 'Prompt do Balão (phrases)' : 'Bubble Prompt (phrases)'}
                              </div>
                              <ul className="mt-1 space-y-1 text-[11px] text-slate-200">
                                {prompts.phrases.map((line, idx) => (
                                  <li key={idx} className="leading-snug">
                                    • {line}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <div className="rounded-lg border border-slate-400/15 bg-[#0b1222] p-2.5">
                              <div className="text-[10px] font-bold uppercase text-slate-400">
                                {isPt ? 'Prompt de Voz TTS (spoken)' : 'Voice Prompt TTS (spoken)'}
                              </div>
                              <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                                {prompts.spoken ||
                                  (isPt ? '(Sem fala neste quadro)' : '(No voiceover in this frame)')}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Os 5 Olhinhos estilo Photoshop + Solo (S) + Tempestade */}
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-400/15 pt-3">
                      {VISUAL_LAYER_ORDER.map((layerId) => {
                        const meta = LAYER_METAS[layerId];
                        const enabled = layers[layerId].enabled;
                        const isSoloable =
                          layerId === 'melody' || layerId === 'chords' || layerId === 'bass';
                        const isSolo = isSoloable && layers[layerId].solo;

                        return (
                          <div
                            key={layerId}
                            className="inline-flex min-h-[36px] items-center rounded-xl border border-slate-400/20 bg-[#0b1222] p-0.5"
                          >
                            <button
                              type="button"
                              onClick={() => toggleEye(layerId)}
                              className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition"
                              style={{
                                color: enabled ? meta.accentHex : '#64748b',
                                backgroundColor: enabled ? `${meta.accentHex}18` : 'transparent',
                              }}
                              title={isPt ? meta.phenomenonPt : meta.phenomenonEn}
                            >
                              {enabled ? <Eye size={13} /> : <EyeOff size={13} />}
                              <span>{isPt ? meta.labelPt : meta.labelEn}</span>
                            </button>

                            {isSoloable && (
                              <button
                                type="button"
                                onClick={() => toggleSolo(layerId as SoloableLayerId)}
                                className={`mr-0.5 h-7 w-7 rounded-lg text-[11px] font-bold transition ${
                                  isSolo
                                    ? 'bg-amber-400 text-slate-950'
                                    : 'text-slate-400 hover:bg-white/10 hover:text-slate-100'
                                }`}
                                title="Solo (S)"
                              >
                                S
                              </button>
                            )}

                            {layerId === 'melody' && (
                              <button
                                type="button"
                                onClick={toggleSparkle}
                                className={`mr-0.5 inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[10px] font-semibold transition ${
                                  layers.melody.sparkleEnabled
                                    ? 'bg-amber-400/20 text-amber-200'
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                                title={isPt ? 'Sub-camada Tempestade (5ª/8ª)' : 'Storm Sparkle sub-layer'}
                              >
                                <Zap size={11} />
                                <span>5ª/8ª</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* 3. Sequenciador Real de 32 Batidas (apenas dados reais de meta.json, sem mock) */}
                  <section
                    className="rounded-xl border border-slate-400/15 bg-[#080d19] p-4"
                    data-testid="cue-player-sequencer"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-400/15 pb-3">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-100">
                          {isPt
                            ? 'Sequenciador Musical Real (32 Batidas · meta.json)'
                            : 'Real Musical Sequencer (32 Beats · meta.json)'}
                        </h2>
                        <p className="text-xs text-slate-400">
                          {isPt
                            ? 'Navegue batida por batida nos eventos reais da NASA ou trave 1 compasso em loop para auditar o áudio.'
                            : 'Step beat-by-beat through real NASA events or loop a single bar to audit audio.'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => seekBeat(0)}
                          className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-400/20 bg-[#0b1222] px-2.5 text-xs font-semibold text-slate-200 hover:text-white"
                          title={isPt ? 'Voltar ao Compasso 1.1' : 'Back to Bar 1.1'}
                        >
                          <SkipBack size={13} />
                          <span>1.1</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => stepBeat(-1)}
                          className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-400/20 bg-[#0b1222] px-2.5 text-xs font-semibold text-slate-200 hover:text-white"
                        >
                          <ChevronLeft size={14} />
                          <span>-1</span>
                        </button>

                        <button
                          type="button"
                          onClick={togglePlay}
                          className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-amber-400 px-3 text-xs font-bold text-slate-950 hover:bg-amber-300"
                        >
                          {playback.isPlaying ? <Pause size={13} /> : <Play size={13} />}
                          <span>{playback.isPlaying ? 'Pause' : 'Play'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => stepBeat(1)}
                          className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-400/20 bg-[#0b1222] px-2.5 text-xs font-semibold text-slate-200 hover:text-white"
                        >
                          <span>+1</span>
                          <ChevronRight size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setLoopSingleBar(
                              loopSingleBar === playback.bar ? null : playback.bar
                            )
                          }
                          className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition [font-variant-numeric:tabular-nums] ${
                            loopSingleBar !== null
                              ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-200'
                              : 'border-slate-400/20 bg-[#0b1222] text-slate-300 hover:text-white'
                          }`}
                        >
                          <Repeat size={13} />
                          <span>
                            {loopSingleBar !== null
                              ? `Loop C${loopSingleBar + 1}`
                              : isPt
                                ? 'Loop Compasso'
                                : 'Loop Bar'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {beatTimeline.length === 0 ? (
                      <div className="mt-4 rounded-xl border border-slate-400/15 bg-[#060a14] p-4 text-xs text-slate-400">
                        {isPt
                          ? 'Nenhum evento por batida carregado no meta.json deste país ainda (zero dados simulados).'
                          : 'No real per-beat events found in this country meta.json yet (zero mocked data).'}
                      </div>
                    ) : (
                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                        {Array.from({ length: 8 }, (_, barIdx) => {
                          const isBarLooped = loopSingleBar === barIdx;
                          const isBarCurrent = playback.bar === barIdx;
                          const barSlots = beatTimeline.slice(barIdx * 4, barIdx * 4 + 4);

                          return (
                            <div
                              key={barIdx}
                              className={`rounded-xl border p-2 transition ${
                                isBarLooped
                                  ? 'border-emerald-400/65 bg-emerald-400/[0.08]'
                                  : isBarCurrent
                                    ? 'border-amber-400/50 bg-[#0d1629]'
                                    : 'border-slate-400/15 bg-[#060a14]'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setLoopSingleBar(isBarLooped ? null : barIdx)
                                }
                                className="mb-1.5 flex w-full items-center justify-between text-[10px] font-bold text-slate-300 hover:text-white [font-variant-numeric:tabular-nums]"
                              >
                                <span>C{barIdx + 1}</span>
                                {isBarLooped && (
                                  <span className="text-[9px] text-emerald-300">LOOP</span>
                                )}
                              </button>

                              <div className="grid grid-cols-4 gap-1">
                                {barSlots.map((slot) => {
                                  const isCurrentBeat = currentBeatGlobal === slot.beat;
                                  return (
                                    <button
                                      key={slot.beat}
                                      type="button"
                                      onClick={() => seekBeat(slot.beat)}
                                      className={`flex h-11 flex-col items-center justify-between rounded-md border py-1 transition [font-variant-numeric:tabular-nums] ${
                                        isCurrentBeat
                                          ? 'border-amber-300 bg-amber-400/25 text-amber-100'
                                          : 'border-slate-400/15 bg-[#0b1222] text-slate-400 hover:border-sky-400/40 hover:text-white'
                                      }`}
                                      title={`${isPt ? 'Batida' : 'Beat'} ${slot.beat + 1}/32 (C${barIdx + 1}.${slot.beatInBar + 1})`}
                                    >
                                      <span className="text-[9px] font-semibold">
                                        {slot.beatInBar + 1}
                                      </span>
                                      <span className="flex items-center gap-0.5">
                                        {slot.hasMelody && (
                                          <span
                                            className="h-1.5 w-1.5 rounded-full"
                                            style={{ backgroundColor: '#fbbf24' }}
                                          />
                                        )}
                                        {slot.hasChords && (
                                          <span
                                            className="h-1.5 w-1.5 rounded-full"
                                            style={{ backgroundColor: '#fb923c' }}
                                          />
                                        )}
                                        {slot.hasBass && (
                                          <span
                                            className="h-1.5 w-1.5 rounded-full"
                                            style={{ backgroundColor: '#34d399' }}
                                          />
                                        )}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            )}

            {/* =================================================================
                MÓDULO 2: MATRIZ PATCHBAY DE PROJEÇÃO & CORNER-PIN REMOTO 16:9
               ================================================================= */}
            {activeModule === 'projection' && (
              <>
                {/* Presets de Topologia de 1 Clique */}
                <section className="rounded-xl border border-slate-400/15 bg-[#080d19] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-100">
                        {isPt
                          ? 'Topologia de Projetores & Matriz Patchbay (Out 1..4 × 3 Superfícies)'
                          : 'Projector Topology & Patchbay Matrix (Out 1..4 × 3 Surfaces)'}
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {isPt
                          ? 'Use 2 projetores (Canto L + Teto) ou mude em 1 clique para 3 projetores dedicados (1 por parede + teto com 100% da resolução).'
                          : 'Run 2 projectors (L-Corner + Ceiling) or switch in 1 click to 3 dedicated projectors (1 per wall + ceiling at 100% resolution).'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          [
                            '3-projectors',
                            isPt
                              ? '3 Projetores (1 p/ Parede + Teto)'
                              : '3 Projectors (1 per Wall + Ceiling)',
                          ],
                          [
                            '2-projectors',
                            isPt ? '2 Projetores (Canto L + Teto)' : '2 Projectors (L-Corner + Ceiling)',
                          ],
                          [
                            '1-projector',
                            isPt ? '1 Projetor Grande-Angular' : '1 Wide-Angle Projector',
                          ],
                        ] as const
                      ).map(([presetId, title]) => (
                        <button
                          key={presetId}
                          type="button"
                          onClick={() => selectProjectionPreset(presetId)}
                          className={`min-h-[38px] rounded-xl border px-3.5 text-xs font-semibold transition ${
                            projectionState.preset === presetId
                              ? 'border-sky-400/70 bg-sky-400/15 text-white'
                              : 'border-slate-400/20 bg-[#0b1222] text-slate-300 hover:text-white'
                          }`}
                        >
                          {title}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tabela Patchbay Livre: Out 1..4 nas linhas x 3 Superfícies nas colunas */}
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-400/15 bg-[#060a14]">
                    <table className="w-full min-w-[680px] border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-400/15 bg-[#0b1222] text-[11px] font-semibold text-slate-300">
                          <th className="px-3.5 py-2.5">{isPt ? 'Saída HDMI' : 'HDMI Output'}</th>
                          {SURFACE_IDS.map((sId) => (
                            <th key={sId} className="px-3 py-2.5 text-center">
                              <span style={{ color: SURFACE_UI_META[sId].accentHex }}>
                                {isPt
                                  ? SURFACE_UI_META[sId].shortPt
                                  : SURFACE_UI_META[sId].shortEn}
                              </span>
                              <div className="text-[10px] font-normal text-slate-400">
                                {isPt
                                  ? SURFACE_UI_META[sId].detailPt
                                  : SURFACE_UI_META[sId].detailEn}
                              </div>
                            </th>
                          ))}
                          <th className="px-3.5 py-2.5 text-right">
                            {isPt ? 'Controles da Saída' : 'Output Controls'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-400/10">
                        {PROJECTOR_OUT_IDS.map((outId) => {
                          const cfg = projectionState.outputs[outId];
                          const isSelectedForWarp = selectedWarpOut === outId;
                          return (
                            <tr
                              key={outId}
                              className={isSelectedForWarp ? 'bg-sky-400/[0.04]' : undefined}
                            >
                              <td className="px-3.5 py-2.5 font-semibold text-slate-100 [font-variant-numeric:tabular-nums]">
                                <div className="flex items-center gap-2">
                                  <span>OUT {outId}</span>
                                  {cfg.surfaces.length === 1 && (
                                    <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                                      100% Full
                                    </span>
                                  )}
                                </div>
                              </td>

                              {SURFACE_IDS.map((sId) => {
                                const assigned = cfg.surfaces.includes(sId);
                                const accent = SURFACE_UI_META[sId].accentHex;
                                return (
                                  <td key={sId} className="px-3 py-2.5 text-center">
                                    <button
                                      type="button"
                                      onClick={() => toggleOutputSurface(outId, sId)}
                                      aria-pressed={assigned}
                                      className={`inline-flex min-h-[34px] min-w-[108px] items-center justify-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition ${
                                        assigned
                                          ? 'bg-white/[0.08] text-white'
                                          : 'border-slate-400/15 bg-[#0b1222]/60 text-slate-500 hover:text-slate-300'
                                      }`}
                                      style={
                                        assigned ? { borderColor: accent, color: accent } : undefined
                                      }
                                    >
                                      {assigned ? <Check size={13} /> : null}
                                      <span>{assigned ? (isPt ? 'Ativa' : 'Active') : 'Off'}</span>
                                    </button>
                                  </td>
                                );
                              })}

                              <td className="px-3.5 py-2.5">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedWarpOut(outId)}
                                    className={`min-h-[32px] rounded-lg border px-2.5 text-[11px] font-semibold transition ${
                                      isSelectedForWarp
                                        ? 'border-sky-400/60 bg-sky-400/20 text-sky-100'
                                        : 'border-slate-400/20 bg-[#0b1222] text-slate-300 hover:text-white'
                                    }`}
                                  >
                                    Corner-Pin
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateOutputConfig(outId, { showGrid: !cfg.showGrid })
                                    }
                                    className={`min-h-[32px] rounded-lg border px-2.5 text-[11px] font-semibold transition ${
                                      cfg.showGrid
                                        ? 'border-amber-400/60 bg-amber-400/15 text-amber-200'
                                        : 'border-slate-400/20 bg-[#0b1222] text-slate-300 hover:text-white'
                                    }`}
                                  >
                                    {isPt ? 'Grade' : 'Grid'}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateOutputConfig(outId, { blackout: !cfg.blackout })
                                    }
                                    className={`min-h-[32px] rounded-lg border px-2.5 text-[11px] font-semibold transition ${
                                      cfg.blackout
                                        ? 'border-rose-400/60 bg-rose-500/20 text-rose-200'
                                        : 'border-slate-400/20 bg-[#0b1222] text-slate-300 hover:text-white'
                                    }`}
                                  >
                                    Blackout
                                  </button>

                                  <a
                                    href={`?view=projector&out=${outId}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-slate-400/25 bg-[#0c1a36] px-2.5 text-[11px] font-semibold text-sky-200 hover:border-sky-400/60 hover:text-white"
                                  >
                                    <span>{isPt ? 'Abrir Tela' : 'Open'}</span>
                                    <ExternalLink size={11} />
                                  </a>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Editor Remoto 16:9 de Corner-Pin (8 cols) + Dimensões Físicas das Paredes (4 cols) */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                  <section className="rounded-xl border border-slate-400/15 bg-[#080d19] p-4 lg:col-span-8">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-400/15 pb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-100">
                          {isPt
                            ? `Calibração Remota Corner-Pin · OUT ${selectedWarpOut}`
                            : `Remote Corner-Pin Warp Stage · OUT ${selectedWarpOut}`}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {isPt
                            ? 'Arraste os 4 cantos (TL, TR, BR, BL) aqui pelo Admin — atualiza o projetor via LAN em tempo real sem caçar o mouse no teto.'
                            : 'Drag the 4 corners (TL, TR, BR, BL) right here — updates any LAN projector live.'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {PROJECTOR_OUT_IDS.map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setSelectedWarpOut(id)}
                            className={`min-h-[32px] rounded-lg border px-2.5 text-xs font-semibold [font-variant-numeric:tabular-nums] ${
                              selectedWarpOut === id
                                ? 'border-sky-400/60 bg-sky-400/15 text-white'
                                : 'border-slate-400/15 bg-[#0b1222] text-slate-400 hover:text-white'
                            }`}
                          >
                            Out {id}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={toggleGlobalShowGrid}
                          className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold ${
                            projectionState.showGrid
                              ? 'border-amber-400/60 bg-amber-400/15 text-amber-200'
                              : 'border-slate-400/20 bg-[#0b1222] text-slate-300'
                          }`}
                        >
                          <Grid size={13} />
                          <span>{isPt ? 'Grade Global' : 'Global Grid'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => resetSingleOutputQuads(selectedWarpOut)}
                          className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-slate-400/20 bg-[#0b1222] px-2.5 text-xs text-slate-300 hover:text-white"
                        >
                          <RotateCcw size={12} />
                          <span>{isPt ? 'Resetar Out' : 'Reset Out'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Canvas 16:9 #000000 representando o projetor físico */}
                    <div
                      ref={remoteWarpRef}
                      className="relative mt-4 aspect-video w-full overflow-hidden rounded-xl border border-slate-400/25 bg-black select-none touch-none"
                    >
                      {/* Grade técnica de referência 16:9 */}
                      <svg
                        viewBox="0 0 1600 900"
                        className="pointer-events-none absolute inset-0 h-full w-full"
                      >
                        <line x1="800" y1="0" x2="800" y2="900" stroke="rgba(148,163,184,0.12)" />
                        <line x1="0" y1="450" x2="1600" y2="450" stroke="rgba(148,163,184,0.12)" />

                        {activeWarpSurfaces.map((sId) => {
                          const qKey = makeSurfaceQuadKey(selectedWarpOut, sId);
                          const q = projectionState.quads[qKey];
                          const accent = SURFACE_UI_META[sId].accentHex;
                          const pts = q.map((p) => `${p.x * 1600},${p.y * 900}`).join(' ');
                          const cx = ((q[0].x + q[1].x + q[2].x + q[3].x) / 4) * 1600;
                          const cy = ((q[0].y + q[1].y + q[2].y + q[3].y) / 4) * 900;
                          return (
                            <g key={qKey}>
                              <polygon
                                points={pts}
                                fill={`${accent}1c`}
                                stroke={accent}
                                strokeWidth="4"
                              />
                              <line
                                x1={q[0].x * 1600}
                                y1={q[0].y * 900}
                                x2={q[2].x * 1600}
                                y2={q[2].y * 900}
                                stroke={`${accent}55`}
                                strokeWidth="1.5"
                                strokeDasharray="6 6"
                              />
                              <line
                                x1={q[1].x * 1600}
                                y1={q[1].y * 900}
                                x2={q[3].x * 1600}
                                y2={q[3].y * 900}
                                stroke={`${accent}55`}
                                strokeWidth="1.5"
                                strokeDasharray="6 6"
                              />
                              <text
                                x={cx}
                                y={cy}
                                fill={accent}
                                fontSize="28"
                                fontWeight="700"
                                textAnchor="middle"
                                dominantBaseline="middle"
                              >
                                {isPt
                                  ? SURFACE_UI_META[sId].shortPt.toUpperCase()
                                  : SURFACE_UI_META[sId].shortEn.toUpperCase()}
                              </text>
                            </g>
                          );
                        })}
                      </svg>

                      {activeWarpSurfaces.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
                          {isPt
                            ? `Nenhuma superfície marcada em OUT ${selectedWarpOut}. Ative uma parede ou teto na matriz acima.`
                            : `No surface assigned to OUT ${selectedWarpOut}. Enable a wall or ceiling in the matrix above.`}
                        </div>
                      )}

                      {/* Pinos Arrastáveis TL / TR / BR / BL */}
                      {activeWarpSurfaces.map((sId) => {
                        const qKey = makeSurfaceQuadKey(selectedWarpOut, sId);
                        const q = projectionState.quads[qKey];
                        const accent = SURFACE_UI_META[sId].accentHex;
                        const labels = ['TL', 'TR', 'BR', 'BL'] as const;
                        return q.map((pt, idx) => (
                          <button
                            key={`${qKey}-${labels[idx]}`}
                            type="button"
                            onPointerDown={(e) => {
                              e.preventDefault();
                              setDraggingRemotePin({
                                quadKey: qKey,
                                cornerIdx: idx as 0 | 1 | 2 | 3,
                              });
                            }}
                            className="absolute z-20 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 bg-[#050811] text-[10px] font-bold text-white active:cursor-grabbing"
                            style={{
                              left: `${pt.x * 100}%`,
                              top: `${pt.y * 100}%`,
                              borderColor: accent,
                            }}
                            title={`${SURFACE_UI_META[sId].shortPt} · ${labels[idx]} (${Math.round(pt.x * 100)}%, ${Math.round(pt.y * 100)}%)`}
                          >
                            {labels[idx]}
                          </button>
                        ));
                      })}
                    </div>
                  </section>

                  {/* Dimensões Físicas Reais das Superfícies (cm) */}
                  <section className="flex flex-col justify-between rounded-xl border border-slate-400/15 bg-[#080d19] p-4 lg:col-span-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">
                        {isPt ? 'Dimensões Reais da Sala (cm)' : 'Physical Room Dimensions (cm)'}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {isPt
                          ? 'Alimenta a proporção exata das cenas no Simulador 3D e nos Projetores.'
                          : 'Feeds exact aspect ratios for the 3D Simulator and Projectors.'}
                      </p>

                      <div className="mt-3.5 flex flex-col gap-2.5">
                        {SURFACE_IDS.map((sId) => {
                          const dim = roomDimensions[sId];
                          const ratio = (dim.widthCm / Math.max(1, dim.heightCm)).toFixed(2);
                          return (
                            <div
                              key={sId}
                              className="rounded-xl border border-slate-400/15 bg-[#0b1222] p-3"
                            >
                              <div className="mb-2 flex items-center justify-between text-xs">
                                <span
                                  className="font-semibold"
                                  style={{ color: SURFACE_UI_META[sId].accentHex }}
                                >
                                  {isPt
                                    ? SURFACE_UI_META[sId].shortPt
                                    : SURFACE_UI_META[sId].shortEn}
                                </span>
                                <span className="text-[11px] text-slate-400 [font-variant-numeric:tabular-nums]">
                                  {ratio}:1
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                                  <span>{isPt ? 'Largura (cm)' : 'Width (cm)'}</span>
                                  <input
                                    type="number"
                                    value={dim.widthCm}
                                    onChange={(e) =>
                                      updateDimension(sId, 'widthCm', e.target.value)
                                    }
                                    className="h-9 rounded-lg border border-slate-400/20 bg-[#0c1a36] px-2.5 text-xs text-slate-100 [font-variant-numeric:tabular-nums]"
                                  />
                                </label>
                                <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                                  <span>{isPt ? 'Altura (cm)' : 'Height (cm)'}</span>
                                  <input
                                    type="number"
                                    value={dim.heightCm}
                                    onChange={(e) =>
                                      updateDimension(sId, 'heightCm', e.target.value)
                                    }
                                    className="h-9 rounded-lg border border-slate-400/20 bg-[#0c1a36] px-2.5 text-xs text-slate-100 [font-variant-numeric:tabular-nums]"
                                  />
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={resetAllProjectionQuads}
                      className="mt-4 inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-400/20 bg-[#0b1222] px-3 text-xs font-medium text-slate-300 hover:text-white"
                    >
                      <RotateCcw size={13} />
                      <span>
                        {isPt ? 'Resetar Todos os Cantos' : 'Reset All Projection Quads'}
                      </span>
                    </button>
                  </section>
                </div>
              </>
            )}

            {/* =================================================================
                MÓDULO 3: CONSOLE DSP 8D & MESA DE SOM (3 CHANNEL STRIPS + MASTER)
               ================================================================= */}
            {activeModule === 'audio' && (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                {/* Coluna Esquerda (4 cols): Planta 2D Arrastável + Modo Espacial */}
                <section className="flex flex-col justify-between rounded-xl border border-slate-400/15 bg-[#080d19] p-4 xl:col-span-4">
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-slate-100">
                        {isPt ? 'Planta Acústica 2D (Drag & Drop)' : '2D Acoustic Stage'}
                      </h2>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void unlockOutputDevices()}
                          className="inline-flex min-h-[30px] items-center gap-1 rounded-lg border border-sky-400/35 bg-sky-400/10 px-2.5 text-[11px] font-semibold text-sky-200 hover:bg-sky-400/20"
                          title={
                            isPt
                              ? 'Autoriza e escaneia caixas Bluetooth / USB conectadas neste Mac/PC'
                              : 'Unlocks and scans Bluetooth / USB speakers connected to this PC'
                          }
                        >
                          <RefreshCw size={11} />
                          <span>{isPt ? 'Detectar BT/USB' : 'Scan BT/USB'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={resetSpeakerCalibration}
                          className="inline-flex min-h-[30px] items-center gap-1 rounded-lg border border-slate-400/20 bg-[#0b1222] px-2 text-[11px] text-slate-300 hover:text-white"
                        >
                          <RotateCcw size={11} />
                          <span>Reset</span>
                        </button>
                      </div>
                    </div>

                    {renderInteractiveRoomStage(false)}
                  </div>

                  {/* Modo Espacial */}
                  <div className="mt-4 border-t border-slate-400/15 pt-3">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-300">
                      <Headphones size={14} className="text-emerald-400" />
                      <span>{isPt ? 'Motor de Espacialização' : 'Spatialization Engine'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          ['room3', isPt ? '3 Caixas VBAP' : '3 Speakers'],
                          ['hrtf', isPt ? 'Fone 8D HRTF' : '8D HRTF'],
                          ['5.1', 'Surround 5.1'],
                        ] as [AudioOutputMode, string][]
                      ).map(([mode, label]) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setAudioMode(mode)}
                          className={`min-h-[38px] rounded-lg border px-2 text-xs font-semibold transition ${
                            audioMode === mode
                              ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-100'
                              : 'border-slate-400/15 bg-[#0b1222] text-slate-300 hover:text-white'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Coluna Direita (8 cols): Mesa de Som Real — 3 Channel Strips Verticais + Master Strip */}
                <section className="rounded-xl border border-slate-400/15 bg-[#080d19] p-4 xl:col-span-8">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-400/15 pb-3">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-100">
                        {isPt
                          ? 'Mesa de Calibração Acústica (C1 · C2 · C3 · Master)'
                          : 'Acoustic Mixing Console (C1 · C2 · C3 · Master)'}
                      </h2>
                      <p className="text-xs text-slate-400">
                        {isPt
                          ? 'Iguale volumes diferentes com Ruído Rosa A/B (0–200%), compense atraso Bluetooth (0–400 ms) ou delegue uma caixa para outro PC/celular na LAN.'
                          : 'Match speaker levels with Pink Noise A/B (0–200%), align Bluetooth latency (0–400 ms), or delegate any channel to a LAN audio node.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void unlockOutputDevices()}
                        className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-400/15 px-3 text-xs font-semibold text-sky-100 hover:bg-sky-400/25"
                      >
                        <RefreshCw size={12} />
                        <span>
                          {outputSupportStatus === 'permission-needed'
                            ? isPt
                              ? 'Liberar Caixas Bluetooth / USB'
                              : 'Unlock Bluetooth / USB Speakers'
                            : isPt
                              ? `Atualizar Saídas (${outputDevices.length})`
                              : `Refresh Outputs (${outputDevices.length})`}
                        </span>
                      </button>

                      {calibTestMode.kind !== 'off' && (
                        <button
                          type="button"
                          onClick={stopCalibrationSignal}
                          className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-rose-500 px-3 text-xs font-bold text-white hover:bg-rose-400"
                        >
                          <Square size={12} />
                          <span>{isPt ? 'Parar Gerador' : 'Stop Generator'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Diagnóstico Inteligente de Permissão Bluetooth / Secure Context / Safari */}
                  {outputSupportStatus === 'permission-needed' && (
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-xs text-amber-100">
                      <div className="max-w-xl">
                        <div className="font-semibold">
                          {isPt
                            ? 'Suas caixas Bluetooth estão ocultas pela trava de privacidade do navegador'
                            : 'Your Bluetooth speakers are hidden by the browser privacy lock'}
                        </div>
                        <div className="mt-0.5 text-[11px] text-amber-200/85">
                          {isPt
                            ? 'Clique em "Liberar Caixas Bluetooth" e aceite a permissão no topo da barra para listar todas as caixas conectadas ao Mac (ex.: AL-6885, KA-8296). Dica Mac: em Ajustes → Som → Entrada, deixe selecionado "Microfone do MacBook" para manter qualidade estéreo máxima.'
                            : 'Click "Unlock Bluetooth Speakers" and allow permission so the browser lists all connected speakers.'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void unlockOutputDevices()}
                        className="min-h-[36px] shrink-0 rounded-lg bg-amber-400 px-3.5 text-xs font-bold text-slate-950 hover:bg-amber-300"
                      >
                        {isPt ? 'Liberar Caixas Bluetooth' : 'Unlock Bluetooth Speakers'}
                      </button>
                    </div>
                  )}

                  {outputSupportStatus === 'insecure-context' && (
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-400/40 bg-sky-400/10 p-3 text-xs text-sky-100">
                      <div className="max-w-xl">
                        <div className="font-semibold">
                          {isPt
                            ? 'Aberto via IP da rede local — use localhost neste Mac para ver as caixas Bluetooth'
                            : 'Opened via LAN IP — open localhost on this Mac to list Bluetooth speakers'}
                        </div>
                        <div className="mt-0.5 text-[11px] text-sky-200/85">
                          {isPt
                            ? 'Por segurança do Chrome, dispositivos de áudio Bluetooth/USB só ficam visíveis em contexto seguro (http://localhost).'
                            : 'Chrome only exposes Bluetooth/USB output devices on http://localhost or HTTPS.'}
                        </div>
                      </div>
                      <a
                        href={`http://localhost:${lanInfo.port || 5173}/?view=admin`}
                        className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg bg-sky-400 px-3.5 text-xs font-bold text-slate-950 hover:bg-sky-300"
                      >
                        <span>Abrir em localhost</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  )}

                  {outputSupportStatus === 'unsupported' && (
                    <div className="mb-3 rounded-xl border border-rose-400/35 bg-rose-500/10 p-3 text-xs text-rose-100">
                      <div className="font-semibold">
                        {isPt
                          ? 'Este navegador não suporta seleção individual por caixa (setSinkId)'
                          : 'This browser does not support per-speaker output routing (setSinkId)'}
                      </div>
                      <div className="mt-0.5 text-[11px] text-rose-200/85">
                        {isPt
                          ? 'O Safari bloqueia o envio de canais diferentes para cada caixa Bluetooth. Abra http://localhost:5173/?view=admin no Google Chrome, Brave, Edge ou Arc para escolher cada caixa separadamente.'
                          : 'Safari blocks per-speaker routing. Open http://localhost:5173/?view=admin in Chrome, Brave, Edge, or Arc.'}
                      </div>
                    </div>
                  )}

                  {outputSupportStatus === 'ready' && outputDevices.length > 0 && (
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/[0.06] px-3 py-2 text-[11px] text-emerald-200">
                      <span>
                        {isPt
                          ? `${outputDevices.length} saídas detectadas. Ao escolher uma caixa Bluetooth em C1/C2/C3, o modo "3 Caixas VBAP" ativa automaticamente.`
                          : `${outputDevices.length} outputs detected. Picking a speaker automatically enables 3-Speaker VBAP mode.`}
                      </span>
                      <span className="text-slate-400">
                        {isPt
                          ? 'Mac Entrada recomendada: Microfone (MacBook)'
                          : 'Recommended Mac Input: Built-in Mic'}
                      </span>
                    </div>
                  )}

                  {/* 4 Colunas Paralelas de Console: C1 | C2 | C3 | MASTER */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {SPEAKER_IDS.map((spkId, idx) => {
                      const spkNum = (idx + 1) as 1 | 2 | 3;
                      const spk = speakerCalibration.speakers[spkId];
                      const isRef = speakerCalibration.referenceSpeakerId === spkId;
                      const isSinglePink =
                        calibTestMode.kind === 'pink-single' && calibTestMode.speakerId === spkId;
                      const isAbPink =
                        calibTestMode.kind === 'pink-ab' && calibTestMode.targetSpeakerId === spkId;
                      const isDelayClick =
                        calibTestMode.kind === 'delay-click' &&
                        calibTestMode.targetSpeakerId === spkId;
                      const lanNodeUrl = `${baseOrigin}/?view=audio-node&spk=${spkNum}`;

                      return (
                        <div
                          key={spkId}
                          className={`flex flex-col justify-between rounded-xl border p-3 transition ${
                            isSinglePink || isAbPink || isDelayClick
                              ? 'border-emerald-400/50 bg-[#0b1628]'
                              : 'border-slate-400/15 bg-[#0b1222]'
                          }`}
                        >
                          {/* Topo do Channel Strip */}
                          <div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex h-6 w-7 items-center justify-center rounded bg-sky-400/15 text-xs font-bold text-sky-300">
                                  C{spkNum}
                                </span>
                                <span className="text-xs font-semibold text-slate-100">
                                  {isPt ? spk.shortLabelPt : spk.shortLabelEn}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setReferenceSpeaker(spkId)}
                                className={`inline-flex min-h-[26px] items-center gap-1 rounded-md border px-1.5 text-[10px] font-semibold transition ${
                                  isRef
                                    ? 'border-amber-400/60 bg-amber-400/15 text-amber-200'
                                    : 'border-slate-400/15 text-slate-400 hover:text-slate-200'
                                }`}
                                title={
                                  isPt
                                    ? 'Definir como Caixa Referência (A) para comparação A/B'
                                    : 'Set as Reference Speaker (A)'
                                }
                              >
                                <Star size={10} />
                                <span>{isRef ? 'REF A' : 'Set Ref'}</span>
                              </button>
                            </div>

                            {/* Seletor Híbrido: PC Local (setSinkId) vs Nó LAN Remoto */}
                            <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-lg bg-[#070c18] p-0.5">
                              <button
                                type="button"
                                onClick={() => updateSpeakerConfig(spkId, { routeTarget: 'local' })}
                                className={`min-h-[28px] rounded-md text-[11px] font-semibold transition ${
                                  spk.routeTarget === 'local'
                                    ? 'bg-[#12203d] text-white'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                PC Local
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateSpeakerConfig(spkId, { routeTarget: 'lan-node' })
                                }
                                className={`min-h-[28px] rounded-md text-[11px] font-semibold transition ${
                                  spk.routeTarget === 'lan-node'
                                    ? 'bg-sky-400/20 text-sky-200'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                {isPt ? 'Nó LAN' : 'LAN Node'}
                              </button>
                            </div>

                            {spk.routeTarget === 'local' ? (
                              outputSupportStatus === 'permission-needed' ? (
                                <button
                                  type="button"
                                  onClick={() => void unlockOutputDevices()}
                                  className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-amber-400/45 bg-amber-400/15 px-2 text-[11px] font-semibold text-amber-200 hover:bg-amber-400/25"
                                >
                                  <RefreshCw size={11} />
                                  <span>
                                    {isPt ? 'Liberar Caixas BT/USB' : 'Unlock BT/USB'}
                                  </span>
                                </button>
                              ) : (
                                <select
                                  value={spk.sinkDeviceId}
                                  onChange={(e) =>
                                    updateSpeakerConfig(spkId, { sinkDeviceId: e.target.value })
                                  }
                                  disabled={!isSetSinkIdSupported}
                                  className="mt-2 h-8 w-full rounded-lg border border-slate-400/20 bg-[#070c18] px-2 text-[11px] text-slate-200 disabled:opacity-50"
                                >
                                  <option value="">
                                    {isPt ? 'Saída Padrão' : 'Default Output'}
                                  </option>
                                  {outputDevices.map((dev) => (
                                    <option key={dev.deviceId} value={dev.deviceId}>
                                      {dev.label}
                                    </option>
                                  ))}
                                </select>
                              )
                            ) : (
                              <div className="mt-2 flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => copyText(`spk-${spkId}`, lanNodeUrl)}
                                  className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-sky-400/30 bg-sky-400/10 px-2 text-[11px] font-semibold text-sky-200 hover:bg-sky-400/20"
                                >
                                  {copiedKey === `spk-${spkId}` ? (
                                    <Check size={11} />
                                  ) : (
                                    <Copy size={11} />
                                  )}
                                  <span>
                                    {copiedKey === `spk-${spkId}`
                                      ? 'OK'
                                      : `Link C${spkNum}`}
                                  </span>
                                </button>
                                <a
                                  href={`?view=audio-node&spk=${spkNum}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-400/20 bg-[#070c18] text-slate-300 hover:text-white"
                                  title={lanNodeUrl}
                                >
                                  <ExternalLink size={12} />
                                </a>
                              </div>
                            )}

                            {/* Geradores de Teste Acústico do Canal */}
                            <div className="mt-2.5 flex flex-col gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  isSinglePink
                                    ? stopCalibrationSignal()
                                    : startPinkNoiseSingle(spkId)
                                }
                                className={`min-h-[32px] w-full rounded-lg border text-[11px] font-semibold transition ${
                                  isSinglePink
                                    ? 'border-emerald-300 bg-emerald-400 text-slate-950'
                                    : 'border-slate-400/20 bg-[#070c18] text-slate-200 hover:bg-white/[0.06]'
                                }`}
                              >
                                {isSinglePink
                                  ? isPt
                                    ? 'Tocando Rosa...'
                                    : 'Playing Pink...'
                                  : isPt
                                    ? 'Ruído Rosa Solo'
                                    : 'Solo Pink Noise'}
                              </button>

                              {!isRef && (
                                <div className="grid grid-cols-2 gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      isAbPink ? stopCalibrationSignal() : startPinkNoiseAB(spkId)
                                    }
                                    className={`min-h-[30px] rounded-lg border px-1.5 text-[10px] font-semibold transition ${
                                      isAbPink
                                        ? 'border-amber-300 bg-amber-400 text-slate-950'
                                        : 'border-slate-400/20 bg-[#070c18] text-slate-300 hover:text-white'
                                    }`}
                                  >
                                    {isAbPink ? 'A⇄B ON' : 'Rosa A⇄B'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      isDelayClick
                                        ? stopCalibrationSignal()
                                        : startDelayClickTest(spkId)
                                    }
                                    className={`min-h-[30px] rounded-lg border px-1.5 text-[10px] font-semibold transition ${
                                      isDelayClick
                                        ? 'border-sky-300 bg-sky-400 text-slate-950'
                                        : 'border-slate-400/20 bg-[#070c18] text-slate-300 hover:text-white'
                                    }`}
                                  >
                                    {isDelayClick ? 'Click ON' : 'Click BT'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Ganho Calibrado (0-200% c/ duplo clique 100%) + Delay BT c/ botões finos */}
                          <div className="mt-3 border-t border-slate-400/15 pt-3">
                            <div className="flex items-center justify-between text-[11px] [font-variant-numeric:tabular-nums]">
                              <span className="text-slate-400">{isPt ? 'Ganho' : 'Gain'}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateSpeakerConfig(spkId, { calibrationGain: 1.0 })
                                }
                                className="font-semibold text-emerald-300 hover:underline"
                                title={isPt ? 'Clique para voltar a 100% (0 dB)' : 'Reset to 100%'}
                              >
                                {Math.round(spk.calibrationGain * 100)}%
                              </button>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={2}
                              step={0.02}
                              value={spk.calibrationGain}
                              onChange={(e) =>
                                updateSpeakerConfig(spkId, {
                                  calibrationGain: Number(e.target.value),
                                })
                              }
                              className="mt-1 h-2 w-full accent-emerald-400"
                            />

                            {/* Compensação Delay Bluetooth (0-400 ms) */}
                            <div className="mt-3 flex items-center justify-between text-[11px] [font-variant-numeric:tabular-nums]">
                              <span className="text-slate-400">Delay BT</span>
                              <span className="font-semibold text-sky-300">{spk.delayMs} ms</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={400}
                              step={1}
                              value={spk.delayMs}
                              onChange={(e) =>
                                updateSpeakerConfig(spkId, { delayMs: Number(e.target.value) })
                              }
                              className="mt-1 h-2 w-full accent-sky-400"
                            />
                            <div className="mt-1.5 grid grid-cols-4 gap-1 [font-variant-numeric:tabular-nums]">
                              {([-5, -1, +1, +5] as const).map((delta) => (
                                <button
                                  key={delta}
                                  type="button"
                                  onClick={() =>
                                    updateSpeakerConfig(spkId, {
                                      delayMs: Math.max(0, Math.min(400, spk.delayMs + delta)),
                                    })
                                  }
                                  className="min-h-[26px] rounded border border-slate-400/15 bg-[#070c18] text-[10px] font-semibold text-slate-300 hover:text-white"
                                >
                                  {delta > 0 ? `+${delta}` : delta}
                                </button>
                              ))}
                            </div>

                            <button
                              type="button"
                              onClick={() => updateSpeakerConfig(spkId, { muted: !spk.muted })}
                              className={`mt-3 min-h-[36px] w-full rounded-lg border text-xs font-bold transition ${
                                spk.muted
                                  ? 'border-rose-400 bg-rose-500/25 text-rose-100'
                                  : 'border-slate-400/20 bg-[#070c18] text-slate-300 hover:text-white'
                              }`}
                            >
                              {spk.muted ? 'MUTED' : 'MUTE'}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* 4ª Coluna: MASTER BUS STRIP */}
                    <div className="flex flex-col justify-between rounded-xl border border-slate-400/20 bg-[#070c18] p-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-100">
                            <Speaker size={14} className="text-emerald-400" />
                            <span>MASTER BUS</span>
                          </span>
                          <span className="text-xs font-bold text-emerald-300 [font-variant-numeric:tabular-nums]">
                            {Math.round(masterGain * 100)}%
                          </span>
                        </div>

                        <div className="mt-3">
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={masterGain}
                            onChange={(e) => setMasterGain(Number(e.target.value))}
                            className="h-2 w-full accent-emerald-400"
                          />
                        </div>

                        {/* Medidores VU Vivos das Camadas NASA */}
                        <div className="mt-4 flex flex-col gap-2.5 border-t border-slate-400/15 pt-3">
                          <span className="text-[11px] font-medium text-slate-400">
                            {isPt ? 'Buses NASA Ao Vivo' : 'Live NASA Buses'}
                          </span>
                          {(
                            [
                              ['melody', LAYER_METAS.melody.accentHex, isPt ? 'Melodia' : 'Melody'],
                              ['chords', LAYER_METAS.chords.accentHex, isPt ? 'Acordes' : 'Chords'],
                              ['bass', LAYER_METAS.bass.accentHex, isPt ? 'Baixo' : 'Bass'],
                              ['wind', LAYER_METAS.wind.accentHex, isPt ? 'Vento 8D' : '8D Wind'],
                            ] as const
                          ).map(([k, hex, label]) => {
                            const pct = Math.round(Math.min(1, audioLevels[k]) * 100);
                            return (
                              <div key={k}>
                                <div className="flex justify-between text-[10px] text-slate-300 [font-variant-numeric:tabular-nums]">
                                  <span>{label}</span>
                                  <span>{pct}%</span>
                                </div>
                                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#0b1222]">
                                  <div
                                    className="h-full rounded-full transition-all duration-150"
                                    style={{ width: `${pct}%`, backgroundColor: hex }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col gap-1.5 border-t border-slate-400/15 pt-3">
                        <button
                          type="button"
                          onClick={togglePlay}
                          className="inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-lg bg-amber-400 text-xs font-bold text-slate-950 hover:bg-amber-300"
                        >
                          {playback.isPlaying ? <Pause size={13} /> : <Play size={13} />}
                          <span>{playback.isPlaying ? 'Pause' : 'Play 8D'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLocalAudioMuted(!localAudioMuted)}
                          className={`min-h-[36px] w-full rounded-lg border text-xs font-bold transition ${
                            localAudioMuted
                              ? 'border-rose-400 bg-rose-500/25 text-rose-100'
                              : 'border-slate-400/20 bg-[#0b1222] text-slate-300 hover:text-white'
                          }`}
                        >
                          {localAudioMuted
                            ? isPt
                              ? 'PC Local Mutado'
                              : 'Local PC Muted'
                            : isPt
                              ? 'Mutar Este PC'
                              : 'Mute Local PC'}
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* =================================================================
                MÓDULO 4: REDE LAN OFFLINE-FIRST, NÓS DE ÁUDIO & LOTE ~177 PAÍSES
               ================================================================= */}
            {activeModule === 'network' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                {/* Pareamento QR do Tablet + Links dos Receptores de Áudio LAN */}
                <div className="flex flex-col gap-4 lg:col-span-5">
                  <section className="flex flex-col gap-3.5 rounded-xl border border-slate-400/15 bg-[#080d19] p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                      <QrCode size={16} className="text-sky-300" />
                      <h2>
                        {isPt
                          ? 'Pareamento Offline do Tablet (Wi-Fi LAN)'
                          : 'Offline Tablet Pairing (Wi-Fi LAN)'}
                      </h2>
                    </div>

                    <div className="mx-auto flex items-center justify-center rounded-xl bg-white p-3.5">
                      <svg
                        viewBox={`0 0 ${qrModules.length + 4} ${qrModules.length + 4}`}
                        className="h-40 w-40"
                        role="img"
                        aria-label="Tablet Controller QR Code"
                      >
                        <rect
                          x={0}
                          y={0}
                          width={qrModules.length + 4}
                          height={qrModules.length + 4}
                          fill="#ffffff"
                        />
                        {qrModules.map((row, r) =>
                          row.map((dark, c) =>
                            dark ? (
                              <rect
                                key={`${r}-${c}`}
                                x={c + 2}
                                y={r + 2}
                                width={1}
                                height={1}
                                fill="#050811"
                              />
                            ) : null
                          )
                        )}
                      </svg>
                    </div>

                    {lanInfo.lanIps.length > 0 && (
                      <label className="flex flex-col gap-1 text-xs text-slate-400">
                        <span>{isPt ? 'IP da Placa Wi-Fi deste PC:' : 'Master PC Wi-Fi IP:'}</span>
                        <select
                          value={selectedHostIp}
                          onChange={(e) => setSelectedHostIp(e.target.value)}
                          className="h-9 rounded-lg border border-slate-400/20 bg-[#0c1a36] px-2.5 text-xs text-slate-100 [font-variant-numeric:tabular-nums]"
                        >
                          {lanInfo.lanIps.map((ip) => (
                            <option key={ip} value={ip}>
                              {ip}:{lanInfo.port}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={tabletUrl}
                        className="h-9 flex-1 rounded-lg border border-slate-400/20 bg-[#0c1a36] px-3 text-xs text-slate-100 [font-variant-numeric:tabular-nums]"
                      />
                      <button
                        type="button"
                        onClick={() => copyText('net-tablet', tabletUrl)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-400/20 bg-[#0b1222] px-3 text-xs font-semibold text-slate-100 hover:bg-white/[0.08]"
                      >
                        {copiedKey === 'net-tablet' ? (
                          <Check size={13} className="text-emerald-400" />
                        ) : (
                          <Copy size={13} />
                        )}
                        <span>{copiedKey === 'net-tablet' ? 'OK' : 'Copy'}</span>
                      </button>
                    </div>
                  </section>

                  {/* Links Rápidos para Nós Receptores de Áudio (Outro Notebook/Celular p/ Caixas) */}
                  <section className="rounded-xl border border-slate-400/15 bg-[#080d19] p-4">
                    <h2 className="text-sm font-semibold text-slate-100">
                      {isPt
                        ? 'Receptores LAN para Caixas Extras (?view=audio-node)'
                        : 'LAN Speaker Receiver Nodes (?view=audio-node)'}
                    </h2>
                    <p className="mt-1 text-xs text-slate-400">
                      {isPt
                        ? 'Se 1 notebook não aguentar 3 caixas Bluetooth juntas, abra um destes links em outro notebook/celular da sala:'
                        : 'If 1 laptop cannot drive 3 Bluetooth speakers at once, open one of these links on a secondary device:'}
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      {([1, 2, 3] as const).map((idx) => {
                        const url = `${baseOrigin}/?view=audio-node&spk=${idx}`;
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-2 rounded-lg border border-slate-400/15 bg-[#0b1222] px-3 py-2 text-xs"
                          >
                            <span className="truncate font-medium text-slate-200 [font-variant-numeric:tabular-nums]">
                              C{idx} · {url}
                            </span>
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => copyText(`node-${idx}`, url)}
                                className="inline-flex h-7 items-center gap-1 rounded border border-slate-400/20 px-2 text-[11px] text-slate-300 hover:text-white"
                              >
                                {copiedKey === `node-${idx}` ? (
                                  <Check size={11} className="text-emerald-400" />
                                ) : (
                                  <Copy size={11} />
                                )}
                              </button>
                              <a
                                href={`?view=audio-node&spk=${idx}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-7 items-center gap-1 rounded border border-slate-400/20 px-2 text-[11px] text-sky-300 hover:text-white"
                              >
                                <ExternalLink size={11} />
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>

                {/* Tabela de Nós Conectados + Inventário de ~177 Países */}
                <div className="flex flex-col gap-4 lg:col-span-7">
                  <section className="rounded-xl border border-slate-400/15 bg-[#080d19] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                        <Activity size={16} className="text-emerald-400" />
                        <h2>
                          {isPt
                            ? 'Dispositivos Conectados no Barramento (/ws-earth-sync)'
                            : 'Connected Room Bus Nodes (/ws-earth-sync)'}
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={fetchLanDiagnostics}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-400/20 bg-[#0b1222] px-2.5 text-xs text-slate-300 hover:text-white"
                      >
                        <RefreshCw size={12} />
                        <span>{isPt ? 'Atualizar' : 'Refresh'}</span>
                      </button>
                    </div>

                    {lanClients.length === 0 ? (
                      <div className="rounded-xl border border-slate-400/10 bg-[#0b1222] p-4 text-xs text-slate-400">
                        {isPt
                          ? 'Sincronização local BroadcastChannel ativa. Quando o servidor local (`npm run dev`) está em execução, todos os Tablets, PCs de Projetor e Nós de Áudio na rede Wi-Fi aparecem listados aqui em tempo real.'
                          : 'Local BroadcastChannel sync active. When `npm run dev` is running, all Tablets, Projector PCs, and Audio Nodes on the Wi-Fi LAN appear here live.'}
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-400/15 bg-[#060a14]">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-400/15 bg-[#0b1222] text-[11px] font-semibold text-slate-300">
                              <th className="px-3.5 py-2">{isPt ? 'Papel (Role)' : 'Role'}</th>
                              <th className="px-3.5 py-2">IP</th>
                              <th className="px-3.5 py-2">Node ID</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-400/10 [font-variant-numeric:tabular-nums]">
                            {lanClients.map((peer) => (
                              <tr key={peer.id}>
                                <td className="px-3.5 py-2.5 font-semibold text-slate-100">
                                  <span className="inline-flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                    <span>{peer.role}</span>
                                  </span>
                                </td>
                                <td className="px-3.5 py-2.5 text-slate-300">{peer.ip}</td>
                                <td className="px-3.5 py-2.5 text-slate-400">{peer.id}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  <section className="rounded-xl border border-slate-400/15 bg-[#080d19] p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                        <Database size={16} className="text-amber-400" />
                        <h2>
                          {isPt
                            ? 'Lote Pré-Gerado (~177 Países · 5 PNGs + meta.json + 8 Stems)'
                            : 'Pre-Generated Global Batch (~177 Countries)'}
                        </h2>
                      </div>
                      <span className="rounded-full border border-amber-400/35 bg-amber-400/10 px-2.5 py-0.5 text-xs font-semibold text-amber-200 [font-variant-numeric:tabular-nums]">
                        {lanInfo.renderedCountryCount} / 177
                      </span>
                    </div>

                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#0b1222]">
                      <div
                        className="h-full rounded-full bg-amber-400 transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.max(2, (lanInfo.renderedCountryCount / 177) * 100))}%`,
                        }}
                      />
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-slate-300">
                      {isPt
                        ? 'Brasil (076), Egito (818) e China (156) estão prontos para validação no Simulador 3D. Após aprovação visual, gere os ~177 países:'
                        : 'Brazil (076), Egypt (818), and China (156) are ready for validation in the 3D Simulator. Once approved, generate all ~177 countries:'}
                    </p>

                    <pre className="mt-2.5 overflow-x-auto rounded-lg border border-slate-400/15 bg-[#040710] px-3.5 py-2.5 font-mono text-xs text-emerald-300">
                      npm run gen:countries
                    </pre>
                  </section>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
