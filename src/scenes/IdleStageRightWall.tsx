import React from 'react';
import { Play } from 'lucide-react';
import { motion } from 'motion/react';
import { MissionGameButton } from '../components/MissionGameButton';
import { IdlePanoramaBridge } from './IdlePanoramaBridge';

interface IdleStageRightWallProps {
  isPt: boolean;
  interactive?: boolean;
  onStartMission?: () => void;
}

/**
 * Palco de Espera (`idle`) da Parede Direita:
 * - Sol radiante + planetas bem espalhados pelos quadrantes (sem aglomerar e sem competir com o texto)
 * - Texto central mantido (`Vamos começar a sua imersão?`)
 * - Conectado ao `IdlePanoramaBridge` para faixas MINEIRØ, cometas e robô gigante cruzarem a quina em L
 */
export const IdleStageRightWall: React.FC<IdleStageRightWallProps> = ({
  isPt,
  interactive = false,
  onStartMission,
}) => {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {/* 1. Sol radiante no quadrante superior direito com planeta satélite próximo */}
      <div
        className="pointer-events-none absolute top-[21%] left-[84%] -translate-x-1/2 -translate-y-1/2"
        aria-hidden="true"
      >
        <motion.div
          className="absolute top-1/2 left-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
          style={{
            background:
              'radial-gradient(circle, rgba(251,191,36,0.3) 0%, rgba(245,158,11,0.1) 52%, transparent 74%)',
          }}
          animate={{ scale: [0.95, 1.09, 0.95], opacity: [0.72, 0.96, 0.72] }}
          transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div
          className="relative h-16 w-16 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 35% 32%, #fef9c3 0%, #fbbf24 46%, #ea580c 100%)',
            boxShadow:
              '0 0 32px rgba(251, 191, 36, 0.7), 0 0 72px rgba(245, 158, 11, 0.3)',
          }}
        />
        {/* Planeta quente interno em órbita aberta do Sol */}
        <div
          className="absolute top-1/2 left-1/2 h-[156px] w-[156px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-amber-200/14"
        />
        <div
          className="ceiling-orbit-cw absolute top-1/2 left-1/2 h-0 w-0"
          style={{ animationDuration: '18s' }}
        >
          <div style={{ transform: 'translateX(78px)' }}>
            <div
              className="h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background:
                  'radial-gradient(circle at 32% 30%, #fde68a 0%, #f59e0b 55%, #78350f 100%)',
                boxShadow: '0 0 12px rgba(245, 158, 11, 0.5)',
              }}
            />
          </div>
        </div>
      </div>

      {/* 2. Gigante com Anéis (Saturno estilizado) bem separado perto do quadrante superior esquerdo */}
      <motion.div
        className="pointer-events-none absolute top-[24%] left-[15%]"
        animate={{ y: [-9, 9, -9], x: [-5, 7, -5] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      >
        <div className="relative flex items-center justify-center">
          <div
            className="pointer-events-none absolute rounded-full border-2 border-amber-200/60"
            style={{
              width: '84px',
              height: '24px',
              transform: 'rotate(-20deg)',
              boxShadow: '0 0 12px rgba(253, 230, 138, 0.25)',
            }}
          />
          <div
            className="relative h-11 w-11 rounded-full"
            style={{
              background:
                'radial-gradient(circle at 34% 28%, #fef3c7 0%, #eab308 55%, #713f12 100%)',
              boxShadow: '0 0 24px rgba(250, 204, 21, 0.4)',
            }}
          />
        </div>
      </motion.div>

      {/* 3. Planeta Oceânico com Lua no meio-direito (abaixo do Sol, livre do texto) */}
      <motion.div
        className="pointer-events-none absolute top-[57%] left-[84%]"
        animate={{ y: [7, -8, 7], x: [4, -4, 4] }}
        transition={{ duration: 9.5, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      >
        <div className="relative flex items-center justify-center">
          <div
            className="h-9 w-9 rounded-full"
            style={{
              background:
                'radial-gradient(circle at 32% 28%, #bae6fd 0%, #0284c7 58%, #082f49 100%)',
              boxShadow: '0 0 22px rgba(56, 189, 248, 0.5)',
            }}
          />
          <div
            className="ceiling-orbit-ccw absolute top-1/2 left-1/2 h-0 w-0"
            style={{ animationDuration: '6.5s' }}
          >
            <div
              className="h-2 w-2 rounded-full bg-slate-200/90"
              style={{ transform: 'translate(27px, -4px)' }}
            />
          </div>
        </div>
      </motion.div>

      {/* 4. Planeta Coral-Marte flutuando na lateral esquerda média (próximo à quina) */}
      <motion.div
        className="pointer-events-none absolute top-[55%] left-[12%]"
        animate={{ y: [-7, 8, -7] }}
        transition={{ duration: 8.5, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      >
        <div
          className="h-7 w-7 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 34% 30%, #fecdd3 0%, #f43f5e 58%, #881337 100%)',
            boxShadow: '0 0 18px rgba(251, 113, 133, 0.45)',
          }}
        />
      </motion.div>

      {/* 5. Pequeno astro violeta distante no topo central */}
      <motion.div
        className="pointer-events-none absolute top-[17%] left-[48%]"
        animate={{ y: [4, -5, 4], x: [-6, 6, -6] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      >
        <div
          className="h-5 w-5 rounded-full opacity-85"
          style={{
            background:
              'radial-gradient(circle at 30% 28%, #e9d5ff 0%, #8b5cf6 58%, #2e1065 100%)',
            boxShadow: '0 0 14px rgba(167, 139, 250, 0.4)',
          }}
        />
      </motion.div>

      {/* Frase central original + Botão START estilo jogo acima da pista do MINEIRØ */}
      <div className="relative z-20 flex h-full w-full flex-col items-center justify-center gap-7 px-10 pb-36 text-center">
        <h1
          className="max-w-[70%] font-bold tracking-[0.04em] text-slate-50 uppercase drop-shadow-[0_4px_24px_rgba(0,0,0,0.88)]"
          style={{
            fontFamily: "'Orbitron', 'Poppins', system-ui, sans-serif",
            fontSize: '54px',
            lineHeight: 1.18,
          }}
        >
          {isPt ? 'Vamos começar a sua imersão?' : 'Shall we begin your immersion?'}
        </h1>

        <MissionGameButton
          label="Start"
          icon={Play}
          size="lg"
          floating
          interactive={Boolean(interactive && onStartMission)}
          onClick={interactive && onStartMission ? onStartMission : undefined}
        />
      </div>

      {/* Camada contínua compartilhada entre Parede Esquerda e Parede Direita */}
      <IdlePanoramaBridge surface="rightWall" />
    </div>
  );
};
