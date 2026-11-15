import React, { useCallback, useEffect, useState } from 'react';
import { startSpaceAmbient } from './audio/spaceAmbient';
import { EntryPortal } from './components/EntryPortal';
import { ExperienceProvider } from './experience/ExperienceContext';
import { ProjectorOutId, ViewRole } from './experience/types';
import { ProjectorView } from './views/ProjectorView';
import { SetupView } from './views/SetupView';
import { SimulatorView } from './views/SimulatorView';
import { TabletControllerView } from './views/TabletControllerView';
import { WebDemoView } from './views/WebDemoView';

interface ParsedRoute {
  view: ViewRole;
  outId: ProjectorOutId;
}

export function parseRouteFromSearch(
  search: string,
  pathname = typeof window !== 'undefined' ? window.location.pathname : '/'
): ParsedRoute {
  const normalizedPath = pathname.replace(/\/+$/, '').toLowerCase();
  const params = new URLSearchParams(search);
  const rawView = (params.get('view') ?? '').toLowerCase();
  const validViews: ViewRole[] = ['setup', 'simulator', 'projector', 'controller', 'demo', 'portal'];

  let view: ViewRole = validViews.includes(rawView as ViewRole)
    ? (rawView as ViewRole)
    : 'portal';

  if (!rawView && (normalizedPath === '/controle' || normalizedPath === '/controller')) {
    view = 'controller';
  } else if (
    !rawView &&
    (normalizedPath === '/sala' || normalizedPath === '/demo')
  ) {
    view = 'demo';
  } else if (
    !rawView &&
    (normalizedPath === '/sobre' || normalizedPath === '/portal' || normalizedPath === '/equipe')
  ) {
    view = 'portal';
  }

  const rawOut = Number(params.get('out') ?? '1');
  const outId: ProjectorOutId = rawOut === 2 ? 2 : rawOut === 3 ? 3 : 1;

  return { view, outId };
}

export function App(): React.ReactElement {
  const [route, setRoute] = useState<ParsedRoute>(() =>
    typeof window !== 'undefined'
      ? parseRouteFromSearch(window.location.search)
      : { view: 'demo', outId: 1 }
  );

  useEffect(() => {
    const onPopState = () => {
      setRoute(parseRouteFromSearch(window.location.search));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (route.view !== 'setup') {
      startSpaceAmbient();
    }
  }, [route.view]);

  const navigateTo = useCallback((nextView: ViewRole, outId?: ProjectorOutId) => {
    const params = new URLSearchParams();
    params.set('view', nextView);
    if (nextView === 'projector') {
      params.set('out', String(outId ?? 1));
    }
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', nextUrl);
    setRoute(parseRouteFromSearch(`?${params.toString()}`));
  }, []);

  const isDev = Boolean(
    (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV
  );

  const [highContrast, setHighContrast] = useState(false);
  const [fontScale, setFontScale] = useState(1);

  return (
    <ExperienceProvider>
      {route.view === 'setup' && <SetupView />}
      {route.view === 'simulator' && <SimulatorView />}
      {route.view === 'projector' && <ProjectorView outId={route.outId} />}
      {route.view === 'controller' && <TabletControllerView />}
      {route.view === 'demo' && <WebDemoView />}
      {route.view === 'portal' && (
        <EntryPortal
          highContrast={highContrast}
          onToggleHighContrast={() => setHighContrast((prev) => !prev)}
          fontScale={fontScale}
          onCycleFontScale={() =>
            setFontScale((prev) => (prev === 1 ? 1.15 : prev === 1.15 ? 1.3 : 1))
          }
          onExploreEarth={() => navigateTo('demo')}
          onOpenAuth={() => navigateTo('simulator')}
          onOpenRegister={() => navigateTo('controller')}
        />
      )}

      {/* Barra flutuante discreta APENAS em dev local (oculta na tela limpa do projetor) */}
      {isDev && route.view !== 'projector' && (
        <nav
          aria-label="Dev View Switcher"
          className="fixed bottom-2.5 left-2.5 z-50 flex items-center gap-1 rounded-full border border-slate-400/20 bg-[#060c1a]/90 p-1 text-[11px] font-medium text-slate-300 shadow-lg backdrop-blur-md"
        >
          {(
            [
              ['portal', 'Portal'],
              ['demo', 'Demo'],
              ['controller', 'Tablet'],
              ['simulator', 'Simulator'],
              ['setup', 'Setup'],
            ] as [ViewRole, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => navigateTo(v)}
              className={`rounded-full px-2.5 py-1 transition ${
                route.view === v ? 'bg-white/15 font-semibold text-white' : 'hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => navigateTo('projector', 1)}
            className="rounded-full px-2.5 py-1 text-slate-400 hover:text-white"
            title="Abrir saída limpa do Projetor 1"
          >
            Out 1
          </button>
        </nav>
      )}
    </ExperienceProvider>
  );
}

export default App;
