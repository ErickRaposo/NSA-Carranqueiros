import React from 'react';
import { Check, Cloud, Globe, Laptop, Lock, Monitor, Projector, RotateCcw, Wifi } from 'lucide-react';
import { Lang, SyncNetworkMode } from '../../experience/types';
import { isSupabaseRealtimeConfigured } from '../../lan/roomRealtimeClient';
import { ADMIN_FOCUS, ADMIN_PANEL_CLASS, ADMIN_WELL_CLASS } from '../admin/adminMeta';
import { ScreenScenario } from './setupTypes';

interface StepLanguageAndRoomProps {
  lang: Lang;
  roomCode: string | null;
  syncNetworkMode: SyncNetworkMode;
  lanConnected: boolean;
  scenario: ScreenScenario;
  onSetLang: (lang: Lang) => void;
  onRegenerateRoomCode: () => void;
  onSelectScenario: (scenario: ScreenScenario) => void;
}

export const StepLanguageAndRoom: React.FC<StepLanguageAndRoomProps> = ({
  lang,
  roomCode,
  syncNetworkMode,
  lanConnected,
  scenario,
  onSetLang,
  onRegenerateRoomCode,
  onSelectScenario,
}) => {
  const isPt = lang === 'pt';
  const cloudConfigured = isSupabaseRealtimeConfigured();

  const scenarioCards: Array<{
    value: ScreenScenario;
    Icon: typeof Laptop;
    badgePt: string;
    badgeEn: string;
    titlePt: string;
    titleEn: string;
    descPt: string;
    descEn: string;
  }> = [
    {
      value: 0,
      Icon: Laptop,
      badgePt: 'Tela Única',
      badgeEn: 'Single Screen',
      titlePt: 'Sem projetor (Só computador ou TV)',
      titleEn: 'No projector (Computer or TV only)',
      descPt:
        'Ideal para explorar em casa, em um monitor ou ligar direto em uma TV via cabo HDMI.',
      descEn:
        'Ideal for exploring on your laptop, desktop monitor, or connecting directly to a TV.',
    },
    {
      value: 1,
      Icon: Projector,
      badgePt: 'Canto 3D em 1 Lente',
      badgeEn: 'Single-Lens 3D Corner',
      titlePt: '1 Projetor Grande-Angular',
      titleEn: '1 Wide-Angle Projector',
      descPt:
        'Um único projetor apontado para a quina da sala cobrindo Parede Esquerda, Parede Direita e Teto unidos.',
      descEn:
        'A single projector aimed at the room corner covering Left Wall, Right Wall, and Ceiling together.',
    },
    {
      value: 2,
      Icon: Monitor,
      badgePt: 'Recomendado p/ Sala',
      badgeEn: 'Recommended Room',
      titlePt: '2 Projetores (Canto em L + Teto)',
      titleEn: '2 Projectors (L-Corner + Ceiling)',
      descPt:
        'O Projetor 1 ilumina as duas paredes do canto juntas, e o Projetor 2 ilumina o Teto.',
      descEn:
        'Projector 1 lights both corner walls together, while Projector 2 projects onto the Ceiling.',
    },
    {
      value: 3,
      Icon: Monitor,
      badgePt: 'Máxima Resolução',
      badgeEn: 'Maximum Resolution',
      titlePt: '3 Projetores (1 por parede + Teto)',
      titleEn: '3 Projectors (1 per wall + Ceiling)',
      descPt:
        'Um projetor exclusivo para a Parede Esquerda, um para a Parede Direita e um para o Teto.',
      descEn:
        'One dedicated projector for the Left Wall, one for the Right Wall, and one for the Ceiling.',
    },
  ];

  return (
    <div className="flex flex-col gap-5" data-testid="setup-step-welcome">
      {/* 1. Escolha de Idioma */}
      <section className={`p-5 ${ADMIN_PANEL_CLASS}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-[#7dd3fc] uppercase">
              <Globe size={14} />
              <span>{isPt ? 'Passo 1 · Idioma & Ambiente' : 'Step 1 · Language & Space'}</span>
            </div>
            <h2 className="mt-1 text-lg font-semibold text-slate-50">
              {isPt
                ? 'Em qual idioma você prefere configurar e ouvir a experiência?'
                : 'Which language would you like for setup and narration?'}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">
              {isPt
                ? 'Isso ajusta todos os textos explicativos desta tela, o guia projetado na parede e a narração de voz.'
                : 'This sets all explanatory guides on this screen, the projected wall guide, and the voice narration.'}
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-2.5 sm:w-auto sm:min-w-[280px]">
            <button
              type="button"
              onClick={() => onSetLang('pt')}
              aria-pressed={isPt}
              data-testid="lang-btn-pt"
              className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${ADMIN_FOCUS} ${
                isPt
                  ? 'border-[#2563eb] bg-[#0c1a36] text-white'
                  : 'border-[#1e3a66]/55 bg-[#060c1a] text-slate-300 hover:border-[#2563eb]/60 hover:text-white'
              }`}
            >
              <span>Português (BR)</span>
              {isPt && <Check size={15} className="text-[#7dd3fc]" />}
            </button>
            <button
              type="button"
              onClick={() => onSetLang('en')}
              aria-pressed={!isPt}
              data-testid="lang-btn-en"
              className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${ADMIN_FOCUS} ${
                !isPt
                  ? 'border-[#2563eb] bg-[#0c1a36] text-white'
                  : 'border-[#1e3a66]/55 bg-[#060c1a] text-slate-300 hover:border-[#2563eb]/60 hover:text-white'
              }`}
            >
              <span>English (US)</span>
              {!isPt && <Check size={15} className="text-[#7dd3fc]" />}
            </button>
          </div>
        </div>
      </section>

      {/* 2. Sala Exclusiva (?room=XXXXXX) */}
      <section className={`p-5 ${ADMIN_PANEL_CLASS}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-50">
                {isPt ? 'Sua Sala Exclusiva de Sincronização' : 'Your Private Sync Room'}
              </h3>
              {roomCode && (
                <span
                  data-testid="setup-room-code"
                  className="rounded-lg border border-[#2563eb]/65 bg-[#0c1a36] px-2.5 py-0.5 text-xs font-semibold tracking-wider text-[#7dd3fc] [font-variant-numeric:tabular-nums]"
                >
                  {roomCode}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">
              {isPt
                ? 'Todos os links e o QR Code gerados aqui usam este código para conectar apenas seus projetores e seu celular — sem interferir em outras pessoas usando o site ao mesmo tempo.'
                : 'All links and the QR Code generated here carry this code so only your projectors and phone sync together — never interfering with other visitors.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className={`flex items-center gap-2 px-3.5 py-2 text-xs ${ADMIN_WELL_CLASS}`}>
              {syncNetworkMode === 'cloud-room' ? (
                <Cloud size={15} className={lanConnected ? 'text-emerald-400' : 'text-amber-300'} />
              ) : syncNetworkMode === 'lan-ws' ? (
                <Wifi size={15} className={lanConnected ? 'text-emerald-400' : 'text-sky-400'} />
              ) : (
                <Lock size={15} className="text-slate-400" />
              )}
              <span className="font-medium text-slate-200">
                {syncNetworkMode === 'cloud-room'
                  ? cloudConfigured
                    ? isPt
                      ? 'Sala Online (Wi-Fi / 4G)'
                      : 'Cloud Room (Wi-Fi / 4G)'
                    : isPt
                      ? 'Sala Local (Nuvem não configurada)'
                      : 'Local Room (Cloud env unset)'
                  : syncNetworkMode === 'lan-ws'
                    ? isPt
                      ? 'Rede Local Offline (LAN)'
                      : 'Offline Local Network (LAN)'
                    : isPt
                      ? 'Apenas este navegador'
                      : 'This browser only'}
              </span>
            </div>

            <button
              type="button"
              onClick={onRegenerateRoomCode}
              data-testid="btn-regenerate-room"
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#1e3a66] bg-[#060c1a] px-4 text-xs font-medium text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
            >
              <RotateCcw size={13} />
              <span>{isPt ? 'Gerar nova sala' : 'New room code'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 3. Escolha de Telas / Projetores */}
      <section className={`p-5 ${ADMIN_PANEL_CLASS}`}>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-50">
            {isPt
              ? 'Como você vai exibir as imagens hoje?'
              : 'How will you display the visuals today?'}
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            {isPt
              ? 'Escolha quantos projetores você tem disponíveis. Nós preparamos a divisão das paredes automaticamente.'
              : 'Choose how many projectors you have. We automatically configure the wall layout for you.'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {scenarioCards.map((card) => {
            const selected = scenario === card.value;
            const Icon = card.Icon;
            return (
              <button
                key={card.value}
                type="button"
                onClick={() => onSelectScenario(card.value)}
                aria-pressed={selected}
                data-testid={`scenario-card-${card.value}`}
                className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${ADMIN_FOCUS} ${
                  selected
                    ? 'border-[#2563eb] bg-[#0c1a36] text-white'
                    : 'border-[#1e3a66]/55 bg-[#060c1a]/90 text-slate-200 hover:border-[#2563eb]/55 hover:bg-[#081226]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#1e3a66] bg-[#040b1a] text-[#7dd3fc]">
                      <Icon size={19} />
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        selected
                          ? 'bg-[#2563eb]/35 text-[#7dd3fc]'
                          : 'bg-white/[0.04] text-slate-400'
                      }`}
                    >
                      {isPt ? card.badgePt : card.badgeEn}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-slate-50">
                    {isPt ? card.titlePt : card.titleEn}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                    {isPt ? card.descPt : card.descEn}
                  </p>
                </div>

                <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[#7dd3fc]">
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                      selected
                        ? 'border-[#7dd3fc] bg-[#2563eb] text-white'
                        : 'border-slate-500 bg-transparent'
                    }`}
                  >
                    {selected && <Check size={11} />}
                  </span>
                  <span>
                    {selected
                      ? isPt
                        ? 'Selecionado'
                        : 'Selected'
                      : isPt
                        ? 'Escolher este formato'
                        : 'Select this layout'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
