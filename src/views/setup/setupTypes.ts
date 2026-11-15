import { ProjectionTopologyPreset } from '../../projection/homography';

export type ScreenScenario = 0 | 1 | 2 | 3;

export type SetupStepId = 'welcome' | 'projection' | 'audio' | 'controller' | 'ready';

export const SETUP_SCENARIO_STORAGE_KEY = 'earth-jukebox-setup-scenario-v1';

export function presetToScenario(preset: ProjectionTopologyPreset): ScreenScenario {
  if (preset === '1-projector') return 1;
  if (preset === '3-projectors') return 3;
  return 2;
}

export function loadInitialScreenScenario(
  currentPreset: ProjectionTopologyPreset
): ScreenScenario {
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(SETUP_SCENARIO_STORAGE_KEY);
      if (saved === '0' || saved === '1' || saved === '2' || saved === '3') {
        return Number(saved) as ScreenScenario;
      }
    } catch {
      // ignore storage errors
    }
  }
  return presetToScenario(currentPreset);
}

export function saveScreenScenario(scenario: ScreenScenario): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SETUP_SCENARIO_STORAGE_KEY, String(scenario));
  } catch {
    // ignore storage errors
  }
}
