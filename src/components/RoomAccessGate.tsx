import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, KeyRound, Loader2, Settings } from 'lucide-react';
import { useExperience } from '../experience/ExperienceContext';
import { normalizeRoomCode } from '../lan/roomCode';
import {
  RoomValidationResult,
  touchActiveRoom,
  validateRoomAccess,
} from '../lan/roomRegistry';
import { ADMIN_FOCUS, ADMIN_PANEL_CLASS, ADMIN_PRIMARY_PILL_CLASS, ADMIN_WELL_CLASS } from '../views/admin/adminMeta';

interface RoomAccessGateProps {
  onJoinRoomCode: (code: string) => void;
  onGoToSetup: () => void;
  children: React.ReactNode;
}

export const RoomAccessGate: React.FC<RoomAccessGateProps> = ({
  onJoinRoomCode,
  onGoToSetup,
  children,
}) => {
  const { roomCode, syncNetworkMode, lanClients, lang } = useExperience();
  const isPt = lang === 'pt';

  const normalizedRoom = normalizeRoomCode(roomCode);
  const [gateState, setGateState] = useState<'checking' | RoomValidationResult['status']>(() =>
    normalizedRoom ? 'checking' : 'missing-code'
  );
  const [inputCode, setInputCode] = useState<string>(normalizedRoom ?? '');
  const [retryNonce, setRetryNonce] = useState<number>(0);

  // Uma vez validada nesta aba, a sala permanece liberada mesmo que o Setup feche depois (Regra A5)
  const validatedRoomRef = useRef<string | null>(null);
  const lastCheckScopeRef = useRef<string>('');
  const settledScopeRef = useRef<string>('');
  const scopeStartedAtRef = useRef<number>(0);
  const lanClientsRef = useRef(lanClients);
  lanClientsRef.current = lanClients;

  useEffect(() => {
    setInputCode(normalizedRoom ?? '');
    if (!normalizedRoom) {
      validatedRoomRef.current = null;
      lastCheckScopeRef.current = '';
      settledScopeRef.current = '';
      setGateState('missing-code');
      return;
    }

    if (validatedRoomRef.current === normalizedRoom) {
      setGateState('valid');
      return;
    }

    const scopeKey = `${normalizedRoom}::${syncNetworkMode}::${retryNonce}`;
    const isNewScope = lastCheckScopeRef.current !== scopeKey;
    if (isNewScope) {
      lastCheckScopeRef.current = scopeKey;
      settledScopeRef.current = '';
      scopeStartedAtRef.current = Date.now();
      setGateState('checking');
    }

    let cancelled = false;

    const runCheck = async (isFinalAttempt: boolean) => {
      const res = await validateRoomAccess(normalizedRoom, syncNetworkMode, lanClientsRef.current);
      if (cancelled) return;
      if (res.status === 'valid') {
        validatedRoomRef.current = normalizedRoom;
        settledScopeRef.current = scopeKey;
        setGateState('valid');
        return;
      }
      if (isFinalAttempt) {
        settledScopeRef.current = scopeKey;
        setGateState(res.status);
      }
    };

    void runCheck(false);
    const needsSettleTimer = settledScopeRef.current !== scopeKey;
    const remainingMs = Math.max(0, 1500 - (Date.now() - scopeStartedAtRef.current));
    const settleTimer = needsSettleTimer
      ? window.setTimeout(() => {
          if (!cancelled && validatedRoomRef.current !== normalizedRoom) {
            void runCheck(true);
          }
        }, remainingMs)
      : null;

    return () => {
      cancelled = true;
      if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
      }
    };
  }, [lanClients, normalizedRoom, retryNonce, syncNetworkMode]);

  // Heartbeat periódico para sustentar a sala ativa enquanto Projetores/Controle seguem abertos
  useEffect(() => {
    if (gateState !== 'valid' || !normalizedRoom) return;
    void touchActiveRoom(normalizedRoom, syncNetworkMode);
    const timer = window.setInterval(() => {
      void touchActiveRoom(normalizedRoom, syncNetworkMode);
    }, 45_000);
    return () => window.clearInterval(timer);
  }, [gateState, normalizedRoom, syncNetworkMode]);

  if (gateState === 'valid') {
    return <>{children}</>;
  }

  if (gateState === 'checking') {
    return (
      <main
        data-testid="room-access-gate-checking"
        className="flex min-h-dvh w-screen flex-col items-center justify-center bg-[#060913] px-4 text-slate-100 select-none"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 size={28} className="animate-spin text-[#7dd3fc]" />
          <p className="text-sm font-medium text-slate-200 [font-variant-numeric:tabular-nums]">
            {isPt
              ? `Verificando sala ${normalizedRoom ?? ''}...`
              : `Verifying room ${normalizedRoom ?? ''}...`}
          </p>
        </div>
      </main>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = normalizeRoomCode(inputCode);
    if (!cleaned) return;
    if (cleaned === normalizedRoom) {
      setRetryNonce((n) => n + 1);
    } else {
      validatedRoomRef.current = null;
      onJoinRoomCode(cleaned);
    }
  };

  return (
    <main
      data-testid="room-access-gate-blocked"
      className="flex min-h-dvh w-screen items-center justify-center bg-[#060913] px-4 py-8 text-slate-100"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      <section className={`w-full max-w-md p-6 ${ADMIN_PANEL_CLASS}`}>
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/35 bg-amber-500/15 text-amber-300">
          <AlertTriangle size={20} />
        </div>

        <h1 className="mt-4 text-lg font-semibold text-white">
          {gateState === 'missing-code'
            ? isPt
              ? 'Código de sala obrigatório'
              : 'Room code required'
            : isPt
              ? `Sala ${normalizedRoom} não encontrada`
              : `Room ${normalizedRoom} not found`}
        </h1>

        <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
          {gateState === 'missing-code'
            ? isPt
              ? 'Esta visualização (Projetor, Controle ou Caixa Extra) precisa estar vinculada a uma sala criada no Setup.'
              : 'This view (Projector, Controller, or Speaker Node) must be linked to an active room created in Setup.'
            : isPt
              ? 'Nenhuma sala ativa com este código foi criada no Setup. Confira o código de 6 letras exibido no computador principal ou crie uma nova sala.'
              : 'No active room with this code was created in Setup. Check the 6-character code shown on the host computer or create a new room.'}
        </p>

        {gateState === 'missing-schema' && (
          <div className={`mt-3.5 p-3 text-xs leading-relaxed text-amber-200 ${ADMIN_WELL_CLASS}`}>
            {isPt
              ? 'Aviso Supabase: a tabela public.rooms ainda não existe neste projeto. Execute o arquivo supabase/schema.sql no SQL Editor do Supabase para habilitar o registro persistente de salas.'
              : 'Supabase notice: table public.rooms was not found. Run supabase/schema.sql in your Supabase SQL Editor to enable persistent room validation.'}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-300">
            <span>{isPt ? 'Digite um código de sala válido' : 'Enter a valid room code'}</span>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <KeyRound
                  size={15}
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder="EX: K7M4P9"
                  maxLength={24}
                  data-testid="room-gate-input"
                  className={`h-11 w-full rounded-xl border border-[#1e3a66] bg-[#0c1a36] pr-3.5 pl-10 text-sm font-semibold tracking-wider text-white uppercase placeholder:text-slate-500 [font-variant-numeric:tabular-nums] ${ADMIN_FOCUS}`}
                />
              </div>
              <button
                type="submit"
                disabled={!normalizeRoomCode(inputCode)}
                data-testid="room-gate-submit"
                className={`inline-flex min-h-[44px] items-center gap-1.5 px-4 text-xs disabled:opacity-40 ${ADMIN_PRIMARY_PILL_CLASS} ${ADMIN_FOCUS}`}
              >
                <span>{isPt ? 'Entrar' : 'Join'}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </label>
        </form>

        <div className="mt-4 border-t border-[#1e3a66]/50 pt-4">
          <button
            type="button"
            onClick={onGoToSetup}
            data-testid="room-gate-go-setup"
            className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#1e3a66] bg-[#060c1a] px-4 text-xs font-semibold text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
          >
            <Settings size={14} className="text-[#7dd3fc]" />
            <span>{isPt ? 'Criar Nova Sala no Setup' : 'Create New Room in Setup'}</span>
          </button>
        </div>
      </section>
    </main>
  );
};
