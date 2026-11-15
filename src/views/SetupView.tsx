import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Monitor,
  Sliders,
  Wifi,
} from 'lucide-react';
import { SPEAKER_IDS } from '../audio/speakerCalibration';
import {
  useAudioAdmin,
  useExperience,
  useProjectionAdmin,
} from '../experience/ExperienceContext';
import {
  resolveActiveMissionFrameId,
  SHAY_MISSION_FRAMES,
} from '../experience/missionFrames';
import {
  PILOT_COUNTRY_IDS,
  PROJECTOR_OUT_IDS,
  ProjectorOutId,
  RoomDimensions,
  SurfaceId,
} from '../experience/types';
import { encodeQrMatrix } from '../lan/qrCodeSvg';
import { buildViewUrl } from '../lan/roomCode';
import {
  QuadCorners,
} from '../projection/homography';
import { AdminNavItem, AdminSidebar } from './admin/AdminSidebar';
import { AdminModuleId, LanServerInfo } from './admin/adminMeta';
import { AudioConsoleModule } from './admin/AudioConsoleModule';
import { AudioDiagnosticsBanner } from './admin/AudioDiagnosticsBanner';
import { CockpitHeader } from './admin/CockpitHeader';
import { NetworkModule } from './admin/NetworkModule';
import { OverviewModule } from './admin/OverviewModule';
import { ProjectionModule, RemoteWarpDragTarget } from './admin/ProjectionModule';

interface SetupViewProps {
  onOpenSetupWizard?: () => void;
}

