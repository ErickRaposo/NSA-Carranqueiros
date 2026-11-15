import React from 'react';
import {
  AudioCalibrationState,
  SPEAKER_IDS,
  speakerSlotIdToIndex,
  SpeakerSlotId,
} from '../../audio/speakerCalibration';
import {
  isDelayClickSpeakerActive,
  isPinkNoiseSpeakerActive,
} from '../../audio/spatialAudioEngine';
import { AudioAdminContextValue } from '../../experience/ExperienceContext';
import { LiveNoteEvent, SurfaceId } from '../../experience/types';

interface AcousticStage2DProps {
  isPt: boolean;
  surfaceToOutLabels: Record<SurfaceId, string[]>;
  liveEvents: LiveNoteEvent[];
  speakerCalibration: AudioCalibrationState;
  calibTestMode: AudioAdminContextValue['calibTestMode'];
}

interface CabinetAnchor {
  x: number;
  y: number;
  tiltDeg: number;
  waveAngleDeg: number;
  badgeDx: number;
  badgeDy: number;
  shortZonePt: string;
  shortZoneEn: string;
}

const CABINET_ANCHORS: Record<SpeakerSlotId, CabinetAnchor> = {
  speaker1: {
    x: 84,
    y: 128,
    tiltDeg: -24,
    waveAngleDeg: 14,
    badgeDx: 0,
    badgeDy: 34,
    shortZonePt: 'Esq',
    shortZoneEn: 'Left',
  },
  speaker2: {
    x: 336,
    y: 128,
    tiltDeg: 24,
    waveAngleDeg: 166,
    badgeDx: 0,
    badgeDy: 34,
    shortZonePt: 'Dir',
    shortZoneEn: 'Right',
  },
  speaker3: {
    x: 210,
    y: 208,
    tiltDeg: 0,
    waveAngleDeg: -90,
    badgeDx: 0,
    badgeDy: 32,
    shortZonePt: 'Teto',
    shortZoneEn: 'Ceil',
  },
};

function isSpeakerReceivingTest(
  calibTestMode: AudioAdminContextValue['calibTestMode'],
  spkId: SpeakerSlotId,
  refId: SpeakerSlotId
): boolean {
  return (
    isPinkNoiseSpeakerActive(calibTestMode, spkId) ||
    isDelayClickSpeakerActive(calibTestMode, spkId, refId)
  );
}

/**
 * Planta Arquitetônica 2D minimalista e não-interativa da sala em canto 90° + teto.
 */
