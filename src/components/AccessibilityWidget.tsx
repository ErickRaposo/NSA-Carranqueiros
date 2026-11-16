import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Accessibility, Activity, Contrast, Type, X } from 'lucide-react';
import { A11yFontScale } from '../accessibility/a11yPreferences';
import { Lang, ViewRole } from '../experience/types';

const HIDDEN_RAW_VIEWS = new Set([
  'wall-left',
  'wall-right',
  'ceiling',
  'projector',
  'audio',
  'audio-node',
]);

/**
 * Ensures the floating widget never appears on projection screens or audio nodes,
 * only in user-interactive interfaces (Portal, Demo, Controller, Setup, Admin).
 */
export function shouldShowAccessibilityWidget(view: ViewRole, search = ''): boolean {
  if (view === 'projector' || view === 'audio-node') {
    return false;
  }
  if (search) {
    const rawView = new URLSearchParams(search).get('view')?.toLowerCase() ?? '';
    if (HIDDEN_RAW_VIEWS.has(rawView)) {
      return false;
    }
  }
  return true;
}

export interface AccessibilityWidgetProps {
  highContrast: boolean;
  onToggleHighContrast: () => void;
  fontScale: A11yFontScale;
  onCycleFontScale: () => void;
  reduceMotion: boolean;
  onToggleReduceMotion: () => void;
  lang?: Lang;
  defaultOpen?: boolean;
}

