import type { ComponentChildren } from "preact";

export function Chip({ selected, onClick, children, icon, disabled, name, value }: {
  selected: boolean; onClick: () => void; children: ComponentChildren; icon?: ComponentChildren; disabled?: boolean; name?: string; value?: string;
}) {
  return (
    <button type="button" role="radio" aria-checked={selected} class="chip" onClick={onClick} disabled={disabled} data-name={name} data-value={value}>
      {icon && <span class="chip__icon" aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
