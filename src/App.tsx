import React, { useCallback, useEffect, useState } from 'react';
import { EntryPortal } from './components/EntryPortal';
import { RoomAccessGate } from './components/RoomAccessGate';
import { ExperienceProvider } from './experience/ExperienceContext';
import { ProjectorOutId, SpeakerNodeIndex, ViewRole } from './experience/types';
import {
  generateRoomCode,
  normalizeRoomCode,
  readRoomCodeFromSearch,
} from './lan/roomCode';
import { AudioNodeView } from './views/AudioNodeView';
import { ProjectorView } from './views/ProjectorView';
import { SetupView } from './views/SetupView';
import { SetupWizardView } from './views/SetupWizardView';
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
  const validViews: ViewRole[] = [
    'setup',
    'admin',
    'simulator',
    'projector',
    'controller',
    'demo',
    'portal',
    'audio-node',
  ];

  let view: ViewRole = validViews.includes(rawView as ViewRole)
    ? (rawView as ViewRole)
    : 'portal';

  if (!rawView && (normalizedPath === '/controle' || normalizedPath === '/controller')) {
    view = 'controller';
  } else if (!rawView && (normalizedPath === '/sala' || normalizedPath === '/demo')) {
    view = 'demo';
  } else if (!rawView && normalizedPath === '/admin') {
    view = 'admin';
  } else if (
    !rawView &&
    (normalizedPath === '/setup' || normalizedPath === '/configurar')
  ) {
    view = 'setup';
  } else if (
    !rawView &&
    (normalizedPath === '/sobre' || normalizedPath === '/portal' || normalizedPath === '/equipe')
  ) {
    view = 'portal';
  }

  const rawOut = Number(params.get('out') ?? '1');
  const outId: ProjectorOutId =
    rawOut === 2 ? 2 : rawOut === 3 ? 3 : rawOut === 4 ? 4 : 1;

  return { view, outId };
}

export function parseSpeakerIndexFromSearch(search: string): SpeakerNodeIndex {
  const params = new URLSearchParams(search);
  const rawSpk = Number(params.get('spk') ?? '1');
  return rawSpk === 2 ? 2 : rawSpk === 3 ? 3 : 1;
}

