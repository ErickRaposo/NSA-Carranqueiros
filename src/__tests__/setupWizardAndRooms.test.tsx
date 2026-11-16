import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  computeEffectiveAudioVisualDelays,
  createDefaultAudioCalibration,
} from '../audio/speakerCalibration';
import {
  isDelayClickSpeakerActive,
  isPinkNoiseSpeakerActive,
  SpatialAudioEngine,
} from '../audio/spatialAudioEngine';
import { RoomAccessGate } from '../components/RoomAccessGate';
import { ExperienceProvider } from '../experience/ExperienceContext';
import {
  DEFAULT_ROOM_DIMENSIONS,
  updateWallDimension,
} from '../experience/roomDimensions';
import { computeFormatBits, encodeQrMatrix } from '../lan/qrCodeSvg';
import {
  buildViewUrl,
  generateRoomCode,
  normalizeRoomCode,
  readRoomCodeFromSearch,
  resolveSyncNetworkMode,
} from '../lan/roomCode';
import { normalizeSupabaseOrigin } from '../lan/roomRealtimeClient';
import { registerActiveRoom, validateRoomAccess } from '../lan/roomRegistry';
import {
  createRoomSyncTransport,
  createTrailingThrottle,
  isHostCapableRole,
} from '../lan/roomSyncTransport';
import { buildCalibrationGridCircles } from '../projection/calibrationCircles';
import { applyProjectionPreset } from '../projection/homography';
import {
  clampScreenDelayMs,
  computeEffectiveScreenDelays,
} from '../projection/screenDelay';
import { SetupWizardView } from '../views/SetupWizardView';
import { presetToScenario } from '../views/setup/setupTypes';
import { ScreenDelayControlPanel } from '../views/admin/ScreenDelayControlPanel';
import { StepAudioSetup } from '../views/setup/StepAudioSetup';
import { StepControllerPairing } from '../views/setup/StepControllerPairing';
import { StepLanguageAndRoom } from '../views/setup/StepLanguageAndRoom';
import { StepProjectionSetup } from '../views/setup/StepProjectionSetup';
import { StepReadySummary } from '../views/setup/StepReadySummary';

