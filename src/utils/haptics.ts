export type HapticPattern = number | number[];

/**
 * Padrões táteis físicos para o Console Tablet (`?view=controller`) via Web Vibration API.
 * Mantém silêncio absoluto em iOS/iPadOS e Desktop (não cria vibração visual substituta).
 */
export const CONSOLE_HAPTIC_PATTERNS = {
  tap: 12,
  sliderTouch: 8,
  countrySelect: [18, 32, 24] as number[],
  briefingStart: [22, 42, 36] as number[],
  boardingSlam: [70, 55, 120] as number[],
  /**
   * Sincronizado com `TabletControllerView`:
   * - 5 batidas na contagem regressiva (5..1 a cada 1100ms -> 5500ms exatos)
   * - Ignição + tranco contínuo dos motores 8D de 5500ms até ~9400ms
   */
  launchSequence: [
    50, 1050, 55, 1045, 65, 1035, 80, 1020, 100, 1000,
    260, 70, 220, 60, 280, 70, 210, 60, 230, 65, 240, 70, 190, 80, 155, 90, 120, 100, 90,
  ] as number[],
  zeroGEject: [95, 65, 45, 90, 25] as number[],
  studioArrive: [28, 48, 18] as number[],
  landingThud: [135, 60, 75] as number[],
} as const;

/**
 * Feedback tátil progressivo para o Console Tablet (?view=controller):
 * - Em dispositivos Android compatíveis, dispara vibração curta ou sequência de impacto via `navigator.vibrate`.
 * - Em iPadOS / iOS / Desktop onde `navigator.vibrate` não é exposto, ignora silenciosamente
 *   sem gerar áudio extra no ambiente (preservando a regra de silêncio e música 8D pura).
 */
export function triggerConsoleHaptic(pattern: HapticPattern = CONSOLE_HAPTIC_PATTERNS.tap): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }
  try {
    navigator.vibrate(pattern);
  } catch {
    // Ignore blocked/unsupported vibration contexts
  }
}

/**
 * Interrompe qualquer vibração em andamento (ex.: encerrar missão ou reiniciar no meio da decolagem).
 */
export function stopConsoleHaptic(): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }
  try {
    navigator.vibrate(0);
  } catch {
    // Ignore blocked/unsupported vibration contexts
  }
}