export const AcousticStage2D: React.FC<AcousticStage2DProps> = ({
  isPt,
  surfaceToOutLabels,
  liveEvents,
  speakerCalibration,
  calibTestMode,
}) => {
  const refId = speakerCalibration.referenceSpeakerId;
  const activeSoundObjects = liveEvents.slice(-5);

  return (
    <div className="pointer-events-none select-none overflow-hidden rounded-xl border border-[#1e3a66]/50 bg-[#040b1a]">
      <svg
        viewBox="0 0 420 264"
        className="block h-auto w-full"
        role="img"
        aria-label={isPt ? 'Guia visual minimalista das 3 caixas 8D' : 'Minimalist 8D speaker placement blueprint'}
      >
        <defs>
          <pattern id="ej-blueprint-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#1e3a66" strokeWidth="0.6" strokeOpacity="0.28" />
          </pattern>

          <radialGradient id="ej-sweetspot-minimal" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#040b1a" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Fundo com grade arquitetônica leve */}
        <rect x="0" y="0" width="420" height="264" fill="#040b1a" />
        <rect x="0" y="0" width="420" height="264" fill="url(#ej-blueprint-grid)" />

        {/* Canto arquitetônico 90° limpo */}
        <polyline
          points="56,112 210,32 364,112"
          fill="none"
          stroke="#7dd3fc"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.85"
        />
        <text x="210" y="22" textAnchor="middle" fill="#64748b" fontSize="11" fontWeight="600">
          90°
        </text>

        {/* Rótulos discretos das paredes e teto */}
        <text
          x="122"
          y="63"
          textAnchor="middle"
          transform="rotate(-27 122 63)"
          fill="#94a3b8"
          fontSize="11"
          fontWeight="500"
        >
          {isPt ? 'Parede Esq' : 'Left Wall'}
          {surfaceToOutLabels.leftWall.length > 0 ? ` · ${surfaceToOutLabels.leftWall[0]}` : ''}
        </text>
        <text
          x="298"
          y="63"
          textAnchor="middle"
          transform="rotate(27 298 63)"
          fill="#94a3b8"
          fontSize="11"
          fontWeight="500"
        >
          {isPt ? 'Parede Dir' : 'Right Wall'}
          {surfaceToOutLabels.rightWall.length > 0 ? ` · ${surfaceToOutLabels.rightWall[0]}` : ''}
        </text>

        {/* Contorno tracejado sutil da área de projeção do Teto */}
        <polygon
          points="146,124 210,88 274,124 210,174"
          fill="#0c1a36"
          fillOpacity="0.24"
          stroke="#1e3a66"
          strokeWidth="1"
          strokeDasharray="3 4"
        />
        <text x="210" y="106" textAnchor="middle" fill="#7dd3fc" fillOpacity="0.75" fontSize="11" fontWeight="500">
          {isPt ? 'Teto' : 'Ceiling'}
          {surfaceToOutLabels.ceiling.length > 0 ? ` · ${surfaceToOutLabels.ceiling[0]}` : ''}
        </text>

        {/* Eixos sutis convergente ao ponto doce */}
        <line x1="98" y1="130" x2="210" y2="138" stroke="#1e3a66" strokeWidth="0.9" strokeOpacity="0.55" strokeDasharray="2 4" />
        <line x1="322" y1="130" x2="210" y2="138" stroke="#1e3a66" strokeWidth="0.9" strokeOpacity="0.55" strokeDasharray="2 4" />
        <line x1="210" y1="190" x2="210" y2="138" stroke="#1e3a66" strokeWidth="0.9" strokeOpacity="0.55" strokeDasharray="2 4" />

        {/* Ponto doce central 8D */}
        <circle cx="210" cy="138" r="44" fill="url(#ej-sweetspot-minimal)" />
        <circle
          cx="210"
          cy="138"
          r="17"
          fill="#060c1a"
          stroke="#1e3a66"
          strokeWidth="1.2"
        />
        <text x="210" y="142" textAnchor="middle" fill="#cbd5e1" fontSize="11" fontWeight="600">
          8D
        </text>

        {/* Fontes sonoras ativas */}
        {activeSoundObjects.map((ev, idx) => {
          const left = 96 + Math.max(0, Math.min(1, ev.sourceX)) * 228;
          const top = 86 + Math.max(0, Math.min(1, ev.sourceY)) * 88;
          const opacity = Math.min(0.9, 0.35 + (idx / activeSoundObjects.length) * 0.55);
          return (
            <circle
              key={`${ev.layer}-${idx}`}
              cx={left}
              cy={top}
              r={3.5}
              fill="#7dd3fc"
              fillOpacity={opacity}
            />
          );
        })}

        {/* As 3 caixas acústicas minimalistas: C1, C2 e C3 */}
        {SPEAKER_IDS.map((spkId) => {
          const anchor = CABINET_ANCHORS[spkId];
          const cfg = speakerCalibration.speakers[spkId];
          const spkLabel = `C${speakerSlotIdToIndex(spkId)}`;
          const isRef = refId === spkId;
          const isTesting = isSpeakerReceivingTest(calibTestMode, spkId, refId);
          const strokeMain = cfg.muted
            ? '#475569'
            : isTesting
              ? '#7dd3fc'
              : isRef
                ? '#60a5fa'
                : '#2563eb';
          const zoneLabel = isPt ? anchor.shortZonePt : anchor.shortZoneEn;

          return (
            <g key={spkId}>
              {/* Arco discreto de dispersão sonora */}
              {!cfg.muted && (
                <g
                  transform={`translate(${anchor.x}, ${anchor.y}) rotate(${anchor.waveAngleDeg})`}
                  opacity={isTesting ? 0.95 : 0.4}
                >
                  <path
                    d="M 20 -8 A 20 20 0 0 1 20 8"
                    fill="none"
                    stroke={isTesting ? '#7dd3fc' : '#38bdf8'}
                    strokeWidth={isTesting ? 1.6 : 1.1}
                    strokeLinecap="round"
                  />
                  {isTesting && (
                    <path
                      d="M 26 -13 A 27 27 0 0 1 26 13"
                      fill="none"
                      stroke="#7dd3fc"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                  )}
                </g>
              )}

              {/* Silhueta geométrica limpa da caixa de som */}
              <g transform={`translate(${anchor.x}, ${anchor.y}) rotate(${anchor.tiltDeg})`}>
                <rect
                  x="-13"
                  y="-17"
                  width="26"
                  height="34"
                  rx="5"
                  fill="#060c1a"
                  stroke={strokeMain}
                  strokeWidth={isTesting ? 1.8 : 1.3}
                  opacity={cfg.muted ? 0.5 : 1}
                />
                {/* Tweeter superior */}
                <circle
                  cx="0"
                  cy="-8"
                  r="2.6"
                  fill={cfg.muted ? '#475569' : isTesting ? '#7dd3fc' : '#1e3a66'}
                />
                {/* Woofer principal */}
                <circle
                  cx="0"
                  cy="5"
                  r="7.2"
                  fill="#040914"
                  stroke={strokeMain}
                  strokeWidth="1.1"
                />
                <circle
                  cx="0"
                  cy="5"
                  r="2.4"
                  fill={cfg.muted ? '#334155' : isTesting ? '#7dd3fc' : '#2563eb'}
                />
              </g>

              {/* Tag minimalista da caixa */}
              <g transform={`translate(${anchor.x + anchor.badgeDx}, ${anchor.y + anchor.badgeDy})`}>
                <rect
                  x="-46"
                  y="-11"
                  width="92"
                  height="20"
                  rx="10"
                  fill={isTesting ? '#0c2348' : '#060c1a'}
                  stroke={strokeMain}
                  strokeOpacity="0.7"
                  strokeWidth="0.9"
                />
                <text x="0" y="3" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="600">
                  {spkLabel} · {zoneLabel} ·{' '}
                  {cfg.muted ? 'MUTE' : `${Math.round(cfg.calibrationGain * 100)}%`}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
