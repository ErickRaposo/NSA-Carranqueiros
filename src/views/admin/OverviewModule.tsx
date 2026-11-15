import React, { useMemo } from 'react';
import { Play, RotateCcw, Sliders, Square, Volume2 } from 'lucide-react';
import { speakTextPt } from '../../accessibility/a11yEngine';
import {
  MissionFrameSpec,
  resolveFramePrompts,
  SHAY_MISSION_FRAMES,
} from '../../experience/missionFrames';
import {
  ExperienceCountry,
  ExperienceLayersState,
  LAYER_METAS,
  Lang,
  MissionPhase,
  VISUAL_LAYER_ORDER,
  VisualLayerId,
} from '../../experience/types';
import { AdminSelect } from './AdminSelect';
import { FaderControl } from './FaderControl';
import { LiveRoomMonitor } from './LiveRoomMonitor';
import {
  ADMIN_CARD_CLASS,
  ADMIN_FOCUS,
  ADMIN_PANEL_CLASS,
  ADMIN_PRIMARY_PILL_CLASS,
  ADMIN_WELL_CLASS,
} from './adminMeta';

interface OverviewModuleProps {
  isPt: boolean;
  lang: Lang;
  country: ExperienceCountry | null;
  allCountries: readonly ExperienceCountry[];
  sceneReplayKey: number;
  layers: ExperienceLayersState;
  bpm: number;
  keyRoot: string;
  keyRootPt: string;
  activeChord: string;
  windMeanSpeed: number;
  masterGain: number;
  voiceVolume: number;
  activeFrameSpec: MissionFrameSpec;
  isAutoSequencePlaying: boolean;
  onSelectCountry: (countryId: string) => void;
  onSetAllLayersEnabled: (enabled: boolean) => void;
  onShowReadyPreset: () => void;
  onToggleEye: (id: VisualLayerId) => void;
  onSetMasterGain: (gain: number) => void;
  onSetVoiceVolume: (volume: number) => void;
  onActivateMissionFrame: (
    phase: MissionPhase,
    storyStep?: number,
    focusLayer?: VisualLayerId
  ) => void;
  onReplayActiveFrame: () => void;
  onToggleAutoSequence: () => void;
}

const FRAME_STAGE_GROUPS: ReadonlyArray<{
  key: 'opening' | 'explore' | 'closing';
  titlePt: string;
  titleEn: string;
  orders: number[];
}> = [
  { key: 'opening', titlePt: '1. Embarque & Voo', titleEn: '1. Launch & Flight', orders: [1, 2, 3, 4, 5] },
  {
    key: 'explore',
    titlePt: '2. Exploração · 5 Camadas',
    titleEn: '2. Explore · 5 Layers',
    orders: [6, 7, 8, 9, 10, 11],
  },
  { key: 'closing', titlePt: '3. Pouso', titleEn: '3. Landing', orders: [12] },
];

