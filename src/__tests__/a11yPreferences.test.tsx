import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  A11Y_FONT_SCALE_KEY,
  A11Y_HIGH_CONTRAST_KEY,
  A11Y_REDUCE_MOTION_KEY,
  getNextFontScale,
  isEditableTarget,
  readStoredFontScale,
  readStoredHighContrast,
  readStoredReduceMotion,
  resolveA11yShortcutAction,
  writeStoredFontScale,
  writeStoredHighContrast,
  writeStoredReduceMotion,
} from '../accessibility/a11yPreferences';
import App from '../App';
import {
  AccessibilityWidget,
  shouldShowAccessibilityWidget,
} from '../components/AccessibilityWidget';
import { EntryPortal } from '../components/EntryPortal';
import { ExperienceProvider } from '../experience/ExperienceContext';
import { TabletControllerView } from '../views/TabletControllerView';
import { WebDemoView } from '../views/WebDemoView';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

describe('a11yPreferences — Global Shortcuts, Persistence & Non-Invasive Propagation', () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    if (originalWindow === undefined) {
      Reflect.deleteProperty(globalThis, 'window');
    } else {
      globalThis.window = originalWindow;
    }
  });

  it('cycles font scale 1 -> 1.15 -> 1.3 -> 1 and reads/writes localStorage with safe fallback', () => {
    expect(getNextFontScale(1)).toBe(1.15);
    expect(getNextFontScale(1.15)).toBe(1.3);
    expect(getNextFontScale(1.3)).toBe(1);

    // Sem window / localStorage: fallback seguro
    Reflect.deleteProperty(globalThis, 'window');
    expect(readStoredHighContrast()).toBe(false);
    expect(readStoredFontScale()).toBe(1);
    expect(() => writeStoredHighContrast(true)).not.toThrow();
    expect(() => writeStoredFontScale(1.3)).not.toThrow();

    // Com localStorage simulado
    const localStorage = createMemoryStorage();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: { localStorage },
    });

    writeStoredHighContrast(true);
    writeStoredFontScale(1.15);
    expect(localStorage.getItem(A11Y_HIGH_CONTRAST_KEY)).toBe('true');
    expect(localStorage.getItem(A11Y_FONT_SCALE_KEY)).toBe('1.15');
    expect(readStoredHighContrast()).toBe(true);
    expect(readStoredFontScale()).toBe(1.15);

    localStorage.setItem(A11Y_FONT_SCALE_KEY, 'invalid');
    expect(readStoredFontScale()).toBe(1);
  });

  it('resolves Alt+C and Alt+A shortcuts and ignores input, textarea, and select targets', () => {
    expect(
      resolveA11yShortcutAction({
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        key: 'c',
        code: 'KeyC',
        target: { tagName: 'DIV' } as unknown as EventTarget,
      })
    ).toBe('toggle-high-contrast');

    expect(
      resolveA11yShortcutAction({
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        key: 'a',
        code: 'KeyA',
        target: { tagName: 'BODY' } as unknown as EventTarget,
      })
    ).toBe('cycle-font-scale');

    expect(
      resolveA11yShortcutAction({
        altKey: true,
        ctrlKey: true,
        metaKey: false,
        key: 'c',
        code: 'KeyC',
        target: null,
      })
    ).toBeNull();

    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
      const target = { tagName } as unknown as EventTarget;
      expect(isEditableTarget(target)).toBe(true);
      expect(
        resolveA11yShortcutAction({
          altKey: true,
          ctrlKey: false,
          metaKey: false,
          key: 'c',
          code: 'KeyC',
          target,
        })
      ).toBeNull();
      expect(
        resolveA11yShortcutAction({
          altKey: true,
          ctrlKey: false,
          metaKey: false,
          key: 'a',
          code: 'KeyA',
          target,
        })
      ).toBeNull();
    }
  });

  it('renders aria-keyshortcuts and shortcut titles in EntryPortal', () => {
    const html = renderToStaticMarkup(
      <EntryPortal
        highContrast={false}
        onToggleHighContrast={() => {}}
        fontScale={1}
        onCycleFontScale={() => {}}
        onExploreEarth={() => {}}
      />
    );

    expect(html).toContain('aria-keyshortcuts="Alt+C"');
    expect(html).toContain('aria-keyshortcuts="Alt+A"');
    expect(html).toContain('Alternar Alto Contraste WCAG AAA (Alt+C)');
    expect(html).toContain('Alterar tamanho do texto (Alt+A)');
  });

  it('propagates high-contrast and fontScale non-invasively to WebDemoView and TabletControllerView', () => {
    const tabletDefault = renderToStaticMarkup(
      <ExperienceProvider activeView="controller" roomCode="ROOM11" onRegenerateRoomCode={vi.fn()}>
        <TabletControllerView highContrast={false} fontScale={1} />
      </ExperienceProvider>
    );
    expect(tabletDefault).not.toContain('high-contrast');
    expect(tabletDefault).not.toContain('data-a11y-scaled');

    const tabletScaled = renderToStaticMarkup(
      <ExperienceProvider activeView="controller" roomCode="ROOM11" onRegenerateRoomCode={vi.fn()}>
        <TabletControllerView highContrast={true} fontScale={1.15} />
      </ExperienceProvider>
    );
    expect(tabletScaled).toContain('high-contrast');
    expect(tabletScaled).toContain('font-size:115%');
    expect(tabletScaled).toContain('data-a11y-scaled="true"');

    const demoDefault = renderToStaticMarkup(
      <ExperienceProvider activeView="demo" roomCode="ROOM11" onRegenerateRoomCode={vi.fn()}>
        <WebDemoView highContrast={false} fontScale={1} />
      </ExperienceProvider>
    );
    expect(demoDefault).not.toContain('high-contrast');
    expect(demoDefault).not.toContain('data-a11y-scaled');

    const demoScaled = renderToStaticMarkup(
      <ExperienceProvider activeView="demo" roomCode="ROOM11" onRegenerateRoomCode={vi.fn()}>
        <WebDemoView highContrast={true} fontScale={1.3} />
      </ExperienceProvider>
    );
    expect(demoScaled).toContain('high-contrast');
    expect(demoScaled).toContain('font-size:130%');
    expect(demoScaled).toContain('data-a11y-scaled="true"');
  });

  it('persists reduceMotion preference safely in localStorage', () => {
    Reflect.deleteProperty(globalThis, 'window');
    expect(readStoredReduceMotion()).toBe(false);
    expect(() => writeStoredReduceMotion(true)).not.toThrow();

    const localStorage = createMemoryStorage();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: { localStorage },
    });

    writeStoredReduceMotion(true);
    expect(localStorage.getItem(A11Y_REDUCE_MOTION_KEY)).toBe('true');
    expect(readStoredReduceMotion()).toBe(true);

    writeStoredReduceMotion(false);
    expect(localStorage.getItem(A11Y_REDUCE_MOTION_KEY)).toBe('false');
    expect(readStoredReduceMotion()).toBe(false);
  });

  it('renders AccessibilityWidget in bottom-right corner with ARIA, shortcuts, and high-contrast/fontScale support', () => {
    const closedHtml = renderToStaticMarkup(
      <AccessibilityWidget
        highContrast={false}
        onToggleHighContrast={() => {}}
        fontScale={1}
        onCycleFontScale={() => {}}
        reduceMotion={false}
        onToggleReduceMotion={() => {}}
      />
    );
    expect(closedHtml).toContain('fixed bottom-4 right-4 z-50');
    expect(closedHtml).toContain('data-testid="a11y-widget-trigger"');
    expect(closedHtml).toContain('aria-label="Open accessibility options"');
    expect(closedHtml).toContain('aria-expanded="false"');
    expect(closedHtml).toContain('aria-controls="a11y-widget-panel"');
    expect(closedHtml).not.toContain('data-testid="a11y-widget-panel"');

    const openHtml = renderToStaticMarkup(
      <AccessibilityWidget
        highContrast={true}
        onToggleHighContrast={() => {}}
        fontScale={1.15}
        onCycleFontScale={() => {}}
        reduceMotion={true}
        onToggleReduceMotion={() => {}}
        defaultOpen={true}
      />
    );
    expect(openHtml).toContain('aria-expanded="true"');
    expect(openHtml).toContain('data-testid="a11y-widget-panel"');
    expect(openHtml).toContain('role="dialog"');
    expect(openHtml).toContain('aria-label="Accessibility options"');

    const ptOpenHtml = renderToStaticMarkup(
      <AccessibilityWidget
        highContrast={false}
        onToggleHighContrast={() => {}}
        fontScale={1}
        onCycleFontScale={() => {}}
        reduceMotion={false}
        onToggleReduceMotion={() => {}}
        lang="pt"
        defaultOpen={true}
      />
    );
    expect(ptOpenHtml).toContain('aria-label="Abrir opções de acessibilidade"');
    expect(ptOpenHtml).toContain('aria-label="Opções de acessibilidade"');
    expect(openHtml).toContain('data-testid="a11y-widget-contrast"');
    expect(openHtml).toContain('aria-pressed="true"');
    expect(openHtml).toContain('Alt+C');
    expect(openHtml).toContain('data-testid="a11y-widget-font"');
    expect(openHtml).toContain('115%');
    expect(openHtml).toContain('Alt+A');
    expect(openHtml).toContain('data-testid="a11y-widget-motion"');
    expect(openHtml).toContain('data-testid="a11y-widget-close"');
    expect(openHtml).toContain('high-contrast');
    expect(openHtml).toContain('data-a11y-scaled="true"');
    expect(openHtml).toContain('font-size:115%');
  });

  it('shows AccessibilityWidget only on interactive views and never on projection or audio views', () => {
    expect(shouldShowAccessibilityWidget('portal')).toBe(true);
    expect(shouldShowAccessibilityWidget('demo')).toBe(true);
    expect(shouldShowAccessibilityWidget('simulator')).toBe(true);
    expect(shouldShowAccessibilityWidget('controller')).toBe(true);
    expect(shouldShowAccessibilityWidget('setup')).toBe(true);
    expect(shouldShowAccessibilityWidget('admin')).toBe(true);

    expect(shouldShowAccessibilityWidget('projector')).toBe(false);
    expect(shouldShowAccessibilityWidget('audio-node')).toBe(false);
    expect(shouldShowAccessibilityWidget('portal', '?view=wall-left')).toBe(false);
    expect(shouldShowAccessibilityWidget('portal', '?view=wall-right')).toBe(false);
    expect(shouldShowAccessibilityWidget('portal', '?view=ceiling')).toBe(false);
    expect(shouldShowAccessibilityWidget('portal', '?view=projector&out=1')).toBe(false);
    expect(shouldShowAccessibilityWidget('portal', '?view=audio')).toBe(false);

    const localStorage = createMemoryStorage();
    const renderAppForSearch = (search: string) => {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        writable: true,
        value: {
          localStorage,
          location: { search, pathname: '/' },
          addEventListener: () => {},
          removeEventListener: () => {},
          matchMedia: () => ({
            matches: false,
            addEventListener: () => {},
            removeEventListener: () => {},
          }),
        },
      });
      return renderToStaticMarkup(<App />);
    };

    expect(renderAppForSearch('')).toContain('data-testid="a11y-widget-trigger"');
    expect(renderAppForSearch('?view=demo')).toContain('data-testid="a11y-widget-trigger"');
    expect(renderAppForSearch('?view=controller&room=ABC123')).toContain('data-testid="a11y-widget-trigger"');
    expect(renderAppForSearch('?view=setup&room=ABC123')).toContain('data-testid="a11y-widget-trigger"');

    expect(renderAppForSearch('?view=projector&out=1&room=ABC123')).not.toContain('data-testid="a11y-widget-trigger"');
    expect(renderAppForSearch('?view=wall-left')).not.toContain('data-testid="a11y-widget-trigger"');
    expect(renderAppForSearch('?view=wall-right')).not.toContain('data-testid="a11y-widget-trigger"');
    expect(renderAppForSearch('?view=ceiling')).not.toContain('data-testid="a11y-widget-trigger"');
    expect(renderAppForSearch('?view=audio-node&spk=1&room=ABC123')).not.toContain('data-testid="a11y-widget-trigger"');
  });
});
