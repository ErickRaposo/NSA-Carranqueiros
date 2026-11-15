import { ProjectionTopologyPreset } from '../../projection/homography';
import { SurfaceId } from '../../experience/types';

export type AdminModuleId = 'overview' | 'projection' | 'audio' | 'network';

export interface LanServerInfo {
  lanIps: string[];
  port: number;
  renderedCountryCount: number;
  renderedCountryIds: string[];
}

export const ADMIN_FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc]';

export const ADMIN_PANEL_CLASS =
  'rounded-[18px] border border-[#1e3a66]/55 bg-[#080d19]/95';
export const ADMIN_WELL_CLASS =
  'rounded-xl border border-[#1e3a66]/40 bg-white/[0.025]';
export const ADMIN_CARD_CLASS =
  'rounded-xl border border-[#1e3a66]/55 bg-[#060c1a]/90';

export const ADMIN_SEGMENT_WRAP_CLASS =
  'grid gap-1 rounded-xl border border-[#1e3a66]/55 bg-[#040b1a] p-1';
export const ADMIN_SEGMENT_ACTIVE_CLASS =
  'border border-[#2563eb]/55 bg-[#0c1a36] font-semibold text-white';
export const ADMIN_SEGMENT_IDLE_CLASS =
  'border border-transparent text-slate-400 hover:text-slate-100';

export const ADMIN_PRIMARY_PILL_CLASS =
  'rounded-full bg-white font-semibold text-[#060913] transition hover:bg-slate-200';

export const SURFACE_UI_META: Record<
  SurfaceId,
  {
    shortPt: string;
    shortEn: string;
    detailPt: string;
    detailEn: string;
    accentHex: string;
  }
> = {
  leftWall: {
    shortPt: 'Parede Esquerda',
    shortEn: 'Left Wall',
    detailPt: 'Globo 3D/2D',
    detailEn: '3D/2D Globe',
    accentHex: '#7dd3fc',
  },
  rightWall: {
    shortPt: 'Parede Direita',
    shortEn: 'Right Wall',
    detailPt: 'Guia & História',
    detailEn: 'Guide & Story',
    accentHex: '#cbd5e1',
  },
  ceiling: {
    shortPt: 'Teto',
    shortEn: 'Ceiling',
    detailPt: '5 Camadas PNG',
    detailEn: '5 PNG Stack',
    accentHex: '#f8fafc',
  },
};

export function presetLabel(preset: ProjectionTopologyPreset, isPt: boolean): string {
  if (preset === '3-projectors') return isPt ? '3 Projetores' : '3 Projectors';
  if (preset === '2-projectors') return isPt ? '2 Projetores · Canto + Teto' : '2 Projectors · L + Ceil';
  if (preset === '1-projector') return isPt ? '1 Projetor' : '1 Projector';
  return isPt ? 'Matriz Customizada' : 'Custom Matrix';
}
