import type { ComponentChildren } from "preact";
import { Chip } from "./Chip";

export interface Choice<T extends string> { value: T; label: string; icon?: ComponentChildren }

/** A row of mutually exclusive chips. `columns` fixes the grid; otherwise chips share the row equally. */
export function ChoiceGroup<T extends string>({ label, value, choices, onChange, columns, compact, hideLabel }: {
  label: string; value: T; choices: Choice<T>[]; onChange: (v: T) => void; columns?: number; compact?: boolean; hideLabel?: boolean;
}) {
  return (
    <div class={`choice ${compact ? "choice--compact" : ""}`} role="radiogroup" aria-label={label}>
      {!hideLabel && <div class="field__label">{label}</div>}
      <div class="choice__row" style={columns ? `grid-template-columns: repeat(${columns}, 1fr)` : undefined}>
        {choices.map((c) => (
          <Chip key={c.value} selected={value === c.value} onClick={() => onChange(c.value)} icon={c.icon} name={label} value={c.value}>
            {c.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
