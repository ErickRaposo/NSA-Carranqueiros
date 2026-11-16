import React from 'react';

interface MineiroDroneBadgeProps {
  /** Short message displayed in the speech bubble beside or above the robot */
  speech?: string;
  /** Bubble placement relative to the robot (the pointer always aims at the robot) */
  bubblePosition?: 'right' | 'left' | 'top';
  /** Accent color for the current layer/action */
  accentHex?: string;
}

/**
 * Lightweight, compact representation of the MINEIRØ robot (scaled for projected walls)
 * for flying across surfaces (Globe and Ceiling) without opening multiple WebGL contexts.
 */
export const MineiroDroneBadge: React.FC<MineiroDroneBadgeProps> = ({
  speech,
  bubblePosition = 'right',
  accentHex = '#38bdf8',
}) => {
  const layoutClass =
    bubblePosition === 'top'
      ? 'flex-col-reverse items-center gap-1.5'
      : bubblePosition === 'left'
        ? 'flex-row-reverse items-center gap-2'
        : 'flex-row items-center gap-2';

  const tailClass =
    bubblePosition === 'top'
      ? '-bottom-1 left-1/2 -translate-x-1/2 border-r border-b'
      : bubblePosition === 'left'
        ? '-right-1 top-1/2 -translate-y-1/2 border-t border-r'
        : '-left-1 top-1/2 -translate-y-1/2 border-b border-l';

  return (
    <div className={`pointer-events-none flex select-none ${layoutClass}`}>
      <div
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-700/60 bg-slate-950/90 shadow-md"
        style={{
          boxShadow: `0 0 16px ${accentHex}2e`,
          animation: 'bounce 3.2s ease-in-out infinite',
        }}
      >
        <svg viewBox="0 0 64 64" className="h-7 w-7" aria-hidden="true">
          <ellipse
            cx="32"
            cy="34"
            rx="26"
            ry="8"
            transform="rotate(-18 32 34)"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="2.4"
            opacity="0.82"
          />
          <circle cx="32" cy="32" r="16" fill="#eaf0f9" />
          <rect x="20" y="25" width="24" height="13" rx="6.5" fill="#061229" />
          <circle cx="27" cy="31" r="2.3" fill="#e0f2fe" />
          <circle cx="37" cy="31" r="2.3" fill="#e0f2fe" />
          <rect x="28" y="35" width="8" height="1.8" rx="0.9" fill="#bae6fd" opacity="0.85" />
        </svg>
      </div>

      {speech && (
        <div
          className="relative max-w-[175px] rounded-xl border border-slate-700/70 bg-slate-950/92 px-2.5 py-1.5 text-[10px] leading-snug text-slate-100 backdrop-blur-md"
          style={{ boxShadow: `0 0 14px ${accentHex}1f` }}
        >
          <span
            className={`absolute h-2 w-2 rotate-45 border-slate-700/70 bg-slate-950/92 ${tailClass}`}
            aria-hidden="true"
          />
          <span className="relative z-10">{speech}</span>
        </div>
      )}
    </div>
  );
};
