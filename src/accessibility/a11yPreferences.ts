import { useCallback, useEffect, useState } from 'react';

export const A11Y_HIGH_CONTRAST_KEY = 'mineiro_a11y_high_contrast';
export const A11Y_FONT_SCALE_KEY = 'mineiro_a11y_font_scale';
export const A11Y_REDUCE_MOTION_KEY = 'mineiro_a11y_reduce_motion';

export type A11yFontScale = 1 | 1.15 | 1.3;

function getSafeLocalStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      return window.localStorage;
    }
  } catch {
    // Ignore storage access errors in restricted environments/tests
  }
  return null;
}

export function readStoredHighContrast(): boolean {
  const storage = getSafeLocalStorage();
  if (!storage) return false;
  try {
    return storage.getItem(A11Y_HIGH_CONTRAST_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeStoredHighContrast(value: boolean): void {
  const storage = getSafeLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(A11Y_HIGH_CONTRAST_KEY, value ? 'true' : 'false');
  } catch {
    // Ignore storage write errors
  }
}

export function normalizeFontScale(raw: unknown): A11yFontScale {
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (num === 1.15 || num === 1.3) return num;
  return 1;
}

export function readStoredFontScale(): A11yFontScale {
  const storage = getSafeLocalStorage();
  if (!storage) return 1;
  try {
    return normalizeFontScale(storage.getItem(A11Y_FONT_SCALE_KEY));
  } catch {
    return 1;
  }
}

export function writeStoredFontScale(value: A11yFontScale): void {
  const storage = getSafeLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(A11Y_FONT_SCALE_KEY, String(value));
  } catch {
    // Ignore storage write errors
  }
}

export function readStoredReduceMotion(): boolean {
  const storage = getSafeLocalStorage();
  if (!storage) return false;
  try {
    return storage.getItem(A11Y_REDUCE_MOTION_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeStoredReduceMotion(value: boolean): void {
  const storage = getSafeLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(A11Y_REDUCE_MOTION_KEY, value ? 'true' : 'false');
  } catch {
    // Ignore storage write errors
  }
}

export function getNextFontScale(current: number): A11yFontScale {
  if (current === 1) return 1.15;
  if (current === 1.15) return 1.3;
  return 1;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') {
    return false;
  }
  const el = target as { tagName?: string; isContentEditable?: boolean };
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  return Boolean(el.isContentEditable);
}

export type A11yShortcutAction = 'toggle-high-contrast' | 'cycle-font-scale' | null;

export function resolveA11yShortcutAction(event: {
  defaultPrevented?: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  key: string;
  code?: string;
  target: EventTarget | null;
}): A11yShortcutAction {
  if (event.defaultPrevented) return null;
  if (!event.altKey || event.ctrlKey || event.metaKey) return null;
  if (isEditableTarget(event.target)) return null;

  const key = event.key.toLowerCase();
  if (key === 'c' || event.code === 'KeyC') {
    return 'toggle-high-contrast';
  }
  if (key === 'a' || event.code === 'KeyA') {
    return 'cycle-font-scale';
  }
  return null;
}

export function useA11yPreferences(lang: 'pt' | 'en' = 'en') {
  const isPt = lang === 'pt';
  const [highContrast, setHighContrast] = useState<boolean>(() => readStoredHighContrast());
  const [fontScale, setFontScale] = useState<A11yFontScale>(() => readStoredFontScale());
  const [reduceMotion, setReduceMotion] = useState<boolean>(() => readStoredReduceMotion());
  const [announcement, setAnnouncement] = useState<string>('');

  const toggleHighContrast = useCallback(() => {
    setHighContrast((prev) => {
      const next = !prev;
      writeStoredHighContrast(next);
      setAnnouncement(
        next
          ? isPt
            ? 'Alto contraste ativado'
            : 'High contrast enabled'
          : isPt
            ? 'Alto contraste desativado'
            : 'High contrast disabled'
      );
      return next;
    });
  }, [isPt]);

  const cycleFontScale = useCallback(() => {
    setFontScale((prev) => {
      const next = getNextFontScale(prev);
      writeStoredFontScale(next);
      setAnnouncement(
        isPt
          ? `Tamanho da letra: ${Math.round(next * 100)}%`
          : `Text size: ${Math.round(next * 100)}%`
      );
      return next;
    });
  }, [isPt]);

  const toggleReduceMotion = useCallback(() => {
    setReduceMotion((prev) => {
      const next = !prev;
      writeStoredReduceMotion(next);
      setAnnouncement(
        next
          ? isPt
            ? 'Movimento reduzido ativado'
            : 'Reduced motion enabled'
          : isPt
            ? 'Movimento reduzido desativado'
            : 'Reduced motion disabled'
      );
      return next;
    });
  }, [isPt]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('reduce-motion', reduceMotion);
  }, [reduceMotion]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const action = resolveA11yShortcutAction(event);
      if (action === 'toggle-high-contrast') {
        event.preventDefault();
        toggleHighContrast();
      } else if (action === 'cycle-font-scale') {
        event.preventDefault();
        cycleFontScale();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleHighContrast, cycleFontScale]);

  return {
    highContrast,
    fontScale,
    reduceMotion,
    announcement,
    toggleHighContrast,
    cycleFontScale,
    toggleReduceMotion,
  };
}
