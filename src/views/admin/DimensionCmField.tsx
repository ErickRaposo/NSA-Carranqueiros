import React, { useState } from 'react';
import { ROOM_DIMENSION_MAX_CM, ROOM_DIMENSION_MIN_CM } from '../../experience/roomDimensions';
import { ADMIN_FOCUS } from './adminMeta';

interface DimensionCmFieldProps {
  label: string;
  value: number;
  testId?: string;
  onCommit: (raw: string) => void;
}

/** Campo numérico em centímetros (cm) com digitação livre e validação ao confirmar/sair. */
export const DimensionCmField: React.FC<DimensionCmFieldProps> = ({
  label,
  value,
  testId,
  onCommit,
}) => {
  const [draft, setDraft] = useState<string | null>(null);
  const displayedValue = draft !== null ? draft : String(value);

  const commitDraft = (raw: string) => {
    const trimmed = raw.replace(/\D/g, '');
    if (trimmed.length > 0) {
      onCommit(trimmed);
    }
    setDraft(null);
  };

  return (
    <label className="flex flex-col gap-1 text-xs text-slate-400">
      <span>{label}</span>
      <input
        type="text"
        inputMode="numeric"
        data-testid={testId}
        value={displayedValue}
        onFocus={() => setDraft(String(value))}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '');
          setDraft(digits);
          const parsed = Number(digits);
          if (
            digits.length > 0 &&
            parsed >= ROOM_DIMENSION_MIN_CM &&
            parsed <= ROOM_DIMENSION_MAX_CM
          ) {
            onCommit(digits);
          }
        }}
        onBlur={(e) => commitDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
        className={`h-10 rounded-xl border border-[#1e3a66] bg-[#0c1a36] px-3 text-xs text-slate-100 [font-variant-numeric:tabular-nums] ${ADMIN_FOCUS}`}
      />
    </label>
  );
};
