import React, { useMemo } from 'react';

interface SpaceStarfieldProps {
  /** Offset determinístico para que cada superfície mostre uma região contínua do mesmo cosmos */
  seedOffset?: number;
  /** Quantidade de estrelas */
  count?: number;
  /** Cor sutil de destaque opcional (ex.: camada ativa) */
  accentHex?: string;
}

interface StarPoint {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  delaySec: number;
  durationSec: number;
  tint: string;
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Fundo espacial contínuo em `#000000` absoluto para as 3 superfícies projetadas.
 * O preto puro evita vazamento de luz cinza da lâmpada do projetor nas paredes e no teto.
 */
export const SpaceStarfield: React.FC<SpaceStarfieldProps> = ({
  seedOffset = 0,
  count = 68,
  accentHex,
}) => {
  const stars = useMemo<StarPoint[]>(() => {
    const items: StarPoint[] = [];
    for (let i = 0; i < count; i += 1) {
      const s = seedOffset * 131 + i + 1;
      const r1 = pseudoRandom(s);
      const r2 = pseudoRandom(s + 17);
      const r3 = pseudoRandom(s + 37);
      const r4 = pseudoRandom(s + 53);
      const isBright = r3 > 0.84;
      items.push({
        id: i,
        x: r1 * 100,
        y: r2 * 100,
        size: isBright ? 2.4 : 1 + r3 * 1.3,
        opacity: isBright ? 0.72 + r4 * 0.25 : 0.22 + r4 * 0.4,
        delaySec: r4 * 4.5,
        durationSec: 2.8 + r3 * 3.4,
        tint: isBright && r4 > 0.55 ? '#bae6fd' : '#f8fafc',
      });
    }
    return items;
  }, [count, seedOffset]);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ backgroundColor: '#000000' }}
      aria-hidden="true"
    >
      {stars.map((star) => (
        <span
          key={star.id}
          className="absolute rounded-full animate-pulse"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            backgroundColor: star.tint,
            boxShadow:
              star.size > 2
                ? `0 0 6px ${accentHex ?? 'rgba(186, 230, 253, 0.55)'}`
                : 'none',
            animationDelay: `${star.delaySec.toFixed(2)}s`,
            animationDuration: `${star.durationSec.toFixed(2)}s`,
          }}
        />
      ))}
    </div>
  );
};
