import { PROJECTOR_OUT_IDS, ProjectorOutId } from '../experience/types';

export const MIN_SCREEN_DELAY_MS = -400;
export const MAX_SCREEN_DELAY_MS = 400;
export const SCREEN_DELAY_STEP_MS = 5;

export interface ScreenDelayOutputLike {
  outId: ProjectorOutId;
  surfaces: readonly string[];
  delayMs?: number;
}

export function clampScreenDelayMs(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(MIN_SCREEN_DELAY_MS, Math.min(MAX_SCREEN_DELAY_MS, Math.round(num)));
}

/**
 * Converte os delays assinados configurados por saída (-400..+400 ms) em atrasos reais
 * não-negativos (em ms) para sincronizar múltiplas telas/projetores entre si.
 *
 * - Valores positivos atrasam diretamente a saída selecionada.
 * - Valores negativos indicam que a saída física/rede está atrasada, deslocando
 *   automaticamente as demais saídas ativas para esperarem por ela.
 */
export function computeEffectiveScreenDelays(
  outputs: Record<ProjectorOutId, ScreenDelayOutputLike>
): Record<ProjectorOutId, number> {
  const allOutIds = PROJECTOR_OUT_IDS;
  const activeIds = allOutIds.filter((id) => (outputs[id]?.surfaces?.length ?? 0) > 0);
  const referenceIds = activeIds.length > 0 ? activeIds : allOutIds;

  const signed: Record<ProjectorOutId, number> = {
    1: clampScreenDelayMs(outputs[1]?.delayMs ?? 0),
    2: clampScreenDelayMs(outputs[2]?.delayMs ?? 0),
    3: clampScreenDelayMs(outputs[3]?.delayMs ?? 0),
  };

  const minSigned = Math.min(...referenceIds.map((id) => signed[id]));
  const shift = minSigned < 0 ? -minSigned : 0;

  return {
    1: referenceIds.includes(1) ? Math.max(0, signed[1] + shift) : 0,
    2: referenceIds.includes(2) ? Math.max(0, signed[2] + shift) : 0,
    3: referenceIds.includes(3) ? Math.max(0, signed[3] + shift) : 0,
  };
}
