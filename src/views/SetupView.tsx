import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Grid, Monitor, QrCode, RotateCcw, Sliders, Speaker } from 'lucide-react';
import { useExperience } from '../experience/ExperienceContext';
import { AudioOutputMode, RoomDimensions, SurfaceId } from '../experience/types';
import {
  CALIBRATION_CHANNEL_NAME,
  createDefaultCalibrationState,
  loadCalibrationState,
  ProjectionCalibrationState,
  saveCalibrationState,
} from '../projection/homography';

export const SetupView: React.FC = () => {
  const { roomDimensions, setRoomDimensions, audioMode, setAudioMode, lang, setLang } =
    useExperience();
  const isPt = lang === 'pt';
  const [calibration, setCalibration] = useState<ProjectionCalibrationState>(loadCalibrationState);
  const calibChannelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(CALIBRATION_CHANNEL_NAME);
    calibChannelRef.current = ch;
    ch.onmessage = (ev: MessageEvent<ProjectionCalibrationState>) => {
      if (ev.data && ev.data.quads) {
        setCalibration(ev.data);
      }
    };
    return () => {
      ch.close();
      calibChannelRef.current = null;
    };
  }, []);

  const updateCalibration = (next: ProjectionCalibrationState) => {
    setCalibration(next);
    saveCalibrationState(next);
    try {
      calibChannelRef.current?.postMessage(next);
    } catch {
      // ignore closed channel
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

  return (
    <main
      className="min-h-dvh w-full bg-[#060913] px-4 py-6 text-slate-100 sm:px-8"
      data-testid="setup-view"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-400/15 pb-4">
          <div>
            <span className="text-xs font-semibold tracking-wider text-sky-400 uppercase">
              Earth Jukebox · Room Setup
            </span>
            <h1 className="mt-1 text-2xl font-semibold text-slate-50">
              {isPt
                ? 'Configuração Física da Sala, Projetores & Áudio 8D'
                : 'Physical Room, Projectors & 8D Audio Setup'}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setLang(isPt ? 'en' : 'pt')}
            className="min-h-[44px] rounded-full border border-slate-400/20 bg-[#080d19] px-4 text-xs font-semibold text-slate-100"
          >
            {isPt ? 'Idioma: PT-BR' : 'Language: EN'}
          </button>
        </header>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* 1. Proporções das Paredes e Teto */}
          <section className="rounded-2xl border border-slate-400/15 bg-[#080d19] p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Sliders size={16} className="text-sky-400" />
              <h2>
                {isPt ? 'Dimensões Físicas das Superfícies (cm)' : 'Surface Physical Dimensions (cm)'}
              </h2>
            </div>

            <div className="flex flex-col gap-3">
              {(
                [
                  ['leftWall', isPt ? 'Parede Esquerda' : 'Left Wall'],
                  ['rightWall', isPt ? 'Parede Direita' : 'Right Wall'],
                  ['ceiling', isPt ? 'Teto' : 'Ceiling'],
                ] as const
              ).map(([surfaceId, title]) => (
                <div
                  key={surfaceId}
                  className="grid grid-cols-3 items-center gap-3 rounded-xl border border-slate-400/10 bg-white/[0.025] p-3"
                >
                  <span className="text-xs font-medium text-slate-200">{title}</span>
                  <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                    <span>{isPt ? 'Largura (cm)' : 'Width (cm)'}</span>
                    <input
                      type="number"
                      value={roomDimensions[surfaceId].widthCm}
                      onChange={(e) => updateDimension(surfaceId, 'widthCm', e.target.value)}
                      className="h-9 rounded-lg border border-slate-400/20 bg-[#0c1a36] px-2.5 text-xs text-slate-100 [font-variant-numeric:tabular-nums]"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                    <span>{isPt ? 'Altura (cm)' : 'Height (cm)'}</span>
                    <input
                      type="number"
                      value={roomDimensions[surfaceId].heightCm}
                      onChange={(e) => updateDimension(surfaceId, 'heightCm', e.target.value)}
                      className="h-9 rounded-lg border border-slate-400/20 bg-[#0c1a36] px-2.5 text-xs text-slate-100 [font-variant-numeric:tabular-nums]"
                    />
                  </label>
                </div>
              ))}
            </div>
          </section>

          {/* 2. Janelas de Projeção & Simulador */}
          <section className="rounded-2xl border border-slate-400/15 bg-[#080d19] p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Monitor size={16} className="text-amber-400" />
              <h2>{isPt ? 'Saídas de Vídeo & Telas' : 'Video Outputs & Screens'}</h2>
            </div>

            <div className="flex flex-col gap-2.5">
              {[
                {
                  href: '?view=projector&out=1',
                  label: isPt
                    ? 'Projetor 1 — Canto em L: Parede Esq (Globo) + Parede Dir (Robô) (#000)'
                    : 'Projector 1 — L-Corner: Left Wall (Globe) + Right Wall (Robot) (#000)',
                },
                {
                  href: '?view=projector&out=2',
                  label: isPt
                    ? 'Projetor 2 — Teto: 5 Camadas PNG Empilhadas (#000)'
                    : 'Projector 2 — Ceiling: 5 Stacked PNG Layers (#000)',
                },
                {
                  href: '?view=projector&out=3',
                  label: isPt
                    ? 'Saída Auxiliar 3 — Parede Direita Isolada (#000)'
                    : 'Aux Output 3 — Isolated Right Wall (#000)',
                },
                {
                  href: '?view=simulator',
                  label: isPt ? 'Simulador 3D do Quarto' : '3D Room Simulator',
                },
                {
                  href: '?view=controller',
                  label: isPt ? 'Controle do Tablet' : 'Tablet Controller',
                },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-[44px] items-center justify-between rounded-xl border border-slate-400/15 bg-white/[0.03] px-3.5 text-xs font-medium text-slate-100 hover:bg-white/[0.08]"
                >
                  <span>{link.label}</span>
                  <ExternalLink size={14} className="text-slate-400" />
                </a>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => updateCalibration({ ...calibration, showGrid: !calibration.showGrid })}
                className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition ${
                  calibration.showGrid
                    ? 'border-amber-400/60 bg-amber-400/15 text-amber-200'
                    : 'border-slate-400/20 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'
                }`}
              >
                <Grid size={14} />
                <span>
                  {calibration.showGrid
                    ? isPt
                      ? 'Grade Corner-Pin: ATIVA (Tecla C)'
                      : 'Corner-Pin Grid: ON (Key C)'
                    : isPt
                      ? 'Ativar Grade Corner-Pin nos Projetores'
                      : 'Enable Projector Corner-Pin Grid'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => updateCalibration(createDefaultCalibrationState())}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-400/20 bg-white/[0.03] px-3 text-xs font-medium text-slate-300 hover:bg-white/[0.08]"
                title={isPt ? 'Resetar 4 vértices de todas as saídas' : 'Reset all 4-point quads'}
              >
                <RotateCcw size={14} />
                <span>{isPt ? 'Resetar' : 'Reset'}</span>
              </button>
            </div>
          </section>
          <section className="rounded-2xl border border-slate-400/15 bg-[#080d19] p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Speaker size={16} className="text-emerald-400" />
              <h2>
                {isPt
                  ? 'Modo de Áudio Espacial & Calibração (Pessoa 2)'
                  : 'Spatial Audio Mode & Calibration (Person 2)'}
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['room3', '3 Caixas VBAP'],
                  ['hrtf', 'Fone 8D HRTF'],
                  ['5.1', 'Surround 5.1'],
                ] as [AudioOutputMode, string][]
              ).map(([mode, title]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAudioMode(mode)}
                  className={`min-h-[44px] rounded-xl border text-xs font-semibold transition ${
                    audioMode === mode
                      ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-200'
                      : 'border-slate-400/15 bg-white/[0.03] text-slate-300'
                  }`}
                >
                  {title}
                </button>
              ))}
            </div>

            <p className="mt-3 text-xs text-slate-400">
              {isPt
                ? 'Bancada pronta para receber Ruído Rosa A/B (0–200%), compensação de delay Bluetooth (0–400 ms) e seleção de dispositivos setSinkId.'
                : 'Workbench ready for Pink Noise A/B calibration (0–200%), Bluetooth delay compensation (0–400 ms), and setSinkId routing.'}
            </p>
          </section>

          {/* 4. Rede LAN & QR Code do Tablet */}
          <section className="rounded-2xl border border-slate-400/15 bg-[#080d19] p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-100">
              <QrCode size={16} className="text-rose-400" />
              <h2>{isPt ? 'Conexão LAN do Tablet' : 'Tablet LAN Connection'}</h2>
            </div>
            <p className="text-xs text-slate-300">
              {isPt
                ? 'Sincronização local entre abas (BroadcastChannel) já ativa neste computador. Servidor WebSocket LAN + QR Code entram na etapa da Pessoa 2.'
                : 'Local cross-tab sync (BroadcastChannel) is already active on this machine. LAN WebSocket server + QR Code plug in during Person 2 stage.'}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
};
