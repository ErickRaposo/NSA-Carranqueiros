import React from 'react';
import {
  ArrowRight,
  Cloud,
  Laptop,
  Lock,
  Monitor,
  Projector,
  RotateCcw,
  Wifi,
} from 'lucide-react';
import {
  Lang,
  SURFACE_IDS,
  SurfaceId,
  SyncNetworkMode,
} from '../../experience/types';
import { isSupabaseRealtimeConfigured } from '../../lan/roomRealtimeClient';
import {
  ADMIN_FOCUS,
  ADMIN_PANEL_CLASS,
  ADMIN_PRIMARY_PILL_CLASS,
  ADMIN_WELL_CLASS,
  SURFACE_UI_META,
} from '../admin/adminMeta';
import { ConfirmedRackBar } from './ConfirmedRackBar';
import { NextBlockTeaser } from './NextBlockTeaser';
import {
  ScreenScenario,
  WelcomeConfirmedState,
  WelcomeSubStep,
} from './setupTypes';

interface StepLanguageAndRoomProps {
  lang: Lang;
  roomCode: string | null;
  syncNetworkMode: SyncNetworkMode;
  lanConnected: boolean;
  scenario: ScreenScenario;
  welcomeConfirmed: WelcomeConfirmedState;
  activeWelcomeSubStep: WelcomeSubStep;
  onConfirmLang: (lang: Lang) => void;
  onRegenerateRoomCode: () => void;
  onConfirmRoom: () => void;
  onSelectScenario: (scenario: ScreenScenario) => void;
  onEditSubStep: (subStep: WelcomeSubStep) => void;
}

const PRESS_TRANSITION =
  'transition-[transform,background-color,border-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]';

