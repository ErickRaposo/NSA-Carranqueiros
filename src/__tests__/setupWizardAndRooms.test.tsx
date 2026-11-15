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
import { SetupWizardView } from '../views/SetupWizardView';
import { presetToScenario } from '../views/setup/setupTypes';
import { StepAudioSetup } from '../views/setup/StepAudioSetup';
import { StepControllerPairing } from '../views/setup/StepControllerPairing';
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

    // Domínio público HTTPS -> Sala Online (Supabase Realtime)
    expect(
      resolveSyncNetworkMode({
        view: 'setup',
        roomCode: 'XR7K9P',
        isLocalHost: false,
      })
    ).toBe('cloud-room');

    // Localhost COM Supabase configurado -> também usa cloud-room para conectar celulares externos via código da sala
    expect(
      resolveSyncNetworkMode({
        view: 'setup',
        roomCode: 'XR7K9P',
        isLocalHost: true,
        supabaseConfigured: true,
      })
    ).toBe('cloud-room');

    // Instalação offline na rede local SEM Supabase -> LAN WebSocket (/ws-earth-sync)
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

    // Mesmo que o próprio projetor apareça em livePeers, sem host setup/admin e sem registro a sala DEVE ser bloqueada
    const fakeProjectorOnly = await validateRoomAccess('TEST57123', 'lan-ws', [
      { id: 'proj-self', role: 'projector-1', ip: 'local', connectedAt: 1000 },
    ]);
    expect(fakeProjectorOnly.status).toBe('not-found');

    // Quando o Setup registra a sala (ou está ativo como host), a validação aprova
    await registerActiveRoom('VALID9', 'lan-ws');
    const validRegistered = await validateRoomAccess('VALID9', 'lan-ws', []);
    expect(validRegistered.status).toBe('valid');

    const validLiveHost = await validateRoomAccess('HOST88', 'lan-ws', [
      { id: 'host-1', role: 'setup', ip: 'local', connectedAt: 1000 },
    ]);
    expect(validLiveHost.status).toBe('valid');

    // Renderização do bloqueio quando projetor abre sem código de sala
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

    // Em cloud-room, um host setup/admin ativo na presença sempre valida a sala
    const validViaCloudHost = await validateRoomAccess('QHXA44', 'cloud-room', [
      { id: 'host-setup', role: 'setup', ip: 'cloud', connectedAt: 1000 },
    ]);
    expect(validViaCloudHost.status).toBe('valid');

    // Simula Dev Tunnel apontando para o servidor Vite (/api/rooms retornando JSON válido)
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

      // Simula fallback HTML da Vercel (sem /api/rooms): NÃO pode liberar sala inexistente
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

    // Dark Module obrigatório em (row = n - 8, col = 8)
    expect(matrix[n - 8][8]).toBe(true);

    // Extrai os 15 bits de Format Info da cópia 1 (em torno do finder superior-esquerdo)
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

    // Extrai os 15 bits de Format Info da cópia 2 (superior-direito + inferior-esquerdo)
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

    // Testa URL longa (> 135 bytes -> Versão >= 7 com Version Info 6x3 simétrico)
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
    // C1 = 0 ms, C2 = -150 ms (adianta C2 atrasando C1 e C3 em +150 ms), avOffsetMs = -100 ms (atrasa vídeo em +250 ms totais!)
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

    // No modo Fone de Ouvido com avOffsetMs positivo (+180 ms -> projetor atrasado, atrasa o som em 0.18s)
    const calibHrtfPos = { ...base, avOffsetMs: 180 };
    const hrtfPos = computeEffectiveAudioVisualDelays(calibHrtfPos, 'hrtf', null);
    expect(hrtfPos.masterDirectDelaySec).toBeCloseTo(0.18, 4);
    expect(hrtfPos.visualDelayMs).toBe(0);

    // No modo Fone de Ouvido com avOffsetMs negativo (-220 ms -> fone Bluetooth atrasado, atrasa o vídeo em 220 ms)
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

    // Ligar C2 mantém C1 ligada ao mesmo tempo!
    const active12 = engine.togglePinkNoiseSpeaker('speaker2');
    expect(active12).toEqual(['speaker1', 'speaker2']);
    expect(isPinkNoiseSpeakerActive(engine.getCalibrationTestMode(), 'speaker1')).toBe(true);
    expect(isPinkNoiseSpeakerActive(engine.getCalibrationTestMode(), 'speaker2')).toBe(true);
    expect(isPinkNoiseSpeakerActive(engine.getCalibrationTestMode(), 'speaker3')).toBe(false);

    // Desligar C1 mantém C2 tocando sozinha
    const active2 = engine.togglePinkNoiseSpeaker('speaker1');
    expect(active2).toEqual(['speaker2']);
    expect(isPinkNoiseSpeakerActive(engine.getCalibrationTestMode(), 'speaker1')).toBe(false);
    expect(isPinkNoiseSpeakerActive(engine.getCalibrationTestMode(), 'speaker2')).toBe(true);

    // Mesma independência no Pulso Rítmico de atraso
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

    // Modo Fone de Ouvido (hrtf) exibe Atraso Vídeo × Som + Luz de Batida, sem configuração de 3 caixas
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

    // Modo 3 Caixas (room3) exibe toggles independentes (sem "Comparar c/ C1") e C1 + C2 ativas simultaneamente
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

    // Estado de roteamento por dispositivo (erro, pending-gesture e troca de motor WebAudio/Media)
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

    // Pareamento mobile sem seletor de Adaptador Wi-Fi
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

    // Etapa final do setup direciona para o Painel Técnico (?view=admin) em vez do simulador
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
});