export const OverviewModule: React.FC<OverviewModuleProps> = ({
  isPt,
  lang,
  country,
  allCountries,
  sceneReplayKey,
  layers,
  bpm,
  keyRoot,
  keyRootPt,
  activeChord,
  windMeanSpeed,
  masterGain,
  voiceVolume,
  activeFrameSpec,
  isAutoSequencePlaying,
  onSelectCountry,
  onSetAllLayersEnabled,
  onShowReadyPreset,
  onToggleEye,
  onSetMasterGain,
  onSetVoiceVolume,
  onActivateMissionFrame,
  onReplayActiveFrame,
  onToggleAutoSequence,
}) => {
  const countryOptions = useMemo(
    () =>
      allCountries.map((c) => ({
        value: c.id,
        label: isPt ? c.namePt : c.nameEn,
      })),
    [allCountries, isPt]
  );

  const firstLayer = VISUAL_LAYER_ORDER.find((id) => layers[id].enabled) ?? 'melody';
  const layerMeta = LAYER_METAS[firstLayer];
  const prompts = resolveFramePrompts(activeFrameSpec.id, {
    lang,
    countryName: country ? (isPt ? country.namePt : country.nameEn) : isPt ? 'a Terra' : 'Earth',
    activeLayerLabel: isPt ? layerMeta.labelPt : layerMeta.labelEn,
    bpm,
    keyRoot,
    keyRootPt,
    activeChord,
    windMeanSpeed,
  });

  const activeStageKey =
    activeFrameSpec.order <= 5 ? 'opening' : activeFrameSpec.order <= 11 ? 'explore' : 'closing';

  return (
    <div className="flex flex-col gap-4" data-testid="admin-overview-module">
      {/* Linha Superior: Monitor 3D (6 cols) + País / Volume / 5 Camadas (6 cols) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Coluna Esquerda (6 cols): Simulador 3D ocupando toda a altura útil */}
        <section className={`flex flex-col p-3 lg:col-span-6 ${ADMIN_PANEL_CLASS}`}>
          <LiveRoomMonitor
            heightClass="h-[440px] lg:h-full lg:min-h-[480px]"
            sceneReplayKey={sceneReplayKey}
          />
        </section>

        {/* Coluna Direita (6 cols): País no Ar + Volume Mesa + 5 Camadas NASA */}
        <section className={`flex flex-col justify-between gap-4 p-4 lg:col-span-6 ${ADMIN_PANEL_CLASS}`}>
          {/* Bloco Superior: País no Ar ao lado do Volume da Mesa */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
            {/* País no Ar + Telemetria Musical + Show Pronto */}
            <div className={`flex flex-col justify-between gap-3 p-3.5 sm:col-span-6 ${ADMIN_WELL_CLASS}`}>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-200">
                  {isPt ? 'País no Ar' : 'Active Country'}
                </span>
                <AdminSelect
                  ariaLabel={isPt ? 'Selecionar país no ar' : 'Select active country'}
                  value={country?.id ?? ''}
                  options={countryOptions}
                  placeholder={isPt ? 'Escolha um país...' : 'Choose a country...'}
                  onChange={onSelectCountry}
                />
              </div>

              <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-[#1e3a66]/45 bg-[#040b1a] px-2.5 py-2 text-center [font-variant-numeric:tabular-nums]">
                <div>
                  <div className="text-[11px] text-slate-400">{isPt ? 'Tom' : 'Key'}</div>
                  <div className="truncate text-xs font-semibold text-slate-100">
                    {isPt ? keyRootPt : keyRoot}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">BPM</div>
                  <div className="text-xs font-semibold text-slate-100">
                    {Math.round(bpm)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">{isPt ? 'Acorde' : 'Chord'}</div>
                  <div className="truncate text-xs font-semibold text-[#7dd3fc]">
                    {activeChord}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onShowReadyPreset}
                className={`min-h-[42px] w-full px-3 text-xs ${ADMIN_PRIMARY_PILL_CLASS} ${ADMIN_FOCUS}`}
              >
                {isPt ? 'Preparar Sala' : 'Activate Show Preset'}
              </button>
            </div>

            {/* Console Reduzido da Mesa: Música & Voz do Robô */}
            <div className={`flex flex-col justify-between p-3.5 sm:col-span-6 ${ADMIN_WELL_CLASS}`}>
              <div className="mb-2 flex items-center gap-1.5">
                <Sliders size={13} className="text-[#7dd3fc]" />
                <span className="text-xs font-semibold text-slate-200">
                  {isPt ? 'Volume · Mesa' : 'Volume · Mix'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <FaderControl
                  orientation="vertical"
                  compact
                  label={isPt ? 'Música' : 'Music'}
                  value={masterGain}
                  min={0}
                  max={1}
                  step={0.01}
                  valueText={`${Math.round(masterGain * 100)}%`}
                  onChange={onSetMasterGain}
                  onReset={() => onSetMasterGain(0.9)}
                  resetTitle={isPt ? 'Restaurar música em 90%' : 'Reset music to 90%'}
                />
                <FaderControl
                  orientation="vertical"
                  compact
                  label={isPt ? 'Voz Robô' : 'Robot Voice'}
                  value={voiceVolume}
                  min={0}
                  max={1}
                  step={0.01}
                  valueText={`${Math.round(voiceVolume * 100)}%`}
                  onChange={onSetVoiceVolume}
                  onReset={() => onSetVoiceVolume(1.0)}
                  resetTitle={isPt ? 'Restaurar voz em 100%' : 'Reset voice to 100%'}
                />
              </div>
            </div>
          </div>

          {/* 5 Camadas NASA */}
          <div className="flex flex-col gap-2.5 border-t border-[#1e3a66]/45 pt-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold tracking-[-0.01em] text-slate-50">
                  {isPt ? '5 Camadas NASA' : '5 NASA Layers'}
                </h2>
                <p className="text-xs text-slate-400">
                  {isPt ? 'Mesmos olhinhos sincronizados com o Tablet.' : 'Synced live with Tablet.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSetAllLayersEnabled(true)}
                className={`min-h-[38px] rounded-full border border-[#1e3a66] bg-[#060c1a] px-3.5 text-xs font-medium text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
              >
                {isPt ? 'Ligar todas' : 'Enable all'}
              </button>
            </div>

            <div className="divide-y divide-[#1e3a66]/45 overflow-hidden rounded-xl border border-[#1e3a66]/55 bg-[#060c1a]/85">
              {VISUAL_LAYER_ORDER.map((id) => {
                const meta = LAYER_METAS[id];
                const on = layers[id].enabled;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onToggleEye(id)}
                    aria-pressed={on}
                    className={`flex min-h-[42px] w-full items-center justify-between px-3.5 py-2 text-left text-xs transition ${ADMIN_FOCUS} ${
                      on
                        ? 'bg-[#0c1a36] font-semibold text-slate-50'
                        : 'text-slate-400 hover:bg-white/[0.03] hover:text-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${on ? '' : 'opacity-30'}`}
                        style={{ backgroundColor: meta.accentHex }}
                      />
                      <span>{isPt ? meta.labelPt : meta.labelEn}</span>
                    </span>
                    <span className="text-xs font-medium text-slate-400">
                      {on ? (isPt ? 'Ativa' : 'On') : isPt ? 'Desligada' : 'Off'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* Linha Inferior (Full Width): Linha do Tempo da Missão (12 Quadros · 3 Fases) */}
      <section className={`p-4 ${ADMIN_PANEL_CLASS}`} data-testid="shay-frames-director">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
          <div>
            <h2 className="text-sm font-semibold tracking-[-0.01em] text-slate-50">
              {isPt
                ? 'Linha do Tempo da Missão · 12 Quadros'
                : 'Mission Timeline Stepper · 12 Frames'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {isPt
                ? 'Acompanhe em que fase o Mineirø está e dispare qualquer quadro nas duas paredes e no teto.'
                : 'Track mission progress and trigger any frame across 2 walls and ceiling.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onReplayActiveFrame}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[#1e3a66] bg-[#060c1a] px-3.5 text-xs font-medium text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
            >
              <RotateCcw size={13} />
              <span>{isPt ? 'Reiniciar Quadro' : 'Replay Frame'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleAutoSequence}
              className={`inline-flex min-h-[40px] items-center gap-1.5 px-4 text-xs transition ${ADMIN_FOCUS} ${
                isAutoSequencePlaying
                  ? 'rounded-full border border-rose-400/50 bg-rose-500/20 font-semibold text-rose-100 hover:bg-rose-500/30'
                  : ADMIN_PRIMARY_PILL_CLASS
              }`}
            >
              {isAutoSequencePlaying ? <Square size={12} /> : <Play size={13} />}
              <span>
                {isAutoSequencePlaying
                  ? isPt
                    ? 'Parar Sequência'
                    : 'Stop Sequence'
                  : isPt
                    ? 'Rodar Sequência'
                    : 'Play Sequence'}
              </span>
            </button>
          </div>
        </div>

        {/* Barra Conectada das 3 Macro-Fases */}
        <div className={`mb-3 grid grid-cols-1 gap-3 p-3 md:grid-cols-3 ${ADMIN_WELL_CLASS}`}>
          {FRAME_STAGE_GROUPS.map((stage, idx) => {
            const stageFrames = SHAY_MISSION_FRAMES.filter((f) => stage.orders.includes(f.order));
            const stageDone = activeFrameSpec.order > stage.orders[stage.orders.length - 1];
            const stageActive = activeStageKey === stage.key;
            return (
              <div key={stage.key} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold [font-variant-numeric:tabular-nums] ${
                      stageActive
                        ? 'bg-white text-[#060913]'
                        : stageDone
                          ? 'border border-[#2563eb]/55 bg-[#0c1a36] text-slate-100'
                          : 'border border-[#1e3a66]/55 bg-[#060c1a] text-slate-400'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span
                    className={`truncate text-xs font-medium ${
                      stageActive ? 'text-slate-50' : stageDone ? 'text-slate-200' : 'text-slate-400'
                    }`}
                  >
                    {isPt ? stage.titlePt : stage.titleEn}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {stageFrames.map((frame, fIdx) => {
                    const isActive = frame.id === activeFrameSpec.id;
                    const isPast = frame.order < activeFrameSpec.order;
                    return (
                      <React.Fragment key={frame.id}>
                        <button
                          type="button"
                          onClick={() =>
                            onActivateMissionFrame(frame.phase, frame.storyStep, frame.focusLayer)
                          }
                          aria-current={isActive ? 'step' : undefined}
                          title={isPt ? frame.titlePt : frame.titleEn}
                          className={`flex min-h-[40px] min-w-[34px] flex-1 items-center justify-center rounded-lg border px-1.5 text-xs font-semibold transition [font-variant-numeric:tabular-nums] ${ADMIN_FOCUS} ${
                            isActive
                              ? 'border-white bg-white text-[#060913]'
                              : isPast
                                ? 'border-[#2563eb]/50 bg-[#0c1a36] text-slate-100 hover:border-[#2563eb]'
                                : 'border-[#1e3a66]/55 bg-[#060c1a] text-slate-400 hover:border-[#1e3a66] hover:text-slate-100'
                          }`}
                        >
                          {frame.order}
                        </button>
                        {fIdx < stageFrames.length - 1 && (
                          <span
                            className={`h-[2px] w-1.5 shrink-0 ${
                              isPast ? 'bg-[#2563eb]/65' : 'bg-[#1e3a66]/60'
                            }`}
                            aria-hidden="true"
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Detalhe do Quadro Ativo + 3 Superfícies + Voz do Robô */}
        <div className={`p-3.5 ${ADMIN_WELL_CLASS}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="rounded-full border border-[#1e3a66] bg-[#0c1a36] px-3 py-0.5 text-xs font-semibold text-slate-100 [font-variant-numeric:tabular-nums]">
                {isPt ? `Quadro ${activeFrameSpec.order}/12` : `Frame ${activeFrameSpec.order}/12`}
              </span>
              <span className="text-xs font-semibold text-slate-50">
                {isPt ? activeFrameSpec.titlePt : activeFrameSpec.titleEn}
              </span>
            </div>
            {prompts.spoken && (
              <button
                type="button"
                onClick={() => speakTextPt(prompts.spoken, true, { maleVoice: true })}
                className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-[#1e3a66] bg-[#060c1a] px-3.5 text-xs font-medium text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
              >
                <Volume2 size={13} />
                <span>{isPt ? 'Ouvir Fala' : 'Preview Voice'}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
            <div className={`p-3 ${ADMIN_CARD_CLASS}`}>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                <span className="h-2 w-2 rounded-full bg-[#7dd3fc]" aria-hidden="true" />
                <span>{isPt ? 'Parede Esquerda' : 'Left Wall'}</span>
              </div>
              <div className="mt-1.5 text-xs leading-relaxed text-slate-300">
                {isPt ? activeFrameSpec.leftWallPt : activeFrameSpec.leftWallEn}
              </div>
            </div>
            <div className={`p-3 ${ADMIN_CARD_CLASS}`}>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                <span className="h-2 w-2 rounded-full bg-slate-300" aria-hidden="true" />
                <span>{isPt ? 'Parede Direita' : 'Right Wall'}</span>
              </div>
              <div className="mt-1.5 text-xs leading-relaxed text-slate-300">
                {isPt ? activeFrameSpec.rightWallPt : activeFrameSpec.rightWallEn}
              </div>
            </div>
            <div className={`p-3 ${ADMIN_CARD_CLASS}`}>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                <span className="h-2 w-2 rounded-full bg-white" aria-hidden="true" />
                <span>{isPt ? 'Teto' : 'Ceiling'}</span>
              </div>
              <div className="mt-1.5 text-xs leading-relaxed text-slate-300">
                {isPt ? activeFrameSpec.ceilingPt : activeFrameSpec.ceilingEn}
              </div>
            </div>
          </div>

          {prompts.phrases.length > 0 && (
            <div className="mt-3 border-t border-[#1e3a66]/45 pt-2.5 text-xs text-slate-200">
              <span className="font-semibold text-slate-400">
                {isPt ? 'Fala no Balão: ' : 'Bubble Prompt: '}
              </span>
              <span>{prompts.phrases.join(' — ')}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
