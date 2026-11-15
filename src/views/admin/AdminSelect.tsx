import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { ADMIN_FOCUS } from './adminMeta';

export interface AdminSelectOption {
  value: string;
  label: string;
  badge?: string;
}

interface AdminSelectProps {
  ariaLabel: string;
  value: string;
  options: AdminSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const AdminSelect: React.FC<AdminSelectProps> = ({
  ariaLabel,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = '—',
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const current = options.find((opt) => opt.value === value);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`flex min-h-[40px] w-full items-center justify-between gap-2 rounded-xl border border-[#1e3a66] bg-[#0c1a36] px-3 text-left text-xs font-medium text-slate-100 transition hover:border-[#2563eb]/70 disabled:cursor-not-allowed disabled:opacity-50 ${ADMIN_FOCUS}`}
      >
        <span className="truncate">
          {current ? (
            <>
              {current.badge ? (
                <span className="mr-1.5 text-slate-300">{current.badge}</span>
              ) : null}
              {current.label}
            </>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="admin-scroll absolute right-0 left-0 z-50 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-[#1e3a66] bg-[#080d19] p-1 shadow-[0_12px_28px_rgba(2,5,13,0.9)]"
        >
          {options.map((opt) => {
            const selected = opt.value === value;
            return (
              <li key={opt.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex min-h-[38px] w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left text-xs transition ${ADMIN_FOCUS} ${
                    selected
                      ? 'bg-[#0c1a36] font-semibold text-white'
                      : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  <span className="truncate">
                    {opt.badge ? <span className="mr-1.5 text-slate-300">{opt.badge}</span> : null}
                    {opt.label}
                  </span>
                  {selected ? <Check size={13} className="shrink-0 text-[#7dd3fc]" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
