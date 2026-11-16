import React from 'react';
import { type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { HapticPattern, triggerConsoleHaptic } from '../utils/haptics';

export interface MissionGameButtonProps {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  interactive?: boolean;
  size?: 'sm' | 'md' | 'lg';
  floating?: boolean;
  hapticPattern?: HapticPattern;
  ariaLabel?: string;
  className?: string;
  testId?: string;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'min-h-[42px] gap-2 px-5 py-2 text-[13px] tracking-[0.15em]',
  md: 'min-h-[48px] gap-2.5 px-6 py-2.5 text-[15px] tracking-[0.16em]',
  lg: 'min-h-[54px] gap-3 px-8 py-3 text-[17px] tracking-[0.22em]',
};

const ICON_SIZES: Record<'sm' | 'md' | 'lg', number> = {
  sm: 14,
  md: 16,
  lg: 17,
};

/**
 * Botão canônico com estética de controle/videogame compartilhado 1:1
 * entre a Parede Direita (Robô MINEIRØ) e o Tablet Controle (`?view=controller`).
 */
export const MissionGameButton: React.FC<MissionGameButtonProps> = ({
  label,
  icon: Icon,
  onClick,
  interactive = true,
  size = 'md',
  floating = false,
  hapticPattern = 14,
  ariaLabel,
  className = '',
  testId,
}) => {
  const baseClass =
    'group relative inline-flex items-center justify-center rounded-xl border border-sky-300/55 border-b-[4px] border-b-sky-300/75 bg-[#040b1a]/75 font-semibold text-sky-100 uppercase shadow-[0_0_24px_rgba(56,189,248,0.16)]';
  const interactiveClass = interactive
    ? 'pointer-events-auto cursor-pointer transition-all duration-150 hover:border-sky-200/85 hover:bg-sky-400/12 hover:text-white active:translate-y-[2px] active:border-b-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc]'
    : 'pointer-events-none select-none';

  const combinedClass = `${baseClass} ${SIZE_CLASSES[size]} ${interactiveClass} ${className}`.trim();
  const fontStyle: React.CSSProperties = {
    fontFamily: "'Orbitron', 'Poppins', system-ui, sans-serif",
  };
  const iconPx = ICON_SIZES[size];

  const inner = (
    <>
      <Icon
        size={iconPx}
        className={`shrink-0 text-sky-300 ${
          interactive ? 'transition-transform duration-150 group-hover:scale-105 group-hover:text-sky-200' : ''
        }`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </>
  );

  if (interactive) {
    return (
      <motion.button
        type="button"
        onClick={() => {
          triggerConsoleHaptic(hapticPattern);
          onClick?.();
        }}
        aria-label={ariaLabel ?? label}
        data-testid={testId}
        animate={floating ? { y: [0, -2, 0] } : undefined}
        transition={floating ? { duration: 3, repeat: Infinity, ease: 'easeInOut' } : undefined}
        className={combinedClass}
        style={fontStyle}
      >
        {inner}
      </motion.button>
    );
  }

  return (
    <motion.div
      aria-hidden="true"
      data-testid={testId}
      animate={floating ? { y: [0, -2, 0] } : undefined}
      transition={floating ? { duration: 3, repeat: Infinity, ease: 'easeInOut' } : undefined}
      className={combinedClass}
      style={fontStyle}
    >
      {inner}
    </motion.div>
  );
};
