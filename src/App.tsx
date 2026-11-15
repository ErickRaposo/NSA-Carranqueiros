import React, { useCallback, useEffect, useState } from 'react';
import { stopSpeech, stopUiAudioTones } from './accessibility/a11yEngine';
import { useA11yPreferences } from './accessibility/a11yPreferences';
import { stopAllSpaceAudio } from './audio/spaceAmbient';
import { EntryPortal } from './components/EntryPortal';
import {
  AccessibilityWidget,
  shouldShowAccessibilityWidget,
} from './components/AccessibilityWidget';
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
  const normalizedView = rawView === 'simulator' ? 'demo' : rawView;
  const validViews: ViewRole[] = [
    'setup',
    'admin',
    'projector',
    'controller',
    'demo',
    'portal',
    'audio-node',
  ];

  let view: ViewRole = validViews.includes(normalizedView as ViewRole)
    ? (normalizedView as ViewRole)
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

  useEffect(() => {
    const stopAllTransientAudio = () => {
      stopSpeech();
      stopUiAudioTones();
      stopAllSpaceAudio();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stopAllTransientAudio();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', stopAllTransientAudio);
    window.addEventListener('beforeunload', stopAllTransientAudio);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', stopAllTransientAudio);
      window.removeEventListener('beforeunload', stopAllTransientAudio);
    };
  }, []);

  useEffect(() => {
    stopSpeech();
    stopUiAudioTones();
    stopAllSpaceAudio();
    return () => {
      stopSpeech();
      stopUiAudioTones();
      stopAllSpaceAudio();
    };
  }, [route.view]);

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

  const {
    highContrast,
    fontScale,
    reduceMotion,
    announcement,
    toggleHighContrast,
    cycleFontScale,
    toggleReduceMotion,
  } = useA11yPreferences();

  const a11yAnnouncer = (
    <div
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="a11y-announcer"
    >
      {announcement}
    </div>
  );

  const currentSearch = typeof window !== 'undefined' ? window.location.search : '';
  const a11yWidget = shouldShowAccessibilityWidget(route.view, currentSearch) ? (
    <AccessibilityWidget
      highContrast={highContrast}
      onToggleHighContrast={toggleHighContrast}
      fontScale={fontScale}
      onCycleFontScale={cycleFontScale}
      reduceMotion={reduceMotion}
      onToggleReduceMotion={toggleReduceMotion}
    />
  ) : null;

  if (route.view === 'portal') {
    return (
      <>
        {a11yAnnouncer}
        <EntryPortal
          highContrast={highContrast}
          onToggleHighContrast={toggleHighContrast}
          fontScale={fontScale}
          onCycleFontScale={cycleFontScale}
          onExploreEarth={() => navigateTo('demo')}
          onOpenAuth={() => navigateTo('setup')}
          onOpenRegister={() => navigateTo('controller')}
        />
        {a11yWidget}
      </>
    );
  }

  return (
    <ExperienceProvider
      activeView={route.view}
      roomCode={roomCode}
      onRegenerateRoomCode={handleRegenerateRoomCode}
    >
      {a11yAnnouncer}
      {a11yWidget}
      {route.view === 'setup' && (
        <SetupWizardView
          onOpenAdmin={() => navigateTo('admin')}
          onNavigate={navigateTo}
        />
      )}
      {route.view === 'admin' && (
        <SetupView onOpenSetupWizard={() => navigateTo('setup')} />
      )}
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
          <TabletControllerView highContrast={highContrast} fontScale={fontScale} />
        </RoomAccessGate>
      )}
      {route.view === 'demo' && (
        <WebDemoView
          highContrast={highContrast}
          fontScale={fontScale}
          onBackToHub={() => navigateTo('setup')}
          onOpenSetup={() => navigateTo('admin')}
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
    </ExperienceProvider>
  );
}

export default App;
