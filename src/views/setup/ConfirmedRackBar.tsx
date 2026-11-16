import React from 'react';
import { Pencil } from 'lucide-react';
import { ADMIN_FOCUS } from '../admin/adminMeta';

interface ConfirmedRackBarProps {
  label: string;
  summary: string;
  editLabel: string;
  testId?: string;
  onEdit: () => void;
}

/**
 * Barra compacta de módulo confirmado com marcadores e contraste da Matriz Patchbay (?view=admin).
 */
export const ConfirmedRackBar: React.FC<ConfirmedRackBarProps> = ({
  label,
  summary,
  editLabel,
  testId,
  onEdit,
}) => {
  return (
    <div
      data-testid={testId}
      className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-[#1e3a66]/55 bg-white/[0.02] px-5 py-2.5"
    >
      <div className="flex min-w-0 items-center gap-2.5 [font-variant-numeric:tabular-nums]">
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
        <span className="truncate text-sm font-semibold text-slate-100">
          <span className="font-medium text-slate-400">{label} — </span>
          {summary}
        </span>
      </div>

      <button
        type="button"
        onClick={onEdit}
        data-testid={testId ? `${testId}-edit` : undefined}
        className={`inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border border-[#1e3a66] bg-[#040b1a] px-3.5 text-xs font-medium text-slate-200 transition-[transform,border-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-[#2563eb] hover:text-white active:scale-[0.97] ${ADMIN_FOCUS}`}
      >
        <Pencil size={12} />
        <span>{editLabel}</span>
      </button>
    </div>
  );
};
