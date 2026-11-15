import React, { useCallback, useEffect, useState } from 'react';
import { stopSpeech, stopUiAudioTones } from './accessibility/a11yEngine';
import { stopAllSpaceAudio } from './audio/spaceAmbient';
import { EntryPortal } from './components/EntryPortal';
import { ExperienceProvider } from './experience/ExperienceContext';
import { ProjectorOutId, SpeakerNodeIndex, ViewRole } from './experience/types';
import { AudioNodeView } from './views/AudioNodeView';
import { ProjectorView } from './views/ProjectorView';
import { SetupView } from './views/SetupView';
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
  const normalizedView =
    rawView === 'admin'
      ? 'setup'
      : rawView === 'simulator'
        ? 'demo'
        : rawView;
  const validViews: ViewRole[] = [
    'setup',
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
  } else if (
    !rawView &&
    (normalizedPath === '/sala' || normalizedPath === '/demo')
  ) {
    view = 'demo';
  } else if (!rawView && normalizedPath === '/admin') {
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

  useEffect(() => {
    const onPopState = () => {
      setRoute(parseRouteFromSearch(window.location.search));
      setSpkIndex(parseSpeakerIndexFromSearch(window.location.search));
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

  const navigateTo = useCallback(
    (nextView: ViewRole, outId?: ProjectorOutId, nextSpk?: SpeakerNodeIndex) => {
      const params = new URLSearchParams();
      params.set('view', nextView);
      if (nextView === 'projector') {
        params.set('out', String(outId ?? 1));
      } else if (nextView === 'audio-node') {
        params.set('spk', String(nextSpk ?? 1));
      }
      const nextUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.pushState({}, '', nextUrl);
      setRoute(parseRouteFromSearch(`?${params.toString()}`));
      if (nextSpk) setSpkIndex(nextSpk);
    },
    []
  );

  const [highContrast, setHighContrast] = useState(false);
  const [fontScale, setFontScale] = useState(1);

  if (route.view === 'portal') {
    return (
      <EntryPortal
        highContrast={highContrast}
        onToggleHighContrast={() => setHighContrast((prev) => !prev)}
        fontScale={fontScale}
        onCycleFontScale={() =>
          setFontScale((prev) => (prev === 1 ? 1.15 : prev === 1.15 ? 1.3 : 1))
        }
        onExploreEarth={() => navigateTo('demo')}
        onOpenAuth={() => navigateTo('demo')}
        onOpenRegister={() => navigateTo('demo')}
      />
    );
  }

  return (
    <ExperienceProvider routeView={route.view}>
      {route.view === 'setup' && <SetupView />}
      {route.view === 'projector' && <ProjectorView outId={route.outId} />}
      {route.view === 'controller' && <TabletControllerView />}
      {route.view === 'demo' && (
        <WebDemoView
          // TODO(erick): apontar para a tela intermediária do Erick (hub de seleção) quando entrar no repositório
          onBackToHub={() => {
            const params = new URLSearchParams();
            params.set('view', 'hub');
            window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
            setRoute(parseRouteFromSearch(`?${params.toString()}`));
          }}
          onOpenSetup={() => navigateTo('setup')}
        />
      )}
      {route.view === 'audio-node' && (
        <AudioNodeView
          spkIndex={spkIndex}
          onChangeSpeakerIndex={(next) => navigateTo('audio-node', undefined, next)}
        />
      )}
    </ExperienceProvider>
  );
}

export default App;