export const StepLanguageAndRoom: React.FC<StepLanguageAndRoomProps> = ({
  lang,
  roomCode,
  syncNetworkMode,
  lanConnected,
  scenario,
  welcomeConfirmed,
  activeWelcomeSubStep,
  onConfirmLang,
  onRegenerateRoomCode,
  onConfirmRoom,
  onSelectScenario,
  onEditSubStep,
}) => {
  const isPt = lang === 'pt';
  const cloudConfigured = isSupabaseRealtimeConfigured();

  const networkModeLabel =
    syncNetworkMode === 'cloud-room'
      ? cloudConfigured
        ? isPt
          ? 'Sala Online (Wi-Fi / 4G)'
          : 'Cloud Room (Wi-Fi / 4G)'
        : isPt
          ? 'Modo Local'
          : 'Local Mode'
      : syncNetworkMode === 'lan-ws'
        ? isPt
          ? 'Rede Local Offline (LAN)'
          : 'Offline Local Network (LAN)'
        : isPt
          ? 'Navegador local'
          : 'This browser only';

  const scenarioCards: Array<{
    value: ScreenScenario;
    Icon: typeof Laptop;
    outTag: string;
    titlePt: string;
    titleEn: string;
    descPt: string;
    descEn: string;
    shortPt: string;
    shortEn: string;
  }> = [
    {
      value: 0,
      Icon: Laptop,
      outTag: '0 saídas',
      titlePt: 'Sem projetor (PC ou TV)',
      titleEn: 'No projector (PC or TV)',
      descPt: 'Exibição direta neste computador ou ligada à TV via HDMI.',
      descEn: 'Single display on this computer or connected to a TV via HDMI.',
      shortPt: '0 projetores (Tela direta)',
      shortEn: '0 projectors (Direct screen)',
    },
    {
      value: 1,
      Icon: Projector,
      outTag: '1 saída',
      titlePt: '1 Projetor Grande-Angular',
      titleEn: '1 Wide-Angle Projector',
      descPt: 'Um projetor na quina cobrindo Paredes Esquerda, Direita e Teto.',
      descEn: 'Single corner projector covering Left Wall, Right Wall, and Ceiling.',
      shortPt: '1 projetor (Canto único)',
      shortEn: '1 projector (Single corner)',
    },
    {
      value: 2,
      Icon: Monitor,
      outTag: '2 saídas',
      titlePt: '2 Projetores (Canto em L + Teto)',
      titleEn: '2 Projectors (L-Corner + Ceiling)',
      descPt: 'Saída 1 cobre as duas paredes do canto; Saída 2 projeta no Teto.',
      descEn: 'Output 1 lights both corner walls; Output 2 projects on the Ceiling.',
      shortPt: '2 projetores (L + Teto)',
      shortEn: '2 projectors (L + Ceiling)',
    },
    {
      value: 3,
      Icon: Monitor,
      outTag: '3 saídas',
      titlePt: '3 Projetores (Esq + Dir + Teto)',
      titleEn: '3 Projectors (Left + Right + Ceiling)',
      descPt: 'Saída dedicada para Parede Esquerda, Parede Direita e Teto.',
      descEn: 'Dedicated output for Left Wall, Right Wall, and Ceiling.',
      shortPt: '3 projetores (3 saídas)',
      shortEn: '3 projectors (3 outputs)',
    },
  ];

  const activeScenarioMeta = scenarioCards.find((c) => c.value === scenario) ?? scenarioCards[2];
  const editLabel = isPt ? 'Alterar' : 'Edit';

  const teaserMeta =
    activeWelcomeSubStep === 'lang'
      ? {
          title: isPt
            ? 'Sua sala exclusiva de sincronização'
            : 'Your private sync room',
          subtitle: isPt
            ? 'Gere ou confirme o código que isola seus projetores e celular na mesma sessão.'
            : 'Confirm the isolated room code linking your projectors and controller.',
          slotCount: 2 as const,
        }
      : activeWelcomeSubStep === 'room'
        ? {
            title: isPt
              ? 'Quantos projetores serão usados na sala?'
              : 'How many projectors will you run in the room?',
            subtitle: isPt
              ? 'Escolha o formato de telas para distribuir Parede Esquerda, Direita e Teto.'
              : 'Pick your screen layout to map Left Wall, Right Wall, and Ceiling.',
            slotCount: 2 as const,
          }
        : scenario > 0
          ? {
              title: isPt
                ? 'Abrir e identificar janelas dos projetores'
                : 'Open and identify projector windows',
              subtitle: isPt
                ? 'Na próxima etapa você abre cada saída de vídeo e encaixa os cantos nas paredes.'
                : 'Next, open each video output window and fit corners to your walls.',
              slotCount: 3 as const,
            }
          : {
              title: isPt
                ? 'Escolher saída de áudio espacial 8D'
                : 'Choose 8D spatial audio output',
              subtitle: isPt
                ? 'Na próxima etapa você define fone de ouvido ou 3 caixas e calibra a sincronia.'
                : 'Next, choose headphones or 3 room speakers and balance sync.',
              slotCount: 2 as const,
            };

  const scenarioMatrixMap: Record<
    ScreenScenario,
    Record<SurfaceId, { active: boolean; tagPt: string; tagEn: string }>
  > = {
    0: {
      leftWall: { active: true, tagPt: 'PC / TV', tagEn: 'PC / TV' },
      rightWall: { active: true, tagPt: 'PC / TV', tagEn: 'PC / TV' },
      ceiling: { active: false, tagPt: 'Tela única', tagEn: 'Unified' },
    },
    1: {
      leftWall: { active: true, tagPt: 'OUT 1', tagEn: 'OUT 1' },
      rightWall: { active: true, tagPt: 'OUT 1', tagEn: 'OUT 1' },
      ceiling: { active: true, tagPt: 'OUT 1', tagEn: 'OUT 1' },
    },
    2: {
      leftWall: { active: true, tagPt: 'OUT 1', tagEn: 'OUT 1' },
      rightWall: { active: true, tagPt: 'OUT 1', tagEn: 'OUT 1' },
      ceiling: { active: true, tagPt: 'OUT 2', tagEn: 'OUT 2' },
    },
    3: {
      leftWall: { active: true, tagPt: 'OUT 1', tagEn: 'OUT 1' },
      rightWall: { active: true, tagPt: 'OUT 2', tagEn: 'OUT 2' },
      ceiling: { active: true, tagPt: 'OUT 3', tagEn: 'OUT 3' },
    },
  };

  return (
    <div className="flex flex-col gap-5" data-testid="setup-step-welcome">
      {/* Sub-block: Language */}
      {activeWelcomeSubStep === 'lang' ? (
        <section
          className={`setup-block-enter p-6 sm:p-8 lg:p-9 ${ADMIN_PANEL_CLASS}`}
          data-testid="substep-lang-active"
        >
          <div className="max-w-[66ch]">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-50 sm:text-[26px]">
              {isPt
                ? 'Em qual idioma você prefere configurar e ouvir a experiência?'
                : 'Which language do you prefer for setup and voice narration?'}
            </h2>
            <p className="mt-2 text-sm leading-[1.6] text-slate-400 sm:text-[15px]">
              {isPt
                ? 'Ajusta todos os textos desta tela, o guia projetado na parede e a narração de voz.'
                : 'Sets all labels on this screen, the projected wall guide, and voice narration.'}
            </p>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => onConfirmLang('pt')}
              aria-pressed={isPt}
              data-testid="lang-btn-pt"
              className={`flex min-h-[148px] flex-col justify-between rounded-xl border p-6 text-left transition ${PRESS_TRANSITION} ${ADMIN_FOCUS} ${
                isPt
                  ? 'border-[#2563eb]/65 bg-[#0c1a36]/75 text-slate-50'
                  : 'border-[#1e3a66]/45 bg-white/[0.02] text-slate-300 hover:border-[#1e3a66] hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex w-full items-center justify-between gap-3">
                <span className="text-lg font-semibold text-slate-50 sm:text-xl">Português (BR)</span>
                <span
                  className={`inline-flex min-h-[32px] items-center gap-2 rounded-xl border px-3 text-xs ${
                    isPt
                      ? 'border-[#2563eb]/55 bg-[#0c1a36] font-semibold text-slate-50'
                      : 'border-[#1e3a66]/45 bg-[#040b1a] font-medium text-slate-400'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full bg-[#7dd3fc] ${isPt ? '' : 'opacity-25'}`}
                    aria-hidden="true"
                  />
                  <span>{isPt ? 'Ativo' : 'Select'}</span>
                </span>
              </div>
              <p className="mt-3 text-sm leading-[1.55] text-slate-400">
                Menus desta tela, guia projetado na parede e narração de voz em português
              </p>
            </button>

            <button
              type="button"
              onClick={() => onConfirmLang('en')}
              aria-pressed={!isPt}
              data-testid="lang-btn-en"
              className={`flex min-h-[148px] flex-col justify-between rounded-xl border p-6 text-left transition ${PRESS_TRANSITION} ${ADMIN_FOCUS} ${
                !isPt
                  ? 'border-[#2563eb]/65 bg-[#0c1a36]/75 text-slate-50'
                  : 'border-[#1e3a66]/45 bg-white/[0.02] text-slate-300 hover:border-[#1e3a66] hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex w-full items-center justify-between gap-3">
                <span className="text-lg font-semibold text-slate-50 sm:text-xl">English (US)</span>
                <span
                  className={`inline-flex min-h-[32px] items-center gap-2 rounded-xl border px-3 text-xs ${
                    !isPt
                      ? 'border-[#2563eb]/55 bg-[#0c1a36] font-semibold text-slate-50'
                      : 'border-[#1e3a66]/45 bg-[#040b1a] font-medium text-slate-400'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full bg-[#7dd3fc] ${!isPt ? '' : 'opacity-25'}`}
                    aria-hidden="true"
                  />
                  <span>{!isPt ? 'Active' : 'Selecionar'}</span>
                </span>
              </div>
              <p className="mt-3 text-sm leading-[1.55] text-slate-400">
                Setup controls, projected wall guide &amp; voice narration in English
              </p>
            </button>
          </div>
        </section>
      ) : (
        welcomeConfirmed.lang && (
          <ConfirmedRackBar
            label={isPt ? 'Idioma' : 'Language'}
            summary={isPt ? 'Português (BR)' : 'English (US)'}
            editLabel={editLabel}
            testId="rack-bar-lang"
            onEdit={() => onEditSubStep('lang')}
          />
        )
      )}

      {/* Sub-block: Exclusive Room (?room=XXXXXX) */}
      {activeWelcomeSubStep === 'room' ? (
        <section
          className={`setup-block-enter p-6 sm:p-8 lg:p-9 ${ADMIN_PANEL_CLASS}`}
          data-testid="substep-room-active"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-[66ch]">
              <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-50 sm:text-[26px]">
                {isPt ? 'Sua sala exclusiva de sincronização' : 'Your private sync room'}
              </h2>
              <p className="mt-2 text-sm leading-[1.6] text-slate-400 sm:text-[15px]">
                {isPt
                  ? 'Todos os links e o QR Code gerados aqui usam este código para conectar apenas seus projetores e seu celular.'
                  : 'All links and QR Codes here use this code to sync only your projectors and controller.'}
              </p>
            </div>

            <div className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs ${ADMIN_WELL_CLASS}`}>
              {syncNetworkMode === 'cloud-room' ? (
                <Cloud size={14} className={lanConnected ? 'text-emerald-400' : 'text-amber-300'} />
              ) : syncNetworkMode === 'lan-ws' ? (
                <Wifi size={14} className={lanConnected ? 'text-emerald-400' : 'text-[#7dd3fc]'} />
              ) : (
                <Lock size={14} className="text-slate-400" />
              )}
              <span className="font-medium text-slate-200">{networkModeLabel}</span>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-5 rounded-xl border border-[#2563eb]/65 bg-[#0c1a36]/60 p-6">
            <div>
              <div className="text-xs font-medium text-slate-400">
                {isPt ? 'Código da sessão' : 'Session code'}
              </div>
              {roomCode ? (
                <div
                  data-testid="setup-room-code"
                  className="mt-2 inline-flex rounded-xl border border-[#1e3a66] bg-[#0c1a36] px-5 py-2.5 font-mono text-3xl font-bold tracking-[0.2em] text-[#7dd3fc] sm:text-4xl [font-variant-numeric:tabular-nums]"
                >
                  {roomCode}
                </div>
              ) : (
                <div className="mt-2 inline-flex rounded-xl border border-[#1e3a66] bg-[#0c1a36] px-5 py-2.5 font-mono text-2xl font-semibold text-slate-200">
                  LOCAL
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onRegenerateRoomCode}
                data-testid="btn-regenerate-room"
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#1e3a66] bg-[#040b1a] px-4 text-xs font-medium text-slate-200 hover:border-[#2563eb] hover:text-white ${PRESS_TRANSITION} ${ADMIN_FOCUS}`}
              >
                <RotateCcw size={13} />
                <span>{isPt ? 'Gerar nova sala' : 'New room code'}</span>
              </button>

              <button
                type="button"
                onClick={onConfirmRoom}
                data-testid="btn-confirm-room"
                className={`inline-flex min-h-[44px] items-center gap-2 px-6 text-[13px] ${PRESS_TRANSITION} ${ADMIN_PRIMARY_PILL_CLASS} ${ADMIN_FOCUS}`}
              >
                <span>{isPt ? 'Usar esta sala' : 'Use this room'}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </section>
      ) : (
        welcomeConfirmed.room && (
          <ConfirmedRackBar
            label={isPt ? 'Sala' : 'Room'}
            summary={`${roomCode ?? 'LOCAL'} · ${networkModeLabel}`}
            editLabel={editLabel}
            testId="rack-bar-room"
            onEdit={() => onEditSubStep('room')}
          />
        )
      )}

      {/* Sub-block: Scenario / Screen Count */}
      {activeWelcomeSubStep === 'scenario' ? (
        <section
          className={`setup-block-enter p-6 sm:p-8 lg:p-9 ${ADMIN_PANEL_CLASS}`}
          data-testid="substep-scenario-active"
        >
          <div className="max-w-[66ch]">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-50 sm:text-[26px]">
              {isPt
                ? 'Quantos projetores serão usados na sala?'
                : 'How many projectors will you run in the room?'}
            </h2>
            <p className="mt-2 text-sm leading-[1.6] text-slate-400 sm:text-[15px]">
              {isPt
                ? 'Escolha quantos projetores estão ligados para definir o formato de paredes, teto ou tela única.'
                : 'Choose how many projectors are connected to map walls, ceiling, or single screen.'}
            </p>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2">
            {scenarioCards.map((card) => {
              const selected = scenario === card.value;
              const Icon = card.Icon;
              const surfaceMap = scenarioMatrixMap[card.value];
              return (
                <button
                  key={card.value}
                  type="button"
                  onClick={() => onSelectScenario(card.value)}
                  aria-pressed={selected}
                  data-testid={`scenario-card-${card.value}`}
                  className={`flex min-h-[172px] flex-col justify-between rounded-xl border p-5 text-left transition sm:p-6 ${PRESS_TRANSITION} ${ADMIN_FOCUS} ${
                    selected
                      ? 'border-[#2563eb]/65 bg-[#0c1a36]/75 text-slate-50'
                      : 'border-[#1e3a66]/45 bg-white/[0.02] text-slate-300 hover:border-[#1e3a66] hover:bg-white/[0.04]'
                  }`}
                >
                  <div>
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#1e3a66] bg-[#040b1a] text-[#7dd3fc]">
                        <Icon size={18} />
                      </span>

                      <span
                        className={`inline-flex min-h-[32px] items-center gap-2 rounded-xl border px-3 text-xs ${
                          selected
                            ? 'border-[#2563eb]/55 bg-[#0c1a36] font-semibold text-slate-50'
                            : 'border-[#1e3a66]/45 bg-[#040b1a] font-medium text-slate-400'
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full bg-[#7dd3fc] ${selected ? '' : 'opacity-25'}`}
                          aria-hidden="true"
                        />
                        <span>
                          {selected ? (isPt ? 'Ativa' : 'Active') : isPt ? 'Off' : 'Off'}
                        </span>
                      </span>
                    </div>

                    <div className="mt-4 text-base font-semibold text-slate-50 sm:text-lg [font-variant-numeric:tabular-nums]">
                      {isPt ? card.titlePt : card.titleEn}
                    </div>
                    <p className="mt-1.5 text-sm leading-[1.5] text-slate-400">
                      {isPt ? card.descPt : card.descEn}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {SURFACE_IDS.map((sId) => {
                      const slot = surfaceMap[sId];
                      const accent = SURFACE_UI_META[sId].accentHex;
                      return (
                        <span
                          key={sId}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium ${
                            slot.active
                              ? 'border-[#1e3a66] bg-[#040b1a] text-slate-200'
                              : 'border-[#1e3a66]/35 bg-[#040b1a]/60 text-slate-500'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${slot.active ? '' : 'opacity-25'}`}
                            style={{ backgroundColor: accent }}
                            aria-hidden="true"
                          />
                          <span>
                            {isPt ? SURFACE_UI_META[sId].shortPt : SURFACE_UI_META[sId].shortEn}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        welcomeConfirmed.scenario && (
          <ConfirmedRackBar
            label={isPt ? 'Telas' : 'Displays'}
            summary={isPt ? activeScenarioMeta.shortPt : activeScenarioMeta.shortEn}
            editLabel={editLabel}
            testId="rack-bar-scenario"
            onEdit={() => onEditSubStep('scenario')}
          />
        )
      )}

      {/* Next question preview with continuity fade */}
      <NextBlockTeaser
        title={teaserMeta.title}
        subtitle={teaserMeta.subtitle}
        slotCount={teaserMeta.slotCount}
      />
    </div>
  );
};
