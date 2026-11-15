import React from 'react';

interface SpeechBubbleOvalProps {
  title?: string;
  body: string;
  accentHex?: string;
}

/**
 * Balão de fala oval clássico (estilo HQ/ilustração) com cauda pontuda diagonal
 * apontando para baixo-esquerda em direção ao robô MINEIRØ.
 */
export const SpeechBubbleOval: React.FC<SpeechBubbleOvalProps> = ({
  title,
  body,
  accentHex = '#e2e8f0',
}) => {
  return (
    <div className="relative flex w-[148px] items-center justify-center px-5 pt-3.5 pb-6 text-center sm:w-[164px]">
      {/* Forma SVG oval exata com pontinha diagonal inferior esquerda */}
      <svg
        viewBox="0 0 260 170"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ filter: `drop-shadow(0 0 12px ${accentHex}26)` }}
        aria-hidden="true"
      >
        <path
          d="M 132 10
             C 198 10, 248 40, 248 78
             C 248 116, 198 144, 132 144
             C 114 144, 97 142, 82 138
             L 44 162
             L 58 128
             C 31 116, 14 98, 14 78
             C 14 40, 66 10, 132 10 Z"
          fill="rgba(6, 12, 26, 0.94)"
          stroke={accentHex}
          strokeWidth="3.2"
          strokeLinejoin="round"
        />
      </svg>

      <div className="relative z-10 flex flex-col items-center">
        {title && (
          <div className="text-[9.5px] font-semibold leading-tight tracking-tight text-slate-50">
            {title}
          </div>
        )}
        <p className="mt-0.5 text-[8.5px] leading-tight text-slate-200">{body}</p>
      </div>
    </div>
  );
};