export function App(): React.ReactElement {
  const [route, setRoute] = useState<ParsedRoute>(() =>
    typeof window !== 'undefined'
      ? parseRouteFromSearch(window.location.search)
      : { view: 'demo', outId: 1 }
  );
  const [spkIndex, setSpkIndex] = useState<SpeakerNodeIndex>(() =>
    typeof window !== 'undefined'
      ? parseSpeakerIndexFromSearch(window.location.search)
      : 1
  );
  const [roomCode, setRoomCode] = useState<string | null>(() =>
    typeof window !== 'undefined' ? readRoomCodeFromSearch(window.location.search) : null
  );

  useEffect(() => {
    const onPopState = () => {
      setRoute(parseRouteFromSearch(window.location.search));
      setSpkIndex(parseSpeakerIndexFromSearch(window.location.search));
      setRoomCode(readRoomCodeFromSearch(window.location.search));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Auto-gera código exclusivo de sala (?room=XXXXXX) ao entrar no Setup ou no Admin sem código
  useEffect(() => {
    if ((route.view === 'setup' || route.view === 'admin') && !roomCode) {
      const nextCode = generateRoomCode();
      setRoomCode(nextCode);
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (!params.get('view')) {
          params.set('view', route.view);
        }
        params.set('room', nextCode);
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
      }
    }
  }, [roomCode, route.view]);

  const handleRegenerateRoomCode = useCallback((): string => {
    const nextCode = generateRoomCode();
    setRoomCode(nextCode);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('room', nextCode);
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
    return nextCode;
  }, []);

  const handleJoinRoomCode = useCallback((rawCode: string) => {
    const cleaned = normalizeRoomCode(rawCode);
    if (!cleaned) return;
    setRoomCode(cleaned);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('room', cleaned);
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
  }, []);

  const navigateTo = useCallback(
    (nextView: ViewRole, outId?: ProjectorOutId, nextSpk?: SpeakerNodeIndex) => {
      const params = new URLSearchParams();
      params.set('view', nextView);
      if (nextView === 'projector') {
        params.set('out', String(outId ?? 1));
      } else if (nextView === 'audio-node') {
        params.set('spk', String(nextSpk ?? 1));
      }

      let activeRoom = roomCode;
      if ((nextView === 'setup' || nextView === 'admin') && !activeRoom) {
        activeRoom = generateRoomCode();
        setRoomCode(activeRoom);
      }
      if (activeRoom && nextView !== 'portal') {
        params.set('room', activeRoom);
      }

      const nextUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.pushState({}, '', nextUrl);
      setRoute(parseRouteFromSearch(`?${params.toString()}`));
      if (nextSpk) setSpkIndex(nextSpk);
    },
    [roomCode]
  );

  const isDev = Boolean(
    (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV
  );

  const [highContrast, setHighContrast] = useState(false);
  const [fontScale, setFontScale] = useState(1);

  return (
    <ExperienceProvider
      activeView={route.view}
      roomCode={roomCode}
      onRegenerateRoomCode={handleRegenerateRoomCode}
    >
      {route.view === 'setup' && (
        <SetupWizardView
          onOpenAdmin={() => navigateTo('admin')}
          onNavigate={navigateTo}
        />
      )}
      {route.view === 'admin' && (
        <SetupView onOpenSetupWizard={() => navigateTo('setup')} />
      )}
      {route.view === 'simulator' && <SimulatorView />}
      {route.view === 'projector' && (
        <RoomAccessGate
          onJoinRoomCode={handleJoinRoomCode}
          onGoToSetup={() => navigateTo('setup')}
        >
          <ProjectorView outId={route.outId} />
        </RoomAccessGate>
      )}
      {route.view === 'controller' && (
        <RoomAccessGate
          onJoinRoomCode={handleJoinRoomCode}
          onGoToSetup={() => navigateTo('setup')}
        >
          <TabletControllerView />
        </RoomAccessGate>
      )}
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
          onOpenAuth={() => navigateTo('setup')}
          onOpenRegister={() => navigateTo('controller')}
        />
      )}
      {route.view === 'audio-node' && (
        <RoomAccessGate
          onJoinRoomCode={handleJoinRoomCode}
          onGoToSetup={() => navigateTo('setup')}
        >
          <AudioNodeView
            spkIndex={spkIndex}
            onChangeSpeakerIndex={(next) => navigateTo('audio-node', undefined, next)}
          />
        </RoomAccessGate>
      )}

      {/* Barra flutuante discreta APENAS em dev local */}
      {isDev && route.view !== 'projector' && (
        <nav
          aria-label="Dev View Switcher"
          className={`fixed z-50 flex items-center gap-1 rounded-full border border-slate-400/20 bg-[#060c1a]/92 p-1 text-[11px] font-medium text-slate-300 shadow-lg backdrop-blur-md ${
            route.view === 'setup'
              ? 'right-3 bottom-18'
              : route.view === 'admin'
                ? 'right-3 bottom-2.5'
                : 'bottom-2.5 left-2.5'
          }`}
        >
          {(
            [
              ['portal', 'Portal'],
              ['demo', 'Demo'],
              ['controller', 'Tablet'],
              ['simulator', 'Simulator'],
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
          <span className="mx-0.5 h-3.5 w-px bg-slate-500/35" aria-hidden="true" />
          <button
            type="button"
            onClick={() => navigateTo('setup')}
            className={`rounded-full px-2.5 py-1 transition ${
              route.view === 'setup'
                ? 'bg-sky-400/20 font-semibold text-sky-200 ring-1 ring-sky-400/40'
                : 'text-sky-300/90 hover:text-sky-200'
            }`}
            title="Setup Guiado (?view=setup)"
          >
            Setup
          </button>
          <button
            type="button"
            onClick={() => navigateTo('admin')}
            className={`rounded-full px-2.5 py-1 transition ${
              route.view === 'admin'
                ? 'bg-sky-400/20 font-semibold text-sky-200 ring-1 ring-sky-400/40'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Show Control Admin para Desenvolvedores (?view=admin)"
          >
            Show Control
          </button>
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
