import React from 'react';
import { ADMIN_PANEL_CLASS } from '../admin/adminMeta';

interface NextBlockTeaserProps {
  title: string;
  subtitle: string;
  slotCount?: 2 | 3;
}

/**
 * Prévia silenciosa do próximo passo abaixo do bloco ativo.
 * Usa opacidade reduzida + máscara vertical em fade para passar noção de continuidade
 * sem competir por atenção nem interceptar cliques/foco.
 */
export const NextBlockTeaser: React.FC<NextBlockTeaserProps> = ({
  title,
  subtitle,
  slotCount = 2,
}) => {
  return (
    <div
      aria-hidden="true"
      data-testid="next-block-teaser"
      className={`setup-next-teaser p-6 sm:p-8 ${ADMIN_PANEL_CLASS}`}
    >
      <div className="text-lg font-semibold tracking-[-0.015em] text-slate-200 sm:text-xl">
        {title}
      </div>
      <p className="mt-1.5 max-w-[66ch] text-sm leading-[1.6] text-slate-400">
        {subtitle}
      </p>

      <div
        className={`mt-5 grid gap-3 ${
          slotCount === 3 ? 'grid-cols-3' : 'grid-cols-2'
        }`}
      >
        {Array.from({ length: slotCount }).map((_, idx) => (
          <div
            key={idx}
            className="h-14 rounded-xl border border-[#1e3a66]/45 bg-[#040b1a]"
          />
        ))}
      </div>
    </div>
  );
};