export const AccessibilityWidget: React.FC<AccessibilityWidgetProps> = ({
  highContrast,
  onToggleHighContrast,
  fontScale,
  onCycleFontScale,
  reduceMotion,
  onToggleReduceMotion,
  lang = 'en',
  defaultOpen = false,
}) => {
  const isPt = lang === 'pt';
  const [open, setOpen] = useState(defaultOpen);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const closePanel = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePanel(true);
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        closePanel(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open, closePanel]);

  const fontScalePercent = `${Math.round(fontScale * 100)}%`;

  const panelStyle: React.CSSProperties = {
    fontFamily: "'Poppins', sans-serif",
    backgroundColor: highContrast ? '#000000' : 'rgba(9, 14, 28, 0.88)',
    borderColor: highContrast ? '#ffffff' : 'rgba(148, 163, 184, 0.22)',
    color: highContrast ? '#ffffff' : '#f1f5f9',
    ...(fontScale !== 1
      ? ({
          fontSize: fontScalePercent,
          '--font-scale': fontScale,
        } as React.CSSProperties)
      : {}),
  };

  const triggerStyle: React.CSSProperties = {
    fontFamily: "'Poppins', sans-serif",
    backgroundColor: highContrast ? '#000000' : 'rgba(9, 14, 28, 0.88)',
    borderColor: highContrast ? '#ffffff' : 'rgba(148, 163, 184, 0.22)',
    color: highContrast ? '#ffffff' : '#e2e8f0',
  };

  const itemBaseClass =
    'w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7dd3fc] focus-visible:ring-offset-2 focus-visible:ring-offset-[#060913]';

  const getItemStyle = (active: boolean): React.CSSProperties => {
    if (highContrast) {
      return active
        ? {
            backgroundColor: '#ffffff',
            color: '#000000',
            borderColor: '#ffffff',
          }
        : {
            backgroundColor: '#000000',
            color: '#ffffff',
            borderColor: '#ffffff',
          };
    }
    return active
      ? {
          backgroundColor: 'rgba(125, 211, 252, 0.16)',
          color: '#f8fafc',
          borderColor: 'rgba(125, 211, 252, 0.45)',
        }
      : {
          backgroundColor: 'rgba(6, 9, 19, 0.65)',
          color: '#cbd5e1',
          borderColor: 'rgba(148, 163, 184, 0.18)',
        };
  };

  return (
    <div
      ref={containerRef}
      className={`fixed bottom-4 right-4 z-50 flex flex-col items-end${highContrast ? ' high-contrast' : ''}`}
      data-testid="a11y-widget-root"
      data-a11y-scaled={fontScale > 1 ? 'true' : undefined}
    >
      {open && (
        <div
          id="a11y-widget-panel"
          data-testid="a11y-widget-panel"
          role="dialog"
          aria-modal="false"
          aria-label={isPt ? 'Opções de acessibilidade' : 'Accessibility options'}
          style={panelStyle}
          className="mb-2.5 w-[296px] max-w-[calc(100vw-2rem)] rounded-2xl border p-3.5 shadow-2xl backdrop-blur-md"
        >
          <div className="mb-2.5 flex items-center justify-between gap-2 border-b border-slate-400/20 pb-2">
            <div className="flex items-center gap-2">
              <Accessibility className="h-4 w-4 text-[#7dd3fc]" aria-hidden="true" />
              <span className="text-xs font-semibold tracking-wide uppercase">
                {isPt ? 'Acessibilidade' : 'Accessibility'}
              </span>
            </div>
            <button
              type="button"
              data-testid="a11y-widget-close"
              aria-label={isPt ? 'Fechar opções de acessibilidade' : 'Close accessibility options'}
              onClick={() => closePanel(true)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-400/25 text-slate-300 transition-colors hover:bg-slate-800/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7dd3fc]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              data-testid="a11y-widget-contrast"
              aria-pressed={highContrast}
              aria-keyshortcuts="Alt+C"
              onClick={onToggleHighContrast}
              style={getItemStyle(highContrast)}
              className={itemBaseClass}
            >
              <span className="flex items-center gap-2 text-xs font-medium">
                <Contrast className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{isPt ? 'Alto Contraste AAA' : 'High Contrast AAA'}</span>
              </span>
              <span className="flex items-center gap-1.5 text-[11px] opacity-85">
                <kbd className="rounded border border-current/30 px-1.5 py-0.5 text-[10px]">
                  Alt+C
                </kbd>
                <span>{highContrast ? (isPt ? 'Ativo' : 'On') : 'Off'}</span>
              </span>
            </button>

            <button
              type="button"
              data-testid="a11y-widget-font"
              aria-keyshortcuts="Alt+A"
              onClick={onCycleFontScale}
              style={getItemStyle(fontScale > 1)}
              className={itemBaseClass}
            >
              <span className="flex items-center gap-2 text-xs font-medium">
                <Type className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{isPt ? 'Tamanho da Letra' : 'Text Size'}</span>
              </span>
              <span className="flex items-center gap-1.5 text-[11px] opacity-85">
                <kbd className="rounded border border-current/30 px-1.5 py-0.5 text-[10px]">
                  Alt+A
                </kbd>
                <span className="font-semibold">{fontScalePercent}</span>
              </span>
            </button>

            <button
              type="button"
              data-testid="a11y-widget-motion"
              aria-pressed={reduceMotion}
              onClick={onToggleReduceMotion}
              style={getItemStyle(reduceMotion)}
              className={itemBaseClass}
            >
              <span className="flex items-center gap-2 text-xs font-medium">
                <Activity className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{isPt ? 'Reduzir Movimento' : 'Reduce Motion'}</span>
              </span>
              <span className="text-[11px] opacity-85">
                {reduceMotion ? (isPt ? 'Ativo' : 'On') : 'Off'}
              </span>
            </button>
          </div>

          <p className="mt-2.5 border-t border-slate-400/20 pt-2 text-[11px] leading-snug opacity-80">
            {isPt ? (
              <>
                Teclado: <kbd className="font-semibold">Tab</kbd> /{' '}
                <kbd className="font-semibold">Shift+Tab</kbd> navega,{' '}
                <kbd className="font-semibold">Enter</kbd> ativa,{' '}
                <kbd className="font-semibold">Esc</kbd> fecha.
              </>
            ) : (
              <>
                Keyboard: <kbd className="font-semibold">Tab</kbd> /{' '}
                <kbd className="font-semibold">Shift+Tab</kbd> navigate,{' '}
                <kbd className="font-semibold">Enter</kbd> activate,{' '}
                <kbd className="font-semibold">Esc</kbd> close.
              </>
            )}
          </p>
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        data-testid="a11y-widget-trigger"
        aria-label={isPt ? 'Abrir opções de acessibilidade' : 'Open accessibility options'}
        aria-expanded={open}
        aria-controls="a11y-widget-panel"
        onClick={() => setOpen((prev) => !prev)}
        style={triggerStyle}
        className="inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-xs font-medium shadow-lg backdrop-blur-md transition-colors hover:border-[#7dd3fc]/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7dd3fc] focus-visible:ring-offset-2 focus-visible:ring-offset-[#060913]"
      >
        <Accessibility className="h-4 w-4 shrink-0 text-[#7dd3fc]" aria-hidden="true" />
        <span className="hidden sm:inline">{isPt ? 'Acessibilidade' : 'Accessibility'}</span>
      </button>
    </div>
  );
};
