import React from 'react';
import { SimulatorView } from '../SimulatorView';

interface LiveRoomMonitorProps {
  heightClass?: string;
  sceneReplayKey: number;
}

/**
 * Viewport 3D ao vivo exclusivo da Visão Geral (sem duplicar medidores/ruído do Console 8D).
 */
export const LiveRoomMonitor: React.FC<LiveRoomMonitorProps> = ({
  heightClass = 'h-[400px]',
  sceneReplayKey,
}) => {
  return (
    <div
      className={`w-full overflow-hidden rounded-xl border border-[#1e3a66]/55 bg-black ${heightClass}`}
      data-testid="admin-mini-canto-monitor"
    >
      <SimulatorView key={sceneReplayKey} embedded />
    </div>
  );
};
