export type HapticPattern = number | number[];

/**
 * Physical haptic patterns for the Tablet Console (`?view=controller`) via the Web Vibration API.
 * Keeps absolute silence on iOS/iPadOS and Desktop (does not create a substitute visual vibration).
 */
export const CONSOLE_HAPTIC_PATTERNS = {
  tap: 12,
  sliderTouch: 8,
  countrySelect: [18, 32, 24] as number[],
  briefingStart: [22, 42, 36] as number[],
  boardingSlam: [70, 55, 120] as number[],
  /**
   * Synchronized with `TabletControllerView`:
   * - 5 pulses on the countdown (5..1 every 1100ms -> exact 5500ms)
   * - Ignition + continuous jolt of the 8D engines from 5500ms to ~9400ms
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
 * Progressive haptic feedback for the Tablet Console (?view=controller):
 * - On compatible Android devices, triggers a short vibration or impact sequence via `navigator.vibrate`.
 * - On iPadOS / iOS / Desktop where `navigator.vibrate` is not exposed, silently ignores
 *   without generating extra ambient audio (preserving the silence and pure 8D music rule).
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
 * Stops any ongoing vibration (e.g., ending mission or restarting mid-liftoff).
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
