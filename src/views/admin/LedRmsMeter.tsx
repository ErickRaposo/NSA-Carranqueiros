import React from 'react';

interface LedRmsMeterProps {
  value01: number;
  segments?: number;
  muted?: boolean;
  compact?: boolean;
  label?: string;
}

export const LedRmsMeter: React.FC<LedRmsMeterProps> = ({
  value01,
  segments = 8,
  muted = false,
  compact = false,
  label,
}) => {
  const clamped = muted ? 0 : Math.min(1, Math.max(0, value01));
  const litCount = Math.round(clamped * segments);

  return (
    <div
      className="flex items-center gap-1"
      title={label ? `${label}: ${Math.round(clamped * 100)}%` : `${Math.round(clamped * 100)}%`}
    >
      <div
        className={`flex items-center gap-[3px] rounded-md border border-slate-400/12 bg-[#040b1a] ${
          compact ? 'px-1.5 py-1' : 'px-2 py-1'
        }`}
        aria-hidden="true"
      >
        {Array.from({ length: segments }, (_, i) => {
          const active = i < litCount;
          const ratio = (i + 1) / segments;
          const colorClass =
            ratio > 0.85
              ? active
                ? 'bg-amber-300'
                : 'bg-white/[0.06]'
              : active
                ? 'bg-sky-300'
                : 'bg-white/[0.06]';

          return (
            <span
              key={i}
              className={`block rounded-[1px] transition-colors duration-75 ${
                compact ? 'h-2.5 w-1' : 'h-3 w-1.5'
              } ${colorClass}`}
            />
          );
        })}
      </div>
    </div>
  );
};
