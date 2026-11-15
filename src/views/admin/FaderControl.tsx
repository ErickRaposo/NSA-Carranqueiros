import React, { useRef } from 'react';
import { ADMIN_FOCUS } from './adminMeta';

interface FaderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  accent?: 'emerald' | 'sky' | 'amber';
  orientation?: 'horizontal' | 'vertical';
  compact?: boolean;
  valueText: string;
  onChange: (next: number) => void;
  onReset?: () => void;
  resetTitle?: string;
}

export const FaderControl: React.FC<FaderControlProps> = ({
  label,
  value,
  min,
  max,
  step,
  orientation = 'horizontal',
  compact = false,
  valueText,
  onChange,
  onReset,
  resetTitle,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const span = Math.max(1e-6, max - min);
  const ratio = Math.min(1, Math.max(0, (value - min) / span));

  const quantize = (raw: number) => {
    const clamped = Math.min(max, Math.max(min, raw));
    const stepped = Math.round((clamped - min) / step) * step + min;
    return Number(Math.min(max, Math.max(min, stepped)).toFixed(4));
  };

  const updateFromPointer = (clientX: number, clientY: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (orientation === 'vertical') {
      if (rect.height <= 0) return;
      const pct = Math.min(1, Math.max(0, (rect.bottom - clientY) / rect.height));
      onChange(quantize(min + pct * span));
      return;
    }
    if (rect.width <= 0) return;
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onChange(quantize(min + pct * span));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const coarse = step * 5;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(quantize(value + (e.shiftKey ? coarse : step)));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(quantize(value - (e.shiftKey ? coarse : step)));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(min);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(max);
    }
  };

  if (orientation === 'vertical') {
    const pctString = `${Math.round(ratio * 100)}%`;
    const maxPct = Math.round(max * 100);
    const midPct = Math.round(((min + max) / 2) * 100);
    const minPct = Math.round(min * 100);
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex w-full items-center justify-between text-xs [font-variant-numeric:tabular-nums]">
          <span className="text-slate-400">{label}</span>
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              className={`min-h-[24px] rounded px-1 font-semibold text-slate-100 hover:underline ${ADMIN_FOCUS}`}
              title={resetTitle}
            >
              {valueText}
            </button>
          ) : (
            <span className="font-semibold text-slate-100">{valueText}</span>
          )}
        </div>

        <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#1e3a66]/45 bg-[#040b1a] px-2 py-2.5">
          <div
            className={`flex ${compact ? 'h-24' : 'h-32'} flex-col justify-between text-right text-[11px] leading-none text-slate-400 select-none [font-variant-numeric:tabular-nums]`}
            aria-hidden="true"
          >
            <span>{maxPct}</span>
            <span>{midPct}</span>
            <span>{minPct}</span>
          </div>

          <div
            ref={trackRef}
            role="slider"
            tabIndex={0}
            aria-label={label}
            aria-orientation="vertical"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-valuetext={valueText}
            onKeyDown={handleKeyDown}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              updateFromPointer(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 0) return;
              updateFromPointer(e.clientX, e.clientY);
            }}
            className={`relative flex ${compact ? 'h-24' : 'h-32'} w-11 cursor-ns-resize items-end justify-center rounded-md bg-[#060913] py-2 select-none touch-none ${ADMIN_FOCUS}`}
          >
            <div className="relative h-full w-1.5 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="absolute inset-x-0 bottom-0 rounded-full bg-[#7dd3fc]"
                style={{ height: pctString }}
              />
            </div>

            <div
              className="pointer-events-none absolute left-1/2 flex h-4 w-8 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-sm border border-slate-300/60 bg-slate-100 shadow-sm"
              style={{ bottom: pctString }}
            >
              <span className="h-[1.5px] w-4 rounded-full bg-[#060913]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between text-xs [font-variant-numeric:tabular-nums]">
        <span className="text-slate-400">{label}</span>
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className={`min-h-[24px] rounded px-1 font-semibold text-slate-100 hover:underline ${ADMIN_FOCUS}`}
            title={resetTitle}
          >
            {valueText}
          </button>
        ) : (
          <span className="font-semibold text-slate-100">{valueText}</span>
        )}
      </div>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-orientation="horizontal"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueText}
        onKeyDown={handleKeyDown}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          updateFromPointer(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 0) return;
          updateFromPointer(e.clientX, e.clientY);
        }}
        className={`relative mt-1 flex h-9 w-full cursor-ew-resize items-center rounded-md border border-slate-400/15 bg-[#060c1a]/85 px-2 select-none touch-none ${ADMIN_FOCUS}`}
      >
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-sky-300"
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>
        <div
          className="pointer-events-none absolute top-1/2 h-4 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-slate-300/60 bg-slate-100 shadow-sm"
          style={{ left: `calc(${(ratio * 100).toFixed(1)}%)` }}
        />
      </div>
    </div>
  );
};