describe('Salas Exclusivas (?room=XXXXXX), Validação de Sala, QR Code ISO, Atraso A/V e Toggles Independentes', () => {
  it('gera códigos de sala legíveis de 6 caracteres e propaga ?room= em todas as URLs', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
    expect(normalizeRoomCode(code.toLowerCase())).toBe(code);
    expect(readRoomCodeFromSearch(`?view=setup&room=${code}`)).toBe(code);
    expect(readRoomCodeFromSearch('?view=demo')).toBeNull();

    expect(buildViewUrl('https://earth.vercel.app', 'controller', { roomCode: code })).toBe(
      `https://earth.vercel.app/?view=controller&room=${code}`
    );
    expect(buildViewUrl(null, 'projector', { outId: 2, roomCode: code })).toBe(
      `/?view=projector&out=2&room=${code}`
    );
    expect(buildViewUrl(null, 'audio-node', { spk: 3, roomCode: code })).toBe(
      `/?view=audio-node&spk=3&room=${code}`
    );
  });

  it('isola visitantes sem room e prioriza cloud-room sempre que Supabase estiver configurado (mesmo em localhost)', () => {
    expect(
      resolveSyncNetworkMode({
        view: 'demo',
        roomCode: null,
        isLocalHost: false,
      })
    ).toBe('isolated');
    expect(
      resolveSyncNetworkMode({
        view: 'portal',
        roomCode: null,
        isLocalHost: true,
        supabaseConfigured: true,
      })
    ).toBe('isolated');

    // Public HTTPS domain -> Online Room (Supabase Realtime)
    expect(
      resolveSyncNetworkMode({
        view: 'setup',
        roomCode: 'XR7K9P',
        isLocalHost: false,
      })
    ).toBe('cloud-room');

    // Localhost WITH Supabase configured -> also uses cloud-room to connect external phones via room code
    expect(
      resolveSyncNetworkMode({
        view: 'setup',
        roomCode: 'XR7K9P',
        isLocalHost: true,
        supabaseConfigured: true,
      })
    ).toBe('cloud-room');

    // Offline installation on local network WITHOUT Supabase -> LAN WebSocket (/ws-earth-sync)
    expect(
      resolveSyncNetworkMode({
        view: 'setup',
        roomCode: 'XR7K9P',
        isLocalHost: true,
        supabaseConfigured: false,
      })
    ).toBe('lan-ws');
  });

  it('bloqueia salas inexistentes como TEST57123 (mesmo com o próprio projetor na presença) e libera salas criadas no Setup', async () => {
    const missing = await validateRoomAccess(null, 'cloud-room', []);
    expect(missing.status).toBe('missing-code');

    // Even if the projector itself appears in livePeers, without a setup/admin host and without registration the room MUST be blocked
    const fakeProjectorOnly = await validateRoomAccess('TEST57123', 'lan-ws', [
      { id: 'proj-self', role: 'projector-1', ip: 'local', connectedAt: 1000 },
    ]);
    expect(fakeProjectorOnly.status).toBe('not-found');

    // When Setup registers the room (or is active as host), validation approves
    await registerActiveRoom('VALID9', 'lan-ws');
    const validRegistered = await validateRoomAccess('VALID9', 'lan-ws', []);
    expect(validRegistered.status).toBe('valid');

    const validLiveHost = await validateRoomAccess('HOST88', 'lan-ws', [
      { id: 'host-1', role: 'setup', ip: 'local', connectedAt: 1000 },
    ]);
    expect(validLiveHost.status).toBe('valid');

    // Renders the access gate when projector opens without a room code
    const blockedGateHtml = renderToStaticMarkup(
      <ExperienceProvider activeView="projector" roomCode={null}>
        <RoomAccessGate onJoinRoomCode={() => {}} onGoToSetup={() => {}}>
          <div data-testid="secret-projector-stage">STAGE</div>
        </RoomAccessGate>
      </ExperienceProvider>
    );
    expect(blockedGateHtml).toContain('room-access-gate-blocked');
    expect(blockedGateHtml).not.toContain('secret-projector-stage');
  });

  it('normaliza URL do Supabase removendo /rest/v1/ e valida salas via host ativo ou /api/rooms em Tunnels', async () => {
    expect(normalizeSupabaseOrigin('https://abc123.supabase.co/rest/v1/')).toBe(
      'https://abc123.supabase.co'
    );
    expect(normalizeSupabaseOrigin(' "https://abc123.supabase.co/" ')).toBe(
      'https://abc123.supabase.co'
    );
    expect(normalizeSupabaseOrigin('ftp://invalid.example.com')).toBeNull();
    expect(normalizeSupabaseOrigin('')).toBeNull();

    // In cloud-room, an active setup/admin host in presence always validates the room
    const validViaCloudHost = await validateRoomAccess('QHXA44', 'cloud-room', [
      { id: 'host-setup', role: 'setup', ip: 'cloud', connectedAt: 1000 },
    ]);
    expect(validViaCloudHost.status).toBe('valid');

    // Simulates Dev Tunnel pointing to the Vite server (/api/rooms returning valid JSON)
    const prevWindow = (globalThis as { window?: unknown }).window;
    try {
      (globalThis as { window?: unknown }).window = {
        location: { origin: 'https://demo-5173.brs.devtunnels.ms' },
        fetch: vi.fn(async () => ({
          ok: true,
          headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
          json: async () => ({ ok: true, exists: true }),
        })),
      };
      const validViaTunnelApi = await validateRoomAccess('QHXA44', 'cloud-room', []);
      expect(validViaTunnelApi.status).toBe('valid');

      // Simulates Vercel HTML fallback (without /api/rooms): MUST NOT unlock a non-existent room
      (globalThis as { window?: unknown }).window = {
        location: { origin: 'https://earth.vercel.app' },
        fetch: vi.fn(async () => ({
          ok: true,
          headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/html' : null) },
          json: async () => ({}),
        })),
      };
      const blockedOnHtmlFallback = await validateRoomAccess('FAKE99', 'cloud-room', []);
      expect(blockedOnHtmlFallback.status).toBe('not-found');
    } finally {
      (globalThis as { window?: unknown }).window = prevWindow;
    }
  });

  it('codifica QR Code ISO/IEC 18004 com Format Bits não-transpostos, Dark Module intacto e suporte a URLs longas', () => {
    const url = 'https://nsa-carranqueiros.vercel.app/?view=controller&room=XR7K9P';
    const matrix = encodeQrMatrix(url);
    const n = matrix.length;

    // Mandatory Dark Module at (row = n - 8, col = 8)
    expect(matrix[n - 8][8]).toBe(true);

    // Extracts the 15 Format Info bits from copy 1 (around the top-left finder)
    const copy1Coords: Array<[number, number]> = [
      [0, 8],
      [1, 8],
      [2, 8],
      [3, 8],
      [4, 8],
      [5, 8],
      [7, 8],
      [8, 8],
      [8, 7],
      [8, 5],
      [8, 4],
      [8, 3],
      [8, 2],
      [8, 1],
      [8, 0],
    ];
    let bitsCopy1 = 0;
    copy1Coords.forEach(([r, c], i) => {
      if (matrix[r][c]) bitsCopy1 |= 1 << i;
    });

    // Extracts the 15 Format Info bits from copy 2 (top-right + bottom-left)
    let bitsCopy2 = 0;
    for (let i = 0; i <= 7; i++) {
      if (matrix[8][n - 1 - i]) bitsCopy2 |= 1 << i;
    }
    for (let i = 8; i <= 14; i++) {
      if (matrix[n - 15 + i][8]) bitsCopy2 |= 1 << i;
    }

    expect(bitsCopy1).toBe(bitsCopy2);
    const validMasksFormatBits = [0, 1, 2, 3, 4, 5, 6, 7].map((m) =>
      computeFormatBits(0b01, m)
    );
    expect(validMasksFormatBits).toContain(bitsCopy1);

    // Tests long URL (> 135 bytes -> Version >= 7 with symmetric 6x3 Version Info)
    const longUrl =
      'https://nsa-carranqueiros-git-feature-multi-room-setup-erickraposo.vercel.app/?view=controller&room=AB34CD&utm_source=qrcode_test_long_payload';
    const longMatrix = encodeQrMatrix(longUrl);
    const ln = longMatrix.length;
    expect(ln).toBeGreaterThanOrEqual(45); // Version 7 = 45x45
    expect(longMatrix[ln - 8][8]).toBe(true);
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        expect(longMatrix[ln - 11 + j][i]).toBe(longMatrix[i][ln - 11 + j]);
      }
    }
  });

  it('calcula atrasos negativos/positivos por caixa (-400..+400 ms) e offset global Vídeo × Som sem valores negativos no DelayNode', () => {
    const base = createDefaultAudioCalibration();
    // C1 = 0 ms, C2 = -150 ms (advances C2 by delaying C1 and C3 by +150 ms), avOffsetMs = -100 ms (delays video by +250 ms total!)
    const calibNeg = {
      ...base,
      avOffsetMs: -100,
      speakers: {
        ...base.speakers,
        speaker1: { ...base.speakers.speaker1, delayMs: 0 },
        speaker2: { ...base.speakers.speaker2, delayMs: -150 },
        speaker3: { ...base.speakers.speaker3, delayMs: 50 },
      },
    };
    const roomNeg = computeEffectiveAudioVisualDelays(calibNeg, 'room3', null);
    expect(roomNeg.speakerDelaySec.speaker2).toBeCloseTo(0, 4);
    expect(roomNeg.speakerDelaySec.speaker1).toBeCloseTo(0.15, 4);
    expect(roomNeg.speakerDelaySec.speaker3).toBeCloseTo(0.2, 4);
    expect(roomNeg.visualDelayMs).toBeCloseTo(250, 2);

    // In Headphones mode with positive avOffsetMs (+180 ms -> projector delayed, delays sound by 0.18s)
    const calibHrtfPos = { ...base, avOffsetMs: 180 };
    const hrtfPos = computeEffectiveAudioVisualDelays(calibHrtfPos, 'hrtf', null);
    expect(hrtfPos.masterDirectDelaySec).toBeCloseTo(0.18, 4);
    expect(hrtfPos.visualDelayMs).toBe(0);

    // In Headphones mode with negative avOffsetMs (-220 ms -> Bluetooth headphones delayed, delays video by 220 ms)
    const calibHrtfNeg = { ...base, avOffsetMs: -220 };
    const hrtfNeg = computeEffectiveAudioVisualDelays(calibHrtfNeg, 'hrtf', null);
    expect(hrtfNeg.masterDirectDelaySec).toBe(0);
    expect(hrtfNeg.visualDelayMs).toBe(220);
  });

  it('permite ativar múltiplas caixas simultaneamente no Ruído Rosa e no Pulso Rítmico (sem botão exclusivo Comparar c/ C1)', () => {
    const engine = new SpatialAudioEngine(createDefaultAudioCalibration());
    expect(engine.getSinkStatuses()).toEqual({
      speaker1: { status: 'default', engine: 'native' },
      speaker2: { status: 'default', engine: 'native' },
      speaker3: { status: 'default', engine: 'native' },
    });
    expect(() => engine.retrySpeakerSink('speaker1', true)).not.toThrow();

    const active1 = engine.togglePinkNoiseSpeaker('speaker1');
    expect(active1).toEqual(['speaker1']);
    expect(isPinkNoiseSpeakerActive(engine.getCalibrationTestMode(), 'speaker1')).toBe(true);
    expect(isPinkNoiseSpeakerActive(engine.getCalibrationTestMode(), 'speaker2')).toBe(false);

    // Turning on C2 keeps C1 on at the same time!
    const active12 = engine.togglePinkNoiseSpeaker('speaker2');
    expect(active12).toEqual(['speaker1', 'speaker2']);
    expect(isPinkNoiseSpeakerActive(engine.getCalibrationTestMode(), 'speaker1')).toBe(true);
    expect(isPinkNoiseSpeakerActive(engine.getCalibrationTestMode(), 'speaker2')).toBe(true);
    expect(isPinkNoiseSpeakerActive(engine.getCalibrationTestMode(), 'speaker3')).toBe(false);

    // Turning off C1 keeps C2 playing alone
    const active2 = engine.togglePinkNoiseSpeaker('speaker1');
    expect(active2).toEqual(['speaker2']);
    expect(isPinkNoiseSpeakerActive(engine.getCalibrationTestMode(), 'speaker1')).toBe(false);
    expect(isPinkNoiseSpeakerActive(engine.getCalibrationTestMode(), 'speaker2')).toBe(true);

    // Same independence for the Rhythmic Delay Pulse
    engine.toggleDelayClickSpeaker('speaker1');
    expect(
      isDelayClickSpeakerActive(engine.getCalibrationTestMode(), 'speaker1', 'speaker1')
    ).toBe(true);
    engine.toggleDelayClickSpeaker('speaker3');
    const clickMode = engine.getCalibrationTestMode();
    expect(isDelayClickSpeakerActive(clickMode, 'speaker1', 'speaker1')).toBe(true);
    expect(isDelayClickSpeakerActive(clickMode, 'speaker2', 'speaker1')).toBe(false);
    expect(isDelayClickSpeakerActive(clickMode, 'speaker3', 'speaker1')).toBe(true);
  });

  it('aplica throttle trailing de 40ms em eventos contínuos e mantém modo isolated silencioso', () => {
    vi.useFakeTimers();
    let clock = 1000;
    const sent: number[] = [];
    const throttled = createTrailingThrottle<number>(40, (v) => sent.push(v), () => clock);

    throttled.send(1);
    expect(sent).toEqual([1]);

    clock = 1010;
    throttled.send(2);
    clock = 1020;
    throttled.send(3);
    expect(sent).toEqual([1]);

    clock = 1045;
    vi.advanceTimersByTime(40);
    expect(sent).toEqual([1, 3]);
    vi.useRealTimers();

    expect(isHostCapableRole('setup')).toBe(true);
    expect(isHostCapableRole('admin')).toBe(true);
    expect(isHostCapableRole('projector-1')).toBe(false);

    let connectedState = true;
    const isolated = createRoomSyncTransport({
      mode: 'isolated',
      roomCode: null,
      peerId: 'visitor-1',
      role: 'demo',
      onSync: () => {},
      onProjection: () => {},
      onSpeakerCalib: () => {},
      onCalibSignal: () => {},
      onPresence: () => {},
      onConnectionChange: (c) => {
        connectedState = c;
      },
    });
    expect(connectedState).toBe(false);
    isolated.dispose();
  });

  it('renderiza SetupWizardView, Atraso Vídeo × Som nos 2 modos, toggles independentes e Etapa 4 sem seletor de adaptador Wi-Fi', () => {
    expect(presetToScenario('1-projector')).toBe(1);
    expect(presetToScenario('2-projectors')).toBe(2);
    expect(presetToScenario('3-projectors')).toBe(3);

    const wizardHtml = renderToStaticMarkup(
      <ExperienceProvider activeView="setup" roomCode="AB34CD">
        <SetupWizardView onOpenAdmin={() => {}} onNavigate={() => {}} />
      </ExperienceProvider>
    );
    expect(wizardHtml).toContain('setup-wizard-view');
    expect(wizardHtml).toContain('AB34CD');
    expect(wizardHtml).not.toContain('<aside');
    expect(wizardHtml).not.toContain('Orbitron');

    // Headphones mode (hrtf) shows Video × Sound Delay + Beat Light, without 3-speaker configuration
    const headphonesHtml = renderToStaticMarkup(
      <StepAudioSetup
        isPt={true}
        audioMode="hrtf"
        audioOwner="pc"
        masterGain={0.9}
        isPlaying={false}
        surfaceToOutLabels={{ leftWall: [], rightWall: [], ceiling: [] }}
        liveEvents={[]}
        speakerCalibration={createDefaultAudioCalibration()}
        calibTestMode={{ kind: 'off' }}
        calibBeatSeq={0}
        outputDevices={[]}
        outputSupportStatus="ready"
        isSetSinkIdSupported={true}
        baseOrigin="https://earth.vercel.app"
        roomCode="AB34CD"
        syncNetworkMode="cloud-room"
        lanClients={[]}
        copiedKey={null}
        onSetAudioMode={() => {}}
        onSetAudioOwner={() => {}}
        onSetMasterGain={() => {}}
        onSetLocalAudioMuted={() => {}}
        onPlayPreview={() => {}}
        onTogglePlay={() => {}}
        onUnlockOutputDevices={() => {}}
        onUpdateSpeakerConfig={() => {}}
        onUpdateAvOffsetMs={() => {}}
        onTogglePinkNoiseSpeaker={() => {}}
        onToggleDelayClickSpeaker={() => {}}
        onToggleHeadphoneDelayClick={() => {}}
        onStopCalibrationSignal={() => {}}
        onCopyText={() => {}}
      />
    );
    expect(headphonesHtml).toContain('headphones-panel');
    expect(headphonesHtml).toContain('av-offset-sync-card');
    expect(headphonesHtml).toContain('calib-visual-beat-flash');
    expect(headphonesHtml).not.toContain('room-speakers-panel');

    // 3-Speaker mode (room3) shows independent toggles (without "Comparar c/ C1") and C1 + C2 active simultaneously
    const baseCalib = createDefaultAudioCalibration();
    const calibWithLanNode = {
      ...baseCalib,
      speakers: {
        ...baseCalib.speakers,
        speaker3: { ...baseCalib.speakers.speaker3, routeTarget: 'lan-node' as const },
      },
    };
    const speakersHtml = renderToStaticMarkup(
      <StepAudioSetup
        isPt={true}
        audioMode="room3"
        audioOwner="pc"
        masterGain={0.9}
        isPlaying={false}
        surfaceToOutLabels={{ leftWall: ['OUT 1'], rightWall: ['OUT 1'], ceiling: ['OUT 2'] }}
        liveEvents={[]}
        speakerCalibration={calibWithLanNode}
        calibTestMode={{ kind: 'pink-multi', speakers: ['speaker1', 'speaker2'] }}
        calibBeatSeq={2}
        outputDevices={[]}
        outputSupportStatus="ready"
        isSetSinkIdSupported={true}
        baseOrigin="https://earth.vercel.app"
        roomCode="AB34CD"
        syncNetworkMode="cloud-room"
        lanClients={[]}
        copiedKey={null}
        onSetAudioMode={() => {}}
        onSetAudioOwner={() => {}}
        onSetMasterGain={() => {}}
        onSetLocalAudioMuted={() => {}}
        onPlayPreview={() => {}}
        onTogglePlay={() => {}}
        onUnlockOutputDevices={() => {}}
        onUpdateSpeakerConfig={() => {}}
        onUpdateAvOffsetMs={() => {}}
        onTogglePinkNoiseSpeaker={() => {}}
        onToggleDelayClickSpeaker={() => {}}
        onToggleHeadphoneDelayClick={() => {}}
        onStopCalibrationSignal={() => {}}
        onCopyText={() => {}}
      />
    );
    expect(speakersHtml).toContain('room-speakers-panel');
    expect(speakersHtml).toContain('room=AB34CD');
    expect(speakersHtml).toContain('Tocando C1');
    expect(speakersHtml).toContain('Tocando C2');
    expect(speakersHtml).not.toContain('Comparar c/ C1');
    expect(speakersHtml).toContain('av-offset-sync-card');
    expect(speakersHtml).toContain('delay-panel-toggle');
    expect(speakersHtml).toContain('aria-expanded="false"');

    // Per-device routing state (error, pending-gesture, and WebAudio/Media engine switch)
    const sinkStatusHtml = renderToStaticMarkup(
      <StepAudioSetup
        isPt={true}
        audioMode="room3"
        audioOwner="pc"
        masterGain={0.9}
        isPlaying={false}
        surfaceToOutLabels={{ leftWall: ['OUT 1'], rightWall: ['OUT 1'], ceiling: ['OUT 2'] }}
        liveEvents={[]}
        speakerCalibration={createDefaultAudioCalibration()}
        calibTestMode={{ kind: 'off' }}
        calibBeatSeq={0}
        outputDevices={[
          { deviceId: 'bt-1', label: 'Caixa BT JBL' },
          { deviceId: 'usb-2', label: 'USB DAC 2' },
        ]}
        outputSupportStatus="ready"
        isSetSinkIdSupported={true}
        speakerSinkStatuses={{
          speaker1: { status: 'error', engine: 'element', detail: 'NotAllowedError' },
          speaker2: { status: 'routed', engine: 'audiocontext' },
          speaker3: { status: 'pending-gesture', engine: 'element' },
        }}
        baseOrigin="https://earth.vercel.app"
        roomCode="AB34CD"
        syncNetworkMode="cloud-room"
        lanClients={[]}
        copiedKey={null}
        onSetAudioMode={() => {}}
        onSetAudioOwner={() => {}}
        onSetMasterGain={() => {}}
        onSetLocalAudioMuted={() => {}}
        onPlayPreview={() => {}}
        onTogglePlay={() => {}}
        onUnlockOutputDevices={() => {}}
        onUpdateSpeakerConfig={() => {}}
        onRetrySpeakerSink={() => {}}
        onUpdateAvOffsetMs={() => {}}
        onTogglePinkNoiseSpeaker={() => {}}
        onToggleDelayClickSpeaker={() => {}}
        onToggleHeadphoneDelayClick={() => {}}
        onStopCalibrationSignal={() => {}}
        onCopyText={() => {}}
      />
    );
    expect(sinkStatusHtml).toContain('sink-status-speaker1');
    expect(sinkStatusHtml).toContain('Tentar outro motor');
    expect(sinkStatusHtml).toContain('sink-status-speaker2');
    expect(sinkStatusHtml).toContain('Motor WebAudio');
    expect(sinkStatusHtml).toContain('Trocar motor');
    expect(sinkStatusHtml).toContain('sink-status-speaker3');
    expect(sinkStatusHtml).toContain('Liberar saída');

    // Mobile pairing without Wi-Fi Adapter selector
    const pairingRequiredHtml = renderToStaticMarkup(
      <StepControllerPairing
        isPt={true}
        scenario={2}
        roomCode="AB34CD"
        tabletUrl="https://earth.vercel.app/?view=controller&room=AB34CD"
        tabletRelativeHref="?view=controller&room=AB34CD"
        qrModules={[[true, false], [false, true]]}
        syncNetworkMode="cloud-room"
        lanClients={[]}
        copiedKey={null}
        manualBypassConfirmed={false}
        onCopyText={() => {}}
        onConfirmManualBypass={() => {}}
        onSkipToReady={() => {}}
      />
    );
    expect(pairingRequiredHtml).toContain('Controle Obrigatório');
    expect(pairingRequiredHtml).not.toContain('Adaptador Wi-Fi');
    expect(pairingRequiredHtml).not.toContain('btn-skip-controller');

    const pairingOptionalHtml = renderToStaticMarkup(
      <StepControllerPairing
        isPt={true}
        scenario={0}
        roomCode="AB34CD"
        tabletUrl="https://earth.vercel.app/?view=controller&room=AB34CD"
        tabletRelativeHref="?view=controller&room=AB34CD"
        qrModules={[[true, false], [false, true]]}
        syncNetworkMode="lan-ws"
        lanClients={[]}
        copiedKey={null}
        manualBypassConfirmed={false}
        onCopyText={() => {}}
        onConfirmManualBypass={() => {}}
        onSkipToReady={() => {}}
      />
    );
    expect(pairingOptionalHtml).toContain('btn-skip-controller');
    expect(pairingOptionalHtml).not.toContain('Adaptador Wi-Fi');

    // Final setup step routes to the Technical Panel (?view=admin) instead of the simulator
    const readyRoomHtml = renderToStaticMarkup(
      <StepReadySummary
        lang="pt"
        roomCode="AB34CD"
        syncNetworkMode="cloud-room"
        scenario={2}
        audioMode="room3"
        controllerConnected={true}
        isPlaying={false}
        onQuickSoundAndVisualTest={() => {}}
        onNavigate={() => {}}
      />
    );
    expect(readyRoomHtml).toContain('btn-launch-admin');
    expect(readyRoomHtml).not.toContain('btn-launch-simulator');
    expect(readyRoomHtml).not.toContain('Simulador 3D');

    const readySingleHtml = renderToStaticMarkup(
      <StepReadySummary
        lang="pt"
        roomCode="AB34CD"
        syncNetworkMode="lan-ws"
        scenario={0}
        audioMode="hrtf"
        controllerConnected={false}
        isPlaying={false}
        onQuickSoundAndVisualTest={() => {}}
        onNavigate={() => {}}
      />
    );
    expect(readySingleHtml).toContain('btn-launch-demo');
    expect(readySingleHtml).toContain('btn-open-admin');
    expect(readySingleHtml).not.toContain('Simulador 3D');
  });

  it('revela sub-blocos do Passo 1 gradualmente com Rack Bars confirmadas', () => {
    const step1LangHtml = renderToStaticMarkup(
      <StepLanguageAndRoom
        lang="pt"
        roomCode="4285QV"
        syncNetworkMode="lan-ws"
        lanConnected={false}
        scenario={2}
        welcomeConfirmed={{ lang: false, room: false, scenario: false }}
        activeWelcomeSubStep="lang"
        onConfirmLang={() => {}}
        onRegenerateRoomCode={() => {}}
        onConfirmRoom={() => {}}
        onSelectScenario={() => {}}
        onEditSubStep={() => {}}
      />
    );
    expect(step1LangHtml).toContain('substep-lang-active');
    expect(step1LangHtml).toContain('next-block-teaser');
    expect(step1LangHtml).not.toContain('substep-room-active');
    expect(step1LangHtml).not.toContain('substep-scenario-active');

    const step1RoomHtml = renderToStaticMarkup(
      <StepLanguageAndRoom
        lang="pt"
        roomCode="4285QV"
        syncNetworkMode="lan-ws"
        lanConnected={false}
        scenario={2}
        welcomeConfirmed={{ lang: true, room: false, scenario: false }}
        activeWelcomeSubStep="room"
        onConfirmLang={() => {}}
        onRegenerateRoomCode={() => {}}
        onConfirmRoom={() => {}}
        onSelectScenario={() => {}}
        onEditSubStep={() => {}}
      />
    );
    expect(step1RoomHtml).toContain('rack-bar-lang');
    expect(step1RoomHtml).toContain('substep-room-active');
    expect(step1RoomHtml).toContain('4285QV');
    expect(step1RoomHtml).toContain('btn-regenerate-room');
    expect(step1RoomHtml).toContain('btn-confirm-room');
    expect(step1RoomHtml).not.toContain('substep-scenario-active');

    const step1ScenarioHtml = renderToStaticMarkup(
      <StepLanguageAndRoom
        lang="pt"
        roomCode="4285QV"
        syncNetworkMode="lan-ws"
        lanConnected={false}
        scenario={2}
        welcomeConfirmed={{ lang: true, room: true, scenario: false }}
        activeWelcomeSubStep="scenario"
        onConfirmLang={() => {}}
        onRegenerateRoomCode={() => {}}
        onConfirmRoom={() => {}}
        onSelectScenario={() => {}}
        onEditSubStep={() => {}}
      />
    );
    expect(step1ScenarioHtml).toContain('rack-bar-lang');
    expect(step1ScenarioHtml).toContain('rack-bar-room');
    expect(step1ScenarioHtml).toContain('substep-scenario-active');
    expect(step1ScenarioHtml).toContain('scenario-card-2');
    expect(step1ScenarioHtml).not.toContain('Recomendado p/ Sala');
    expect(step1ScenarioHtml).not.toContain('Tela Única');
  });

  it('atualiza o tamanho das paredes na etapa de Projetores derivando o teto pela largura de uma parede pela outra', () => {
    const afterLeft = updateWallDimension(DEFAULT_ROOM_DIMENSIONS, 'leftWall', 'widthCm', '420');
    const afterRight = updateWallDimension(afterLeft, 'rightWall', 'widthCm', '310');

    expect(afterRight.leftWall).toEqual({ widthCm: 420, heightCm: 270 });
    expect(afterRight.rightWall).toEqual({ widthCm: 310, heightCm: 270 });
    expect(afterRight.ceiling).toEqual({ widthCm: 310, heightCm: 420 });

    // Respects minimum (50 cm) and maximum (2000 cm) limits
    const clampedMin = updateWallDimension(afterRight, 'leftWall', 'widthCm', '10');
    expect(clampedMin.leftWall.widthCm).toBe(50);
    expect(clampedMin.ceiling.heightCm).toBe(50);

    const projStepHtml = renderToStaticMarkup(
      <StepProjectionSetup
        isPt={true}
        scenario={3}
        projectionState={applyProjectionPreset('3-projectors')}
        roomDimensions={afterRight}
        baseOrigin="https://earth.vercel.app"
        roomCode="AB34CD"
        lanClients={[]}
        copiedKey={null}
        onCopyText={() => {}}
        onIdentifyOutputs={() => {}}
        onToggleGlobalShowGrid={() => {}}
        onResetAllProjectionQuads={() => {}}
        onUpdateSurfaceQuad={() => {}}
        onTranslateOutputMesh={() => {}}
        onUpdateWallDimension={() => {}}
        onResetRoomDimensions={() => {}}
      />
    );
    expect(projStepHtml).toContain('setup-wall-dimensions-panel');
    expect(projStepHtml).toContain('dim-leftWall-width');
    expect(projStepHtml).toContain('dim-rightWall-width');
    expect(projStepHtml).toContain('dim-ceiling-auto');
    expect(projStepHtml).toContain('310 × 420 cm');

    // Proportion circles spread across the grid always stay contained within the wall at any aspect ratio
    for (const [w, h] of [
      [1280, 960],
      [1600, 900],
      [640, 1280],
    ]) {
      const circles = buildCalibrationGridCircles(w, h);
      expect(circles.length).toBeGreaterThanOrEqual(10);
      for (const c of circles) {
        expect(c.r).toBeGreaterThan(0);
        expect(c.cx - c.r).toBeGreaterThanOrEqual(0);
        expect(c.cx + c.r).toBeLessThanOrEqual(w);
        expect(c.cy - c.r).toBeGreaterThanOrEqual(0);
        expect(c.cy + c.r).toBeLessThanOrEqual(h);
      }
    }
  });

  it('empurra snapshot completo (sync + projection + calib) quando outro PC conecta e reenvia request-state com retentativas', () => {
    vi.useFakeTimers();
    const origWs = globalThis.WebSocket;
    const sockets: Array<{
      sent: string[];
      onopen: (() => void) | null;
      onmessage: ((ev: { data: string }) => void) | null;
      onclose: (() => void) | null;
      onerror: (() => void) | null;
      readyState: number;
      close: () => void;
      send: (data: string) => void;
    }> = [];

    class MockWebSocket {
      static OPEN = 1;
      readyState = 1;
      sent: string[] = [];
      onopen: (() => void) | null = null;
      onmessage: ((ev: { data: string }) => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {
        sockets.push(this);
      }
      send(data: string) {
        this.sent.push(data);
      }
      close() {}
    }

    (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket =
      MockWebSocket as unknown as typeof WebSocket;

    try {
      const hostTransport = createRoomSyncTransport({
        mode: 'lan-ws',
        roomCode: 'SYNC01',
        peerId: 'host-peer',
        role: 'setup',
        getHostSnapshot: () => ({
          sync: { countryId: '076', isPlaying: true, progress01: 0.42 },
          projection: { preset: '3-projectors' },
          speakerCalib: { avOffsetMs: -50 },
          calibSignal: { action: 'delay-click-all' },
        }),
        onSync: () => {},
        onProjection: () => {},
        onSpeakerCalib: () => {},
        onCalibSignal: () => {},
        onPresence: () => {},
        onConnectionChange: () => {},
      });

      const hostSock = sockets[0];
      hostSock.onopen?.();
      const hostInitialTypes = hostSock.sent.map((s) => (JSON.parse(s) as { type: string }).type);
      expect(hostInitialTypes).toContain('sync');
      expect(hostInitialTypes).toContain('projection');
      expect(hostInitialTypes).toContain('speaker-calib');
      expect(hostInitialTypes).toContain('calib-signal');

      // Simulates a new computer joining presence -> host pushes updated snapshot after 80ms
      hostSock.sent.length = 0;
      hostSock.onmessage?.({
        data: JSON.stringify({
          type: 'presence',
          clients: [
            { id: 'host-peer', role: 'setup', ip: '10.0.0.1', connectedAt: 1 },
            { id: 'pc2-proj', role: 'projector-1', ip: '10.0.0.2', connectedAt: 2 },
          ],
        }),
      });
      vi.advanceTimersByTime(100);
      const pushTypes = hostSock.sent.map((s) => (JSON.parse(s) as { type: string }).type);
      expect(pushTypes).toEqual(
        expect.arrayContaining(['sync', 'projection', 'speaker-calib', 'calib-signal'])
      );

      // Guest (another PC) requests snapshot and auto-retries until receiving the first sync
      let receivedSyncCount = 0;
      const guestTransport = createRoomSyncTransport({
        mode: 'lan-ws',
        roomCode: 'SYNC01',
        peerId: 'pc2-proj',
        role: 'projector-1',
        onSync: () => {
          receivedSyncCount += 1;
        },
        onProjection: () => {},
        onSpeakerCalib: () => {},
        onCalibSignal: () => {},
        onPresence: () => {},
        onConnectionChange: () => {},
      });

      const guestSock = sockets[1];
      guestSock.onopen?.();
      vi.advanceTimersByTime(600);
      const reqCountBeforeSync = guestSock.sent.filter(
        (s) => (JSON.parse(s) as { type: string }).type === 'request-state'
      ).length;
      expect(reqCountBeforeSync).toBe(2);

      // Receives sync from host -> cancels third retry
      guestSock.onmessage?.({
        data: JSON.stringify({
          type: 'sync',
          senderId: 'host-peer',
          payload: { countryId: '076', isPlaying: true },
        }),
      });
      expect(receivedSyncCount).toBe(1);
      vi.advanceTimersByTime(1500);
      const reqCountAfterSync = guestSock.sent.filter(
        (s) => (JSON.parse(s) as { type: string }).type === 'request-state'
      ).length;
      expect(reqCountAfterSync).toBe(2);

      hostTransport.dispose();
      guestTransport.dispose();
    } finally {
      (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = origWs;
      vi.useRealTimers();
    }
  });

  it('calcula delays efetivos entre telas e renderiza o Controlador de Delay no Setup e Admin', () => {
    expect(clampScreenDelayMs(999)).toBe(400);
    expect(clampScreenDelayMs(-999)).toBe(-400);
    expect(clampScreenDelayMs('abc')).toBe(0);

    const baseState = applyProjectionPreset('3-projectors');
    baseState.outputs[1].delayMs = 40;
    baseState.outputs[2].delayMs = -120; // OUT 2 arriving late: forces OUT 1 (+160) and OUT 3 (+120) to wait
    baseState.outputs[3].delayMs = 0;

    const effective = computeEffectiveScreenDelays(baseState.outputs);
    expect(effective[1]).toBe(160);
    expect(effective[2]).toBe(0);
    expect(effective[3]).toBe(120);
    expect(Object.keys(baseState.outputs)).toEqual(['1', '2', '3']);

    // When only OUT 3 has an active grid, the global button indicates active grid (to hide it)
    baseState.showGrid = false;
    baseState.outputs[3].showGrid = true;

    // Preserves delayMs when toggling topology
    const switched = applyProjectionPreset('2-projectors', baseState);
    expect(switched.outputs[1].delayMs).toBe(40);
    expect(switched.outputs[2].delayMs).toBe(-120);

    const panelHtml = renderToStaticMarkup(
      <ScreenDelayControlPanel
        isPt={true}
        projectionState={baseState}
        screenSyncPulseActive={true}
        calibBeatSeq={4}
        stepLabelPt="Passo 2D · Sincronia entre Telas"
        stepLabelEn="Step 2D · Screen-to-Screen Delay"
        onUpdateOutputDelay={() => {}}
        onResetScreenDelays={() => {}}
        onToggleScreenSyncPulse={() => {}}
      />
    );
    expect(panelHtml).toContain('screen-delay-control-panel');
    expect(panelHtml).toContain('screen-delay-slider-1');
    expect(panelHtml).toContain('screen-delay-slider-2');
    expect(panelHtml).toContain('screen-delay-slider-3');
    expect(panelHtml).toContain('+160 ms');
    expect(panelHtml).toContain('+120 ms');
    expect(panelHtml).toContain('btn-screen-sync-pulse');
    expect(panelHtml).toContain('btn-reset-screen-delays');

    const stepHtml = renderToStaticMarkup(
      <StepProjectionSetup
        isPt={true}
        scenario={3}
        projectionState={baseState}
        roomDimensions={DEFAULT_ROOM_DIMENSIONS}
        baseOrigin="http://localhost:5173"
        roomCode="ROOM01"
        lanClients={[]}
        copiedKey={null}
        screenSyncPulseActive={false}
        calibBeatSeq={0}
        onCopyText={() => {}}
        onIdentifyOutputs={() => {}}
        onToggleGlobalShowGrid={() => {}}
        onResetAllProjectionQuads={() => {}}
        onUpdateSurfaceQuad={() => {}}
        onTranslateOutputMesh={() => {}}
      />
    );
    expect(stepHtml).toContain('Controlador de Delay entre as Telas');
    expect(stepHtml).toContain('screen-delay-slider-3');
    expect(stepHtml).toContain('Ocultar Guia dos 4 Cantos');
  });
});