export const SetupView: React.FC<SetupViewProps> = ({ onOpenSetupWizard }) => {
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
    speakerLiveLevels,
    layers,
    toggleEye,
    setAllLayersEnabled,
    audioMode,
    setAudioMode,
    masterGain,
    setMasterGain,
    voiceVolume,
    setVoiceVolume,
    localAudioMuted,
    setLocalAudioMuted,
    audioContextState,
    realAudioRms01,
    audioOwner,
    setAudioOwner,
    audioSourceKind,
    lanConnected,
    lanClients,
    roomCode,
    syncNetworkMode,
    regenerateRoomCode,
    playback,
    liveEvents,
    audioLevels,
    lang,
    setLang,
    selectCountry,
    togglePlay,
    playWithAudibleLayers,
    unlockAudioContext,
    resetExperienceToDefault,
  } = useExperience();

  const {
    speakerCalibration,
    calibTestMode,
    calibBeatSeq,
    outputDevices,
    outputSupportStatus,
    isSetSinkIdSupported,
    speakerSinkStatuses,
    unlockOutputDevices,
    updateSpeakerConfig,
    retrySpeakerSink,
    updateAvOffsetMs,
    setReferenceSpeaker,
    resetSpeakerCalibration,
    togglePinkNoiseSpeaker,
    toggleDelayClickSpeaker,
    startPinkNoiseAll,
    startDelayClickAll,
    stopCalibrationSignal,
    refreshOutputDevices,
  } = useAudioAdmin();

  const {
    projectionState,
    selectProjectionPreset,
    toggleOutputSurface,
    updateOutputConfig,
    updateSurfaceQuad,
    translateOutputMesh,
    updateEdgeMask,
    resetSingleOutputQuads,
    resetAllProjectionQuads,
    triggerIdentifyOutputs,
    toggleGlobalBlackout,
    toggleGlobalShowGrid,
  } = useProjectionAdmin();

  const isPt = lang === 'pt';
  const [activeModule, setActiveModule] = useState<AdminModuleId>('overview');
  const [isAutoSequencePlaying, setIsAutoSequencePlaying] = useState<boolean>(false);
  const [confirmResetArmed, setConfirmResetArmed] = useState<boolean>(false);
  const [selectedWarpOut, setSelectedWarpOut] = useState<ProjectorOutId>(1);

  const [lanInfo, setLanInfo] = useState<LanServerInfo>({
    lanIps: [],
    port: 5173,
    renderedCountryCount: 3,
    renderedCountryIds: [...PILOT_COUNTRY_IDS],
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const remoteWarpRef = useRef<HTMLDivElement | null>(null);
  const [draggingRemoteWarp, setDraggingRemoteWarp] = useState<RemoteWarpDragTarget | null>(null);

  useEffect(() => {
    if (!confirmResetArmed) return;
    const t = window.setTimeout(() => setConfirmResetArmed(false), 3500);
    return () => window.clearTimeout(t);
  }, [confirmResetArmed]);

  const allSpeakersMuted = SPEAKER_IDS.every(
    (id) => speakerCalibration.speakers[id].muted
  );

  const handleShowReadyPreset = () => {
    if (projectionState.globalBlackout) toggleGlobalBlackout();
    if (projectionState.showGrid) toggleGlobalShowGrid();
    setAllLayersEnabled(true);
    if (!country) selectCountry('076');
    playWithAudibleLayers();
  };

  // Atalhos de teclado FOH (Space: Play/Pause, B: Blackout, Escape: Cortar Testes/Grades)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (playback.isPlaying) {
          togglePlay();
        } else {
          playWithAudibleLayers();
        }
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        toggleGlobalBlackout();
      } else if (e.key === 'Escape') {
        if (
          calibTestMode.kind !== 'off' ||
          projectionState.showGrid ||
          Object.values(projectionState.outputs).some((o) => o.showGrid)
        ) {
          e.preventDefault();
          stopCalibrationSignal();
          if (projectionState.showGrid) toggleGlobalShowGrid();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    calibTestMode.kind,
    playWithAudibleLayers,
    playback.isPlaying,
    projectionState.outputs,
    projectionState.showGrid,
    stopCalibrationSignal,
    toggleGlobalBlackout,
    toggleGlobalShowGrid,
    togglePlay,
  ]);

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

  const fetchLanDiagnostics = () => {
    if (
      typeof window === 'undefined' ||
      typeof window.fetch !== 'function' ||
      !window.location?.origin ||
      window.location.origin === 'null'
    ) {
      return;
    }
    const lanInfoUrl = roomCode
      ? `/api/lan-info?room=${encodeURIComponent(roomCode)}`
      : '/api/lan-info';
    window
      .fetch(lanInfoUrl)
      .then((r) => (r.ok ? (r.json() as Promise<LanServerInfo>) : null))
      .then((info) => {
        if (!info) return;
        setLanInfo(info);
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

  // Drag global no Editor Remoto 16:9 de Corner-Pin (canto, barra/aresta inteira ou malha completa)
  useEffect(() => {
    if (!draggingRemoteWarp) return;
    const edgePairs: ReadonlyArray<readonly [0 | 1 | 2 | 3, 0 | 1 | 2 | 3]> = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
    ];
    const onPointerMove = (e: PointerEvent) => {
      const el = remoteWarpRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const ny = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));

      if (draggingRemoteWarp.kind === 'corner') {
        const current = [...projectionState.quads[draggingRemoteWarp.quadKey]] as QuadCorners;
        current[draggingRemoteWarp.cornerIdx] = {
          x: Number(nx.toFixed(4)),
          y: Number(ny.toFixed(4)),
        };
        updateSurfaceQuad(draggingRemoteWarp.quadKey, current);
        return;
      }

      const rawDx = nx - draggingRemoteWarp.startMouse.x;
      const rawDy = ny - draggingRemoteWarp.startMouse.y;

      if (draggingRemoteWarp.kind === 'mesh') {
        translateOutputMesh(
          draggingRemoteWarp.outId,
          draggingRemoteWarp.startQuads,
          rawDx,
          rawDy
        );
        return;
      }

      const base = draggingRemoteWarp.startQuad;
      const activeIndices: ReadonlyArray<0 | 1 | 2 | 3> = edgePairs[draggingRemoteWarp.edgeIdx];

      const minDx = Math.max(...activeIndices.map((i) => -base[i].x));
      const maxDx = Math.min(...activeIndices.map((i) => 1 - base[i].x));
      const minDy = Math.max(...activeIndices.map((i) => -base[i].y));
      const maxDy = Math.min(...activeIndices.map((i) => 1 - base[i].y));

      const dx = Math.min(maxDx, Math.max(minDx, rawDx));
      const dy = Math.min(maxDy, Math.max(minDy, rawDy));

      const next = [...base] as QuadCorners;
      for (const i of activeIndices) {
        next[i] = {
          x: Number((base[i].x + dx).toFixed(4)),
          y: Number((base[i].y + dy).toFixed(4)),
        };
      }
      updateSurfaceQuad(draggingRemoteWarp.quadKey, next);
    };
    const onPointerUp = () => setDraggingRemoteWarp(null);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [draggingRemoteWarp, projectionState.quads, translateOutputMesh, updateSurfaceQuad]);

  const baseOrigin = useMemo(() => {
    if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
      return window.location.origin;
    }
    return 'http://localhost:5173';
  }, []);

  const tabletUrl = useMemo(
    () => buildViewUrl(baseOrigin, 'controller', { roomCode }),
    [baseOrigin, roomCode]
  );
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

  const navItems: AdminNavItem[] = [
    {
      id: 'overview',
      Icon: LayoutDashboard,
      labelPt: 'Visão Geral',
      labelEn: 'Room Overview',
    },
    {
      id: 'projection',
      Icon: Monitor,
      labelPt: 'Matriz de Projeção',
      labelEn: 'Projection Matrix',
    },
    {
      id: 'audio',
      Icon: Sliders,
      labelPt: 'Console 8D & Caixas',
      labelEn: '8D Console & Speakers',
    },
    {
      id: 'network',
      Icon: Wifi,
      labelPt: 'Rede LAN & QR',
      labelEn: 'LAN & QR',
    },
  ];

  return (
    <div
      className="flex h-dvh w-screen flex-col overflow-hidden bg-[#060913] text-slate-100"
      data-testid="setup-view"
    >
      <CockpitHeader
        lang={lang}
        isPlaying={playback.isPlaying}
        globalBlackout={projectionState.globalBlackout}
        hasActiveTestsOrGrids={calibTestMode.kind !== 'off' || anyGridActive}
        confirmResetArmed={confirmResetArmed}
        onTogglePlayOrStart={playback.isPlaying ? togglePlay : playWithAudibleLayers}
        onToggleBlackout={toggleGlobalBlackout}
        onStagePanic={handleStagePanic}
        onResetClick={() => {
          if (!confirmResetArmed) {
            setConfirmResetArmed(true);
            return;
          }
          setConfirmResetArmed(false);
          resetExperienceToDefault();
        }}
        onToggleLang={() => setLang(isPt ? 'en' : 'pt')}
        onOpenSetupWizard={onOpenSetupWizard}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <AdminSidebar
          isPt={isPt}
          activeModule={activeModule}
          navItems={navItems}
          roomCode={roomCode}
          onSelectModule={setActiveModule}
        />

        <main className="admin-scroll min-h-0 flex-1 p-4 lg:p-5">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4">
            <AudioDiagnosticsBanner
              lang={lang}
              audioContextState={audioContextState}
              audioMode={audioMode}
              audioOwner={audioOwner}
              localAudioMuted={localAudioMuted}
              masterGain={masterGain}
              isPlaying={playback.isPlaying}
              globalBlackout={projectionState.globalBlackout}
              allSpeakersMuted={allSpeakersMuted}
              speakerCalibration={speakerCalibration}
              outputDevices={outputDevices}
              lanConnected={lanConnected}
              lanClients={lanClients}
              onUnlockAudio={() => {
                void unlockAudioContext();
              }}
              onUnmutePc={() => setLocalAudioMuted(false)}
              onRestoreMaster={() => setMasterGain(0.9)}
              onUnmuteAllSpeakers={() => {
                for (const id of SPEAKER_IDS) {
                  updateSpeakerConfig(id, { muted: false });
                }
              }}
              onDisableBlackout={toggleGlobalBlackout}
              onRefreshOutputDevices={() => {
                void refreshOutputDevices();
              }}
              onOpenModule={setActiveModule}
            />

            {activeModule === 'overview' && (
              <OverviewModule
                isPt={isPt}
                lang={lang}
                country={country}
                allCountries={allCountries}
                sceneReplayKey={sceneReplayKey}
                layers={layers}
                bpm={playback.bpm}
                keyRoot={playback.keyRoot}
                keyRootPt={playback.keyRootPt}
                activeChord={playback.activeChord}
                windMeanSpeed={playback.windMeanSpeed}
                masterGain={masterGain}
                voiceVolume={voiceVolume}
                activeFrameSpec={activeFrameSpec}
                isAutoSequencePlaying={isAutoSequencePlaying}
                onSelectCountry={selectCountry}
                onSetAllLayersEnabled={setAllLayersEnabled}
                onShowReadyPreset={handleShowReadyPreset}
                onToggleEye={toggleEye}
                onSetMasterGain={setMasterGain}
                onSetVoiceVolume={setVoiceVolume}
                onActivateMissionFrame={(phase, sStep, focusLayer) => {
                  setIsAutoSequencePlaying(false);
                  activateMissionFrame(phase, sStep, focusLayer);
                }}
                onReplayActiveFrame={replayActiveFrame}
                onToggleAutoSequence={() => {
                  if (isAutoSequencePlaying) {
                    setIsAutoSequencePlaying(false);
                  } else {
                    if (activeFrameId === 'ended') {
                      activateMissionFrame('idle');
                    }
                    setIsAutoSequencePlaying(true);
                  }
                }}
              />
            )}

            {activeModule === 'projection' && (
              <ProjectionModule
                isPt={isPt}
                projectionState={projectionState}
                selectedWarpOut={selectedWarpOut}
                roomDimensions={roomDimensions}
                remoteWarpRef={remoteWarpRef}
                baseOrigin={baseOrigin}
                roomCode={roomCode}
                copiedKey={copiedKey}
                onSelectPreset={selectProjectionPreset}
                onIdentifyOutputs={() => triggerIdentifyOutputs(7000)}
                onToggleOutputSurface={toggleOutputSurface}
                onSelectWarpOut={setSelectedWarpOut}
                onUpdateOutputConfig={updateOutputConfig}
                onToggleGlobalShowGrid={toggleGlobalShowGrid}
                onResetSingleOutputQuads={resetSingleOutputQuads}
                onResetAllProjectionQuads={resetAllProjectionQuads}
                onDragWarpStart={setDraggingRemoteWarp}
                onUpdateEdgeMask={updateEdgeMask}
                onCopyText={copyText}
                onUpdateDimension={updateDimension}
              />
            )}

            {activeModule === 'audio' && (
              <AudioConsoleModule
                isPt={isPt}
                surfaceToOutLabels={surfaceToOutLabels}
                liveEvents={liveEvents}
                speakerCalibration={speakerCalibration}
                speakerLiveLevels={speakerLiveLevels}
                calibTestMode={calibTestMode}
                calibBeatSeq={calibBeatSeq}
                audioMode={audioMode}
                audioOwner={audioOwner}
                realAudioRms01={realAudioRms01}
                audioSourceKind={audioSourceKind}
                localAudioMuted={localAudioMuted}
                audioLevels={audioLevels}
                outputSupportStatus={outputSupportStatus}
                outputDevices={outputDevices}
                isSetSinkIdSupported={isSetSinkIdSupported}
                speakerSinkStatuses={speakerSinkStatuses}
                lanPort={lanInfo.port}
                baseOrigin={baseOrigin}
                roomCode={roomCode}
                lanClients={lanClients}
                copiedKey={copiedKey}
                onUnlockOutputDevices={unlockOutputDevices}
                onResetSpeakerCalibration={resetSpeakerCalibration}
                onSetAudioMode={setAudioMode}
                onSetAudioOwner={setAudioOwner}
                onStopCalibrationSignal={stopCalibrationSignal}
                onSetReferenceSpeaker={setReferenceSpeaker}
                onUpdateSpeakerConfig={updateSpeakerConfig}
                onRetrySpeakerSink={retrySpeakerSink}
                onUpdateAvOffsetMs={updateAvOffsetMs}
                onTogglePinkNoiseSpeaker={togglePinkNoiseSpeaker}
                onToggleDelayClickSpeaker={toggleDelayClickSpeaker}
                onStartPinkNoiseAll={startPinkNoiseAll}
                onStartDelayClickAll={startDelayClickAll}
                onCopyText={copyText}
                onToggleLocalMute={() => setLocalAudioMuted(!localAudioMuted)}
              />
            )}

            {activeModule === 'network' && (
              <NetworkModule
                isPt={isPt}
                lanInfo={lanInfo}
                tabletUrl={tabletUrl}
                qrModules={qrModules}
                copiedKey={copiedKey}
                lanClients={lanClients}
                roomCode={roomCode}
                syncNetworkMode={syncNetworkMode}
                lanConnected={lanConnected}
                onRegenerateRoomCode={() => {
                  regenerateRoomCode();
                }}
                onCopyText={copyText}
                onRefreshLan={fetchLanDiagnostics}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
